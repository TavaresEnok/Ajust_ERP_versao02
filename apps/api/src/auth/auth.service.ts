import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

type LoginInput = {
  identifier: string;
  password: string;
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
  typ: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  async login(input: LoginInput) {
    const rawId = input.identifier.trim();
    const lId = rawId.toLowerCase();
    const numericId = rawId.replace(/\D/g, '');

    // 1) Preferencia por e-mail exato.
    let user = await this.prisma.user.findUnique({
      where: { email: lId },
      include: { tenants: { include: { role: true } } }
    });

    // 2) Fallback de "usuario": nome exato (case-insensitive)
    // ou prefixo do e-mail antes do @ (ex.: "gerente" => gerente@dominio).
    if (!user && numericId.length < 11) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { name: { equals: rawId, mode: 'insensitive' } },
            { email: { startsWith: `${lId}@`, mode: 'insensitive' } }
          ]
        },
        include: { tenants: { include: { role: true } } }
      });
    }

    let usedCnpjFallback = false;
    let foundTenantTaxId: string | null = null;

    // 3) Fallback por CPF/CNPJ (aceita valor mascarado e somente numeros).
    if (!user) {
      if (numericId.length >= 11) {
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            OR: [{ taxId: numericId }, { taxId: rawId }]
          },
          include: { users: { include: { user: { include: { tenants: { include: { role: true } } } }, role: true } } }
        });

        if (tenant && tenant.users.length > 0) {
          // Prioriza usuario cliente para fluxo de login por CNPJ.
          const preferredClientMembership = tenant.users.find((membership) =>
            membership.role.code === 'cliente' &&
            membership.user.status === 'ACTIVE' &&
            !membership.user.deletedAt
          );
          user = preferredClientMembership?.user || tenant.users[0].user;
          usedCnpjFallback = true;
          foundTenantTaxId = numericId;
        }
      }
    }

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      await this.logAudit(null, null, 'LOGIN_FAILED', 'auth', null, {
        identifier: input.identifier,
        reason: 'user_not_found_or_inactive'
      }, input.ip, input.userAgent);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isFirstLogin = !user.lastLoginAt;
    const hasClientMembership = user.tenants.some((membership) => membership.role.code === 'cliente');

    // Cliente no primeiro acesso deve autenticar pelo CNPJ.
    if (hasClientMembership && isFirstLogin && !usedCnpjFallback) {
      await this.logAudit(null, user.id, 'LOGIN_FAILED', 'auth', null, {
        identifier: input.identifier,
        reason: 'client_first_login_requires_cnpj'
      }, input.ip, input.userAgent);
      throw new UnauthorizedException('Primeiro acesso do cliente deve ser via CNPJ.');
    }

    // 4) Validar senha principal.
    let validPassword = await compare(input.password, user.passwordHash);
    let usedBootstrapPassword = false;

    // 5) Fallback inicial para cliente por CNPJ: apenas no primeiro acesso.
    if (!validPassword && usedCnpjFallback && foundTenantTaxId && isFirstLogin && hasClientMembership) {
      const last4 = foundTenantTaxId.slice(-4);
      if (input.password === last4) {
        validPassword = true;
        usedBootstrapPassword = true;
      }
    }

    // No primeiro acesso do cliente, a senha obrigatoria e os 4 ultimos digitos do CNPJ.
    if (usedCnpjFallback && foundTenantTaxId && isFirstLogin && hasClientMembership) {
      const last4 = foundTenantTaxId.slice(-4);
      if (input.password !== last4) {
        validPassword = false;
      }
    }

    if (!validPassword) {
      await this.logAudit(null, user.id, 'LOGIN_FAILED', 'auth', null, {
        identifier: input.identifier,
        reason: 'invalid_password'
      }, input.ip, input.userAgent);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Se entrou via senha bootstrap (4 ultimos do CNPJ), grava hash para permitir login
    // ate o cliente alterar suas credenciais em Perfil.
    if (usedBootstrapPassword) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(input.password, 12) }
      });
    }

    const memberships = input.tenantId
      ? user.tenants.filter((t) => t.tenantId === input.tenantId)
      : user.tenants;

    if (memberships.length === 0) {
      throw new ForbiddenException('User has no tenant membership for requested scope.');
    }

    const selectedMembership = memberships[0];
    const roleCode = selectedMembership.role.code;

    if (roleCode === 'super_admin' && !user.twoFactorEnabled) {
      throw new ForbiddenException('2FA is required for super_admin accounts.');
    }

    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken({ sub: user.id, sid: sessionId, typ: 'refresh' });

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
        expiresAt
      }
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      sid: sessionId,
      tenantId: selectedMembership.tenantId,
      role: roleCode,
      typ: 'access'
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await this.logAudit(selectedMembership.tenantId, user.id, 'LOGIN', 'auth', null, {
      sessionId,
      role: roleCode
    }, input.ip, input.userAgent);

    return {
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: selectedMembership.tenantId,
        role: roleCode
      }
    };
  }

  async refresh(input: RefreshInput) {
    const payload = this.verifyRefreshToken(input.refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid }
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date()) {
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
            tenantId: session.tenantId
          }
        },
        include: { role: true }
      })
      : null;

    const roleCode = membership?.role.code ?? null;

    const nextRefreshToken = this.signRefreshToken({ sub: session.userId, sid: session.id, typ: 'refresh' });
    const nextExpiresAt = this.refreshExpiresAt();

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt: nextExpiresAt
      }
    });

    const accessToken = this.signAccessToken({
      sub: session.userId,
      sid: session.id,
      tenantId: session.tenantId,
      role: roleCode,
      typ: 'access'
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      sessionId: session.id,
      tenantId: session.tenantId,
      role: roleCode
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await this.logAudit(session?.tenantId ?? null, userId, 'LOGOUT', 'auth', sessionId, {
        scope: 'single'
      });
      return { revoked: 'single', sessionId };
    }

    const activeSessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, tenantId: true }
    });

    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await this.logAudit(activeSessions[0]?.tenantId ?? null, userId, 'LOGOUT', 'auth', null, {
      scope: 'all',
      sessionsRevoked: result.count
    });

    return { revoked: 'all' };
  }

  async me(userId: string, tenantId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          include: {
            tenant: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const selectedTenant = tenantId ? user.tenants.find((t) => t.tenantId === tenantId) : user.tenants[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      tenant: selectedTenant
        ? {
          id: selectedTenant.tenant.id,
          tradeName: selectedTenant.tenant.tradeName,
          role: selectedTenant.role.code
        }
        : null
    };
  }

  async updateMe(userId: string, tenantId: string | null, input: UpdateMeInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true
      }
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
        data: patch
      });
    } catch (error) {
      if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Email already in use by another account.');
      }
      throw error;
    }

    await this.logAudit(tenantId, userId, 'OS_UPDATE', 'user_profile', userId, {
      changedFields: Object.keys(patch).filter((field) => field !== 'passwordHash'),
      passwordChanged: !!input.newPassword
    });

    return this.me(userId, tenantId);
  }

  private signAccessToken(payload: AccessPayload) {
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
    const expiresIn = this.parseAccessTtlToSeconds(process.env.JWT_ACCESS_TTL || '15m');
    return sign(payload, secret, { expiresIn });
  }

  private signRefreshToken(payload: RefreshPayload) {
    const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
    const expiresIn = Number(process.env.JWT_REFRESH_TTL_DAYS || 7) * 24 * 60 * 60;
    return sign(payload, secret, { expiresIn });
  }

  private verifyRefreshToken(token: string): RefreshPayload {
    const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

    try {
      const payload = verify(token, secret) as RefreshPayload;
      if (payload.typ !== 'refresh' || !payload.sub || !payload.sid) {
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

  async logAudit(
    tenantId: string | null,
    actorUserId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown>,
    ip?: string,
    userAgent?: string
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        metadata: metadata as any,
        ip,
        userAgent
      }
    });
  }
}
