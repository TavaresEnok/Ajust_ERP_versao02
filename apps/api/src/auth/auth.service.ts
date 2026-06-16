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
import { decryptSecret } from '../common/secrets.crypto';
import { TotpService } from './totp.service';
import { BootstrapTokenService } from './bootstrap-token.service';

type LoginInput = {
  identifier: string;
  password: string;
  bootstrapToken?: string;
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

    // 2) Fallback de "usuario": nome exato (case-insensitive)
    // ou prefixo do e-mail antes do @ (ex.: "gerente" => gerente@dominio).
    if (!user && numericId.length < 11) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { name: { equals: rawId, mode: 'insensitive' } },
            { email: { startsWith: `${lId}@`, mode: 'insensitive' } },
          ],
        },
        include: { tenants: { include: { role: true, tenant: true } } },
      });
    }

    let usedCnpjFallback = false;
    let foundTenantId: string | null = null;

    // 3) Fallback por CPF/CNPJ (aceita valor mascarado e somente numeros).
    if (!user) {
      if (numericId.length >= 11) {
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            OR: [{ taxId: numericId }, { taxId: rawId }],
          },
          include: {
            users: {
              include: {
                user: { include: { tenants: { include: { role: true, tenant: true } } } },
                role: true,
              },
            },
          },
        });

        if (tenant && tenant.users.length > 0) {
          // Prioriza usuario cliente para fluxo de login por CNPJ.
          const preferredClientMembership = tenant.users.find(
            (membership) =>
              membership.role.code === 'cliente' &&
              membership.user.status === 'ACTIVE' &&
              !membership.user.deletedAt,
          );
          if (preferredClientMembership) {
            user = preferredClientMembership.user;
            usedCnpjFallback = true;
            foundTenantId = tenant.id;
          }
        }
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
      throw new UnauthorizedException('Invalid credentials.');
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
    const isClientFirstLogin = roleCode === 'cliente' && !user.lastLoginAt;

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
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (selectedMembership.tenant.status !== 'ACTIVE' || selectedMembership.tenant.deletedAt) {
      throw new ForbiddenException('Tenant is inactive or suspended.');
    }

    // ✅ Check 2FA requirement for super_admin
    if (roleCode === 'super_admin' && !user.twoFactorEnabled) {
      // Log warning but don't block (UI will guide setup)
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

    const session = await this.prisma.session.findUnique({
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

    if (session.refreshTokenHash !== this.hashToken(input.refreshToken)) {
      throw new UnauthorizedException('Refresh token mismatch.');
    }

    const membership = session.tenantId
      ? await this.prisma.userTenant.findUnique({
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
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Tenant membership is no longer valid.');
    }
    if (membership && (membership.tenant.status !== 'ACTIVE' || membership.tenant.deletedAt)) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Tenant is inactive or suspended.');
    }

    const roleCode = membership?.role.code ?? null;

    const nextRefreshToken = this.signRefreshToken({
      sub: session.userId,
      sid: session.id,
      jti: randomUUID(),
      typ: 'refresh',
    });
    const nextExpiresAt = this.refreshExpiresAt();

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt: nextExpiresAt,
      },
    });

    const accessToken = this.signAccessToken({
      sub: session.userId,
      sid: session.id,
      tenantId: session.tenantId,
      role: roleCode,
      typ: 'access',
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      sessionId: session.id,
      tenantId: session.tenantId,
      role: roleCode,
    };
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
    if (nextEmail) patch.email = nextEmail;

    if (input.newPassword) {
      const validCurrentPassword = await compare(input.currentPassword || '', user.passwordHash);
      if (!validCurrentPassword) {
        throw new UnauthorizedException('Current password is invalid.');
      }
      patch.passwordHash = await hash(input.newPassword, 12);
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No profile field was provided.');
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: patch,
      });
      if (input.newPassword) {
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

    // Decrypt secret and verify TOTP code
    try {
      const decryptedSecret = this.decryptSecret2FA(user.twoFactorSecretEnc);
      const isValidCode = this.totpService.verifyCode(decryptedSecret, totpCode);

      if (!isValidCode) {
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
        throw new UnauthorizedException('Invalid 2FA code.');
      }
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

    // Delete temporary 2FA session
    await this.prisma.session
      .delete({
        where: { id: payload.sid },
      })
      .catch(() => {}); // Ignore if not found

    // Create real session
    await this.prisma.session.create({
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

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        bootstrapTokenHash: null,
        bootstrapTokenExpiresAt: null,
      },
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
