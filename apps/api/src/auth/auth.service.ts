import { requiresTwoFactor } from './two-factor-policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EmailService } from '../common/email.service';
import { decryptSecret, encryptSecret } from '../common/secrets.crypto';
import { resolveCustomerLogin } from './customer-login';
import { TotpService } from './totp.service';
import { BootstrapTokenService } from './bootstrap-token.service';
import { isActiveRole } from '../common/role-utils';

type LoginInput = {
  identifier: string;
  password: string;
  bootstrapToken?: string;
  email?: string;
  tenantId?: string;
  device?: string;
  ip?: string;
  userAgent?: string;
};

type RefreshInput = {
  refreshToken: string;
};

type UpdateMeInput = {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

type AccessPayload = {
  sub: string;
  sid: string;
  tenantId: string | null;
  role: string | null;
  typ: 'access';
};

type RefreshPayload = {
  sub: string;
  sid: string;
  jti: string;
  typ: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(TotpService) private readonly totpService: TotpService,
    @Inject(BootstrapTokenService) private readonly bootstrapTokenService: BootstrapTokenService,
  ) {}

  async login(input: LoginInput) {
    const rawId = input.identifier.trim();
    const lId = rawId.toLowerCase();
    const numericId = rawId.replace(/\D/g, '');

    // 1) Preferencia por e-mail exato.
    let user = await this.prisma.user.findUnique({
      where: { email: lId },
      include: { tenants: { include: { role: true, tenant: true } } },
    });

    let usedCnpjFallback = false;
    let foundTenantId: string | null = null;
    if (!user && /^[\d./-]+$/.test(rawId) && numericId.length === 14) {
      const membership = await resolveCustomerLogin(
        this.prisma,
        rawId,
        input.email,
        input.tenantId,
      );
      if (membership) {
        user = membership.user;
        foundTenantId = membership.tenantId;
        usedCnpjFallback = true;
      }
    }

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      await this.logAudit(
        null,
        null,
        'LOGIN_FAILED',
        'auth',
        null,
        {
          identifier: input.identifier,
          reason: 'user_not_found_or_inactive',
        },
        input.ip,
        input.userAgent,
      );
      throw new UnauthorizedException(
        'Credenciais inválidas. Use seu e-mail completo; no primeiro acesso, informe CNPJ e e-mail.',
      );
    }

    const memberships = input.tenantId
      ? user.tenants.filter((membership) => membership.tenantId === input.tenantId)
      : foundTenantId
        ? user.tenants.filter((membership) => membership.tenantId === foundTenantId)
        : user.tenants;

    if (memberships.length === 0) {
      throw new ForbiddenException('User has no tenant membership for requested scope.');
    }

    const selectedMembership =
      memberships.find(
        (membership) => membership.tenant.status === 'ACTIVE' && !membership.tenant.deletedAt,
      ) ?? memberships[0];
    const roleCode = selectedMembership.role.code;
    if (!isActiveRole(roleCode))
      throw new ForbiddenException('Perfil de acesso descontinuado ou inválido.');
    // Explicit admin password provisioning is distinct from CNPJ/OTP self-onboarding.
    // This flag is database-managed; it cannot be set through login or PATCH /auth/me.
    const provisioning = (user.sourceMetadata as Record<string, unknown> | null)
      ?.accessProvisioning;
    const adminProvisionedCustomer =
      roleCode === 'cliente' &&
      !!selectedMembership.customerId &&
      !!provisioning &&
      typeof provisioning === 'object' &&
      !Array.isArray(provisioning) &&
      (provisioning as Record<string, unknown>).method === 'ADMIN_PROVISIONED';
    const isClientFirstLogin =
      roleCode === 'cliente' && !user.lastLoginAt && !adminProvisionedCustomer;

    if (isClientFirstLogin && !usedCnpjFallback) {
      await this.logAudit(
        null,
        user.id,
        'LOGIN_FAILED',
        'auth',
        null,
        {
          identifier: input.identifier,
          reason: 'client_first_login_requires_cnpj',
        },
        input.ip,
        input.userAgent,
      );
      throw new UnauthorizedException('Primeiro acesso do cliente deve ser via CNPJ.');
    }

    if (
      isClientFirstLogin &&
      (!input.bootstrapToken ||
        !user.bootstrapTokenHash ||
        !user.bootstrapTokenExpiresAt ||
        this.bootstrapTokenService.isExpired(user.bootstrapTokenExpiresAt) ||
        !this.bootstrapTokenService.verifyToken(input.bootstrapToken, user.bootstrapTokenHash))
    ) {
      await this.logAudit(
        selectedMembership.tenantId,
        user.id,
        'LOGIN_FAILED',
        'auth',
        null,
        {
          identifier: input.identifier,
          reason: 'client_first_login_requires_validated_otp',
        },
        input.ip,
        input.userAgent,
      );
      throw new UnauthorizedException('Valide o código de primeiro acesso antes de entrar.');
    }

    const validPassword = await compare(input.password, user.passwordHash);
    if (!validPassword) {
      await this.logAudit(
        null,
        user.id,
        'LOGIN_FAILED',
        'auth',
        null,
        {
          identifier: input.identifier,
          reason: 'invalid_password',
        },
        input.ip,
        input.userAgent,
      );
      throw new UnauthorizedException(
        'Credenciais inválidas. Use seu e-mail completo; no primeiro acesso, informe CNPJ e e-mail.',
      );
    }
    if (selectedMembership.tenant.status !== 'ACTIVE' || selectedMembership.tenant.deletedAt) {
      throw new ForbiddenException('Tenant is inactive or suspended.');
    }

    // Audit restricted setup sessions; AuthGuard allows only enrollment until 2FA is enabled.
    if (requiresTwoFactor(roleCode) && !user.twoFactorEnabled) {
      await this.logAudit(
        selectedMembership.tenantId,
        user.id,
        'LOGIN',
        'auth',
        null,
        {
          reason: '2FA required for super_admin but not configured',
          status: 'pending_setup',
        },
        input.ip,
        input.userAgent,
      );
    }

    if (user.twoFactorEnabled && !user.twoFactorSecretEnc)
      throw new UnauthorizedException(
        'Configuração de verificação em duas etapas inválida. Solicite suporte.',
      );

    // ✅ If 2FA is enabled, return temporary 2FA session token instead of full access
    if (user.twoFactorEnabled && user.twoFactorSecretEnc) {
      const tempSessionId = randomUUID();
      const temp2faToken = sign(
        {
          sub: user.id,
          sid: tempSessionId,
          tenantId: selectedMembership.tenantId,
          typ: '2fa-pending',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes for 2FA verification
        },
        process.env.JWT_ACCESS_SECRET!,
      );

      // Create temporary session (marked as 2FA pending)
      await this.prisma.session.create({
        data: {
          id: tempSessionId,
          userId: user.id,
          tenantId: selectedMembership.tenantId,
          refreshTokenHash: this.hashToken(temp2faToken),
          device: input.device,
          ip: input.ip,
          userAgent: input.userAgent,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });

      await this.logAudit(
        selectedMembership.tenantId,
        user.id,
        'LOGIN',
        'auth',
        null,
        {
          sessionId: tempSessionId,
          status: '2fa_challenge',
        },
        input.ip,
        input.userAgent,
      );

      return {
        accessToken: null,
        refreshToken: null,
        sessionId: tempSessionId,
        twoFactorRequired: true,
        temporaryToken: temp2faToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          tenantId: selectedMembership.tenantId,
          role: roleCode,
          tradeName: selectedMembership.tenant.tradeName,
        },
      };
    }

    // ✅ Normal login flow (no 2FA required)
    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken({
      sub: user.id,
      sid: sessionId,
      jti: randomUUID(),
      typ: 'refresh',
    });

    const expiresAt = this.refreshExpiresAt();

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: selectedMembership.tenantId,
        refreshTokenHash: this.hashToken(refreshToken),
        device: input.device,
        ip: input.ip,
        userAgent: input.userAgent,
        expiresAt,
      },
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      sid: sessionId,
      tenantId: selectedMembership.tenantId,
      role: roleCode,
      typ: 'access',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(isClientFirstLogin
          ? {
              bootstrapTokenHash: null,
              bootstrapTokenExpiresAt: null,
            }
          : {}),
      },
    });

    await this.logAudit(
      selectedMembership.tenantId,
      user.id,
      'LOGIN',
      'auth',
      null,
      {
        sessionId,
        role: roleCode,
      },
      input.ip,
      input.userAgent,
    );

    return {
      twoFactorSetupRequired: requiresTwoFactor(roleCode) && !user.twoFactorEnabled,
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: selectedMembership.tenantId,
        role: roleCode,
        tradeName: selectedMembership.tenant.tradeName,
      },
    };
  }

  async refresh(input: RefreshInput) {
    const payload = this.verifyRefreshToken(input.refreshToken);

    // Database lock and cached rotation result are shared by every API/BFF replica.
    // Return denials from the transaction so revocation is committed before throwing.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refresh:${payload.sid}`}))`;
      return this.rotateRefresh(tx, input, payload);
    });
    if ('denied' in result) throw new UnauthorizedException(result.denied);
    return result;
  }

  private async rotateRefresh(
    tx: Prisma.TransactionClient,
    input: RefreshInput,
    payload: RefreshPayload,
  ) {
    const session = await tx.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException('Refresh session is invalid.');
    }

    const membership = session.tenantId
      ? await tx.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId: session.userId,
              tenantId: session.tenantId,
            },
          },
          include: { role: true, tenant: true },
        })
      : null;

    if (session.tenantId && !membership) {
      await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { denied: 'Tenant membership is no longer valid.' };
    }
    if (membership && (membership.tenant.status !== 'ACTIVE' || membership.tenant.deletedAt)) {
      await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { denied: 'Tenant is inactive or suspended.' };
    }

    const roleCode = membership?.role.code ?? null;
    if (membership && !isActiveRole(roleCode))
      throw new UnauthorizedException('Perfil de acesso descontinuado ou inválido.');

    const inputHash = this.hashToken(input.refreshToken);
    if (session.refreshTokenHash !== inputHash) {
      if (
        session.previousRefreshTokenHash === inputHash &&
        session.refreshResponseEnc &&
        session.refreshResponseExpiresAt &&
        session.refreshResponseExpiresAt > new Date()
      ) {
        const cached = JSON.parse(decryptSecret(session.refreshResponseEnc)) as {
          accessToken: string;
          refreshToken: string;
          sessionId: string;
          tenantId: string | null;
          role: string | null;
        };
        // Do not replay permissions cached before a membership role change.
        cached.role = roleCode;
        cached.accessToken = this.signAccessToken({
          sub: session.userId,
          sid: session.id,
          tenantId: session.tenantId,
          role: roleCode,
          typ: 'access',
        });
        return cached;
      }
      await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { denied: 'Refresh token mismatch.' };
    }

    const nextRefreshToken = this.signRefreshToken({
      sub: session.userId,
      sid: session.id,
      jti: randomUUID(),
      typ: 'refresh',
    });
    const nextExpiresAt = this.refreshExpiresAt();

    const rotated = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null, refreshTokenHash: session.refreshTokenHash },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt: nextExpiresAt,
        previousRefreshTokenHash: inputHash,
        refreshResponseEnc: null,
        refreshResponseExpiresAt: null,
      },
    });

    if (rotated.count !== 1) {
      await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { denied: 'Refresh token already used.' };
    }

    const accessToken = this.signAccessToken({
      sub: session.userId,
      sid: session.id,
      tenantId: session.tenantId,
      role: roleCode,
      typ: 'access',
    });
    const response = {
      accessToken,
      refreshToken: nextRefreshToken,
      sessionId: session.id,
      tenantId: session.tenantId,
      role: roleCode,
    };
    await tx.session.update({
      where: { id: session.id },
      data: {
        refreshResponseEnc: encryptSecret(JSON.stringify(response)),
        refreshResponseExpiresAt: new Date(Date.now() + 15_000),
      },
    });
    return response;
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.logAudit(session?.tenantId ?? null, userId, 'LOGOUT', 'auth', sessionId, {
        scope: 'single',
      });
      return { revoked: 'single', sessionId };
    }

    const activeSessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, tenantId: true },
    });

    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit(activeSessions[0]?.tenantId ?? null, userId, 'LOGOUT', 'auth', null, {
      scope: 'all',
      sessionsRevoked: result.count,
    });

    return { revoked: 'all' };
  }

  issueSocketToken(
    userId: string,
    sessionId: string,
    tenantId: string | null,
    role: string | null,
  ) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET não configurada');
    return {
      token: sign(
        {
          sub: userId,
          sid: sessionId,
          tenantId,
          role,
          typ: 'socket',
        },
        secret,
        { expiresIn: 60 },
      ),
      expiresIn: 60,
    };
  }

  async revokeAllSessionsForUser(targetUserId: string, requesterId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found.');

    const activeSessions = await this.prisma.session.findMany({
      where: { userId: targetUserId, revokedAt: null },
      select: { id: true, tenantId: true },
    });

    const result = await this.prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit(
      activeSessions[0]?.tenantId ?? null,
      requesterId,
      'LOGOUT',
      'user',
      targetUserId,
      {
        scope: 'admin-revoke-all',
        targetUserId,
        sessionsRevoked: result.count,
      },
    );

    return { revokedSessions: result.count, targetUserId };
  }

  async listActiveSessions(userId: string, currentSessionId?: string) {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        device: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async listTenantUserSessions(tenantId: string, targetUserId: string) {
    const now = new Date();
    const membership = await this.prisma.userTenant.findFirst({
      where: { tenantId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Usuário não pertence a este tenant.');
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: targetUserId,
        tenantId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        device: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions;
  }

  async revokeSession(
    sessionId: string,
    actorUserId: string,
    role?: string | null,
    tenantId?: string | null,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, tenantId: true, revokedAt: true },
    });

    if (!session) {
      throw new NotFoundException('Sessão não encontrada.');
    }

    const isOwner = session.userId === actorUserId;
    const isSuperAdmin = role === 'super_admin';
    const isGerente = role === 'gerente' && session.tenantId === tenantId;

    if (!isOwner && !isSuperAdmin && !isGerente) {
      throw new ForbiddenException('Sem permissão para revogar esta sessão.');
    }

    if (!session.revokedAt) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });

      await this.logAudit(session.tenantId, actorUserId, 'LOGOUT', 'session', sessionId, {
        scope: 'session-revoke',
        targetUserId: session.userId,
        revokedByActorId: actorUserId,
      });
    }

    return { success: true, sessionId };
  }

  async me(userId: string, tenantId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          include: {
            tenant: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const selectedTenant = tenantId
      ? user.tenants.find((t) => t.tenantId === tenantId)
      : user.tenants[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      customerId: selectedTenant?.role.code === 'cliente' ? selectedTenant.customerId : null,
      tenant: selectedTenant
        ? {
            id: selectedTenant.tenant.id,
            tradeName: selectedTenant.tenant.tradeName,
            role: selectedTenant.role.code,
          }
        : null,
    };
  }

  async updateMe(
    userId: string,
    tenantId: string | null,
    currentSessionId: string,
    input: UpdateMeInput,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const patch: Prisma.UserUpdateInput = {};

    const nextName = input.name?.trim();
    if (nextName) patch.name = nextName;

    const nextEmail = input.email?.trim().toLowerCase();
    const emailChanged = !!nextEmail && nextEmail !== user.email.toLowerCase();
    if (emailChanged) patch.email = nextEmail;

    // Trocar e-mail ou senha exige a senha atual: com uma sessão roubada não dá para
    // assumir a conta trocando o e-mail e pedindo recuperação de senha (C-048).
    if (input.newPassword || emailChanged) {
      const validCurrentPassword = await compare(input.currentPassword || '', user.passwordHash);
      if (!validCurrentPassword) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }
    }
    if (input.newPassword) patch.passwordHash = await hash(input.newPassword, 12);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No profile field was provided.');
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: patch,
      });
      if (input.newPassword || emailChanged) {
        await this.prisma.session.updateMany({
          where: { userId, revokedAt: null, id: { not: currentSessionId } },
          data: { revokedAt: new Date() },
        });
      }
    } catch (error) {
      if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Email already in use by another account.');
      }
      throw error;
    }

    await this.logAudit(tenantId, userId, 'UPDATE_USER', 'user_profile', userId, {
      changedFields: Object.keys(patch).filter((field) => field !== 'passwordHash'),
      passwordChanged: !!input.newPassword,
    });

    return this.me(userId, tenantId);
  }

  private signAccessToken(payload: AccessPayload) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET não configurada');
    const expiresIn = this.parseAccessTtlToSeconds(process.env.JWT_ACCESS_TTL || '15m');
    return sign(payload, secret, { expiresIn });
  }

  private signRefreshToken(payload: RefreshPayload) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET não configurada');
    const expiresIn = Number(process.env.JWT_REFRESH_TTL_DAYS || 7) * 24 * 60 * 60;
    return sign(payload, secret, { expiresIn });
  }

  private verifyRefreshToken(token: string): RefreshPayload {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET não configurada');

    try {
      const payload = verify(token, secret) as RefreshPayload;
      if (payload.typ !== 'refresh' || !payload.sub || !payload.sid || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token payload.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  private refreshExpiresAt() {
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
    const ms = days * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseAccessTtlToSeconds(ttl: string) {
    if (ttl.endsWith('m')) return Number(ttl.slice(0, -1)) * 60;
    if (ttl.endsWith('h')) return Number(ttl.slice(0, -1)) * 60 * 60;
    if (ttl.endsWith('d')) return Number(ttl.slice(0, -1)) * 24 * 60 * 60;
    const numeric = Number(ttl);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 15 * 60;
  }

  /** Delega ao AuditService centralizado — única fonte de verdade para logs de auditoria. */
  async logAudit(
    tenantId: string | null,
    actorUserId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown>,
    ip?: string,
    userAgent?: string,
  ) {
    await this.audit.log(tenantId, actorUserId, action, resourceType, resourceId, metadata, {
      ip,
      userAgent,
    });
  }

  private passwordFingerprint(passwordHash: string) {
    return createHash('sha256').update(passwordHash).digest('hex');
  }

  private verifyResetToken(token: string): { sub: string; pwd: string } {
    try {
      const secret = process.env.JWT_RESET_SECRET;
      if (!secret) throw new Error('JWT_RESET_SECRET não configurada');
      const payload = verify(token, secret) as { sub: string; typ: string; pwd: string };
      if (payload.typ !== 'reset' || !payload.sub || !payload.pwd) throw new Error();
      return { sub: payload.sub, pwd: payload.pwd };
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token.');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && user.status === 'ACTIVE') {
      const secret = process.env.JWT_RESET_SECRET;
      if (!secret) throw new Error('JWT_RESET_SECRET não configurada');
      const resetToken = sign(
        { sub: user.id, typ: 'reset', pwd: this.passwordFingerprint(user.passwordHash) },
        secret,
        {
          expiresIn: '1h',
        },
      );

      const resetLink = `${process.env.WEB_BASE_URL || 'http://localhost:8070'}/reset-password?token=${resetToken}`;
      this.emailService.sendEmail(
        user.email,
        'Ajust ERP - Recuperação de Senha',
        `Você solicitou a recuperação de senha. Acesse o link para redefinir: ${resetLink}`,
      );

      await this.logAudit(null, user.id, 'UPDATE_USER', 'user', user.id, {
        action: 'forgot_password_requested',
        description: 'Usuário solicitou redefinição de senha via email.',
      });
    }

    return { message: 'Se o e-mail existir e estiver ativo, um link de recuperação foi enviado.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = this.verifyResetToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, deletedAt: true, passwordHash: true },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      payload.pwd !== this.passwordFingerprint(user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid user.');
    }

    const passwordHash = await hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit(null, user.id, 'UPDATE_USER', 'user', user.id, {
      action: 'password_reset_completed',
    });

    return { success: true };
  }

  /**
   * Complete 2FA verification and return actual login tokens
   * Called after user provides valid TOTP code in temporary 2FA session
   */
  async verify2FA(temporaryToken: string, totpCode: string, ip?: string, userAgent?: string) {
    let payload: any;
    try {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) throw new Error('JWT_ACCESS_SECRET não configurada');
      payload = verify(temporaryToken, secret) as {
        sub: string;
        sid: string;
        tenantId: string;
        typ: string;
      };

      if (payload.typ !== '2fa-pending') {
        throw new UnauthorizedException('Invalid token type. Expected 2FA pending token.');
      }
    } catch (_error) {
      throw new UnauthorizedException('Invalid or expired 2FA token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenants: { include: { role: true, tenant: true } } },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecretEnc
    ) {
      throw new UnauthorizedException('2FA not enabled for this user.');
    }

    const temporarySession = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (
      !temporarySession ||
      temporarySession.userId !== user.id ||
      temporarySession.tenantId !== payload.tenantId ||
      temporarySession.revokedAt ||
      temporarySession.expiresAt < new Date() ||
      temporarySession.refreshTokenHash !== this.hashToken(temporaryToken)
    ) {
      throw new UnauthorizedException('Invalid or expired 2FA session.');
    }

    const membership = user.tenants.find((tenant) => tenant.tenantId === payload.tenantId);
    if (!membership) {
      throw new ForbiddenException('User has no tenant membership.');
    }
    if (membership.tenant.status !== 'ACTIVE' || membership.tenant.deletedAt) {
      throw new ForbiddenException('Tenant is inactive or suspended.');
    }

    // Match the counter, then consume it atomically with the temporary session.
    let counter: number;
    try {
      const decryptedSecret = this.decryptSecret2FA(user.twoFactorSecretEnc);
      const matched = this.totpService.matchCounter(decryptedSecret, totpCode);

      if (matched === null) {
        await this.logAudit(
          payload.tenantId,
          user.id,
          'LOGIN_FAILED',
          'auth',
          null,
          {
            reason: 'invalid_totp_code',
          },
          ip,
          userAgent,
        );
        throw new UnauthorizedException('Código 2FA inválido.');
      }
      counter = matched;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Failed to verify 2FA code.');
    }

    // Create full session (replace temporary 2FA session)
    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken({
      sub: user.id,
      sid: sessionId,
      jti: randomUUID(),
      typ: 'refresh',
    });
    const expiresAt = this.refreshExpiresAt();

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.user.updateMany({
        where: {
          id: user.id,
          twoFactorEnabled: true,
          twoFactorSecretEnc: user.twoFactorSecretEnc,
          OR: [{ twoFactorLastCounter: null }, { twoFactorLastCounter: { lt: counter } }],
        },
        data: { twoFactorLastCounter: counter },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException('Código 2FA já utilizado. Aguarde o próximo código.');
      const pending = await tx.session.deleteMany({
        where: {
          id: payload.sid,
          userId: user.id,
          revokedAt: null,
          refreshTokenHash: this.hashToken(temporaryToken),
          expiresAt: { gt: new Date() },
        },
      });
      if (pending.count !== 1) throw new UnauthorizedException('Sessão 2FA inválida ou expirada.');
      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          tenantId: payload.tenantId,
          refreshTokenHash: this.hashToken(refreshToken),
          ip,
          userAgent,
          expiresAt,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          bootstrapTokenHash: null,
          bootstrapTokenExpiresAt: null,
        },
      });
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      sid: sessionId,
      tenantId: payload.tenantId,
      role: membership.role.code,
      typ: 'access',
    });

    await this.logAudit(
      payload.tenantId,
      user.id,
      'LOGIN',
      'auth',
      null,
      {
        sessionId,
        method: '2fa',
      },
      ip,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: payload.tenantId,
        role: membership.role.code,
        tradeName: membership.tenant.tradeName,
      },
    };
  }

  /**
   * Decrypt 2FA secret (using AES-256-GCM)
   */
  private decryptSecret2FA(encrypted: string): string {
    return decryptSecret(encrypted);
  }
}
