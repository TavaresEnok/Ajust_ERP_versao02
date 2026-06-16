import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EmailService } from '../common/email.service';
import { TotpService } from './totp.service';
import { BootstrapTokenService } from './bootstrap-token.service';
import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(),
  randomUUID: jest.fn(),
}));

const mockCompare = compare as jest.Mock;
const mockHash = hash as jest.Mock;
const mockSign = sign as jest.Mock;
const mockVerify = verify as jest.Mock;
const mockRandomUUID = randomUUID as jest.Mock;
const mockCreateHash = createHash as jest.Mock;

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '$2a$12$hashedpassword',
    status: 'ACTIVE',
    deletedAt: null,
    lastLoginAt: new Date(),
    twoFactorEnabled: false,
    twoFactorSecretEnc: null,
    bootstrapTokenHash: null,
    bootstrapTokenExpiresAt: null,
    tenants: [
      {
        tenantId: 'tenant-1',
        role: { code: 'gerente', name: 'Gerente', id: 'role-1' },
        tenant: {
          id: 'tenant-1',
          tradeName: 'Test Corp',
          taxId: '12345678000199',
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
    ],
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    refreshTokenHash: 'hashed-refresh-token',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    device: null,
    ip: null,
    userAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      status: 'ACTIVE',
      deletedAt: null,
    },
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockBootstrapToken: any;
  let mockEmail: any;

  function createHashMock() {
    const hashMock = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed-refresh-token'),
    };
    mockCreateHash.mockReturnValue(hashMock);
    return hashMock;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockSign.mockReset();
    mockVerify.mockReset();

    mockRandomUUID.mockReturnValue('session-1');

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    mockEmail = {
      sendEmail: jest.fn(),
    };
    mockBootstrapToken = {
      isExpired: jest.fn().mockReturnValue(false),
      verifyToken: jest.fn().mockReturnValue(true),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
      },
      session: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      userTenant: {
        findUnique: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    createHashMock();

    service = new AuthService(
      mockPrisma as PrismaService,
      mockAudit as AuditService,
      mockEmail as EmailService,
      {} as TotpService,
      mockBootstrapToken as BootstrapTokenService,
    );
  });

  // ──────────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────────

  describe('login', () => {
    const loginInput = {
      identifier: 'test@example.com',
      password: 'mypassword',
      tenantId: 'tenant-1',
      device: 'desktop',
      ip: '127.0.0.1',
      userAgent: 'jest',
    };

    it('Login with valid email/password returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValueOnce('refresh-token-value').mockReturnValueOnce('access-token-value');

      const result = await service.login(loginInput);

      expect(result.accessToken).toBe('access-token-value');
      expect(result.refreshToken).toBe('refresh-token-value');
      expect(result.sessionId).toBe('session-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.tenantId).toBe('tenant-1');
      expect(result.user.role).toBe('gerente');
    });

    it('Login with invalid password throws UnauthorizedException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockCompare.mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
    });

    it('Login with non-existent user throws UnauthorizedException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
    });

    it('requires validated OTP token on first client access by CNPJ', async () => {
      const client = makeUser({
        lastLoginAt: null,
        bootstrapTokenHash: 'bootstrap-hash',
        bootstrapTokenExpiresAt: new Date(Date.now() + 60_000),
        tenants: [
          {
            tenantId: 'tenant-1',
            role: { code: 'cliente' },
            tenant: { id: 'tenant-1', tradeName: 'Test Corp', status: 'ACTIVE', deletedAt: null },
          },
        ],
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        users: [{ role: { code: 'cliente' }, user: client }],
      });

      await expect(
        service.login({ identifier: '12345678000199', password: 'NewPassword@123' }),
      ).rejects.toThrow('Valide o código');
    });

    it('consumes bootstrap token after successful first client access', async () => {
      const client = makeUser({
        lastLoginAt: null,
        bootstrapTokenHash: 'bootstrap-hash',
        bootstrapTokenExpiresAt: new Date(Date.now() + 60_000),
        tenants: [
          {
            tenantId: 'tenant-1',
            role: { code: 'cliente' },
            tenant: { id: 'tenant-1', tradeName: 'Test Corp', status: 'ACTIVE', deletedAt: null },
          },
        ],
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        users: [{ role: { code: 'cliente' }, user: client }],
      });
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValueOnce('refresh-token').mockReturnValueOnce('access-token');

      await service.login({
        identifier: '12345678000199',
        password: 'NewPassword@123',
        bootstrapToken: 'bootstrap-token',
      });

      expect(mockBootstrapToken.verifyToken).toHaveBeenCalledWith(
        'bootstrap-token',
        'bootstrap-hash',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          bootstrapTokenHash: null,
          bootstrapTokenExpiresAt: null,
        }),
      });
    });
  });

  // ──────────────────────────────────────────────────
  // REFRESH
  // ──────────────────────────────────────────────────

  describe('refresh', () => {
    const refreshPayload = {
      sub: 'user-1',
      sid: 'session-1',
      jti: 'jti-1',
      typ: 'refresh',
    };

    it('Refresh with valid refresh token returns new tokens', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(makeSession());
      mockPrisma.userTenant.findUnique.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: { code: 'gerente' },
        tenant: { status: 'ACTIVE', deletedAt: null },
      });
      createHashMock();
      mockSign.mockReturnValueOnce('new-refresh-token').mockReturnValueOnce('new-access-token');

      const result = await service.refresh({ refreshToken: 'valid-refresh' });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.sessionId).toBe('session-1');
      expect(mockVerify).toHaveBeenCalledWith('valid-refresh', expect.any(String));
    });

    it('Refresh with revoked session throws UnauthorizedException', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(makeSession({ revokedAt: new Date() }));
      createHashMock();

      await expect(service.refresh({ refreshToken: 'revoked-refresh' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Refresh with expired session throws UnauthorizedException', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(
        makeSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      createHashMock();

      await expect(service.refresh({ refreshToken: 'expired-refresh' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Refresh rejects inactive users', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(
        makeSession({ user: { status: 'INACTIVE', deletedAt: null } }),
      );

      await expect(service.refresh({ refreshToken: 'inactive-user-refresh' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Refresh rejects removed tenant membership and revokes session', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(makeSession());
      mockPrisma.userTenant.findUnique.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'orphan-refresh' })).rejects.toThrow(
        'Tenant membership is no longer valid',
      );
      expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    });

    it('Refresh rejects inactive tenants and revokes session', async () => {
      mockVerify.mockReturnValue(refreshPayload);
      mockPrisma.session.findUnique.mockResolvedValue(makeSession());
      mockPrisma.userTenant.findUnique.mockResolvedValue({
        role: { code: 'gerente' },
        tenant: { status: 'SUSPENDED', deletedAt: null },
      });

      await expect(service.refresh({ refreshToken: 'suspended-tenant-refresh' })).rejects.toThrow(
        'Tenant is inactive or suspended',
      );
      expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    });
  });

  describe('password reset', () => {
    beforeEach(() => {
      process.env.JWT_RESET_SECRET = 'test-reset-secret';
    });

    it('issues a reset token bound to the current password hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockSign.mockReturnValue('reset-token');

      await service.forgotPassword('test@example.com');

      expect(mockSign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          typ: 'reset',
          pwd: 'hashed-refresh-token',
        }),
        'test-reset-secret',
        { expiresIn: '1h' },
      );
      expect(mockEmail.sendEmail).toHaveBeenCalled();
    });

    it('changes the password once and revokes all active sessions', async () => {
      mockVerify.mockReturnValue({
        sub: 'user-1',
        typ: 'reset',
        pwd: 'hashed-refresh-token',
      });
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockHash.mockResolvedValue('new-password-hash');

      await expect(service.resetPassword('reset-token', 'NewPassword@123')).resolves.toEqual({
        success: true,
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-password-hash' },
      });
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects a reset token after the password hash changes', async () => {
      mockVerify.mockReturnValue({
        sub: 'user-1',
        typ: 'reset',
        pwd: 'old-password-fingerprint',
      });
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.resetPassword('used-reset-token', 'NewPassword@123')).rejects.toThrow(
        'Invalid user',
      );
    });
  });

  // ──────────────────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────────────────

  describe('logout', () => {
    it('Logout revokes session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(makeSession({ tenantId: 'tenant-1' }));
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-1', 'session-1');

      expect(result.revoked).toBe('single');
      expect(result.sessionId).toBe('session-1');
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // ──────────────────────────────────────────────────
  // ACCESS TOKEN PAYLOAD
  // ──────────────────────────────────────────────────

  describe('access token payload', () => {
    it('JWT access token contains correct payload (sub, sid, tenantId, role, typ)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockCompare.mockResolvedValue(true);

      let capturedPayload: any = null;
      mockSign.mockImplementation((payload: any, _secret: string, _opts: any) => {
        if (capturedPayload === null && payload.typ === 'refresh') {
          return 'refresh-token';
        }
        if (payload.typ === 'access') {
          capturedPayload = payload;
        }
        return 'access-token';
      });

      await service.login({
        identifier: 'test@example.com',
        password: 'mypassword',
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.sub).toBe('user-1');
      expect(capturedPayload.sid).toBe('session-1');
      expect(capturedPayload.tenantId).toBe('tenant-1');
      expect(capturedPayload.role).toBe('gerente');
      expect(capturedPayload.typ).toBe('access');
    });
  });

  // ──────────────────────────────────────────────────
  // PASSWORD HASHING
  // ──────────────────────────────────────────────────

  describe('password hashing', () => {
    it('Password hashing uses bcrypt (not plain text)', async () => {
      mockHash.mockResolvedValue('$2a$12$hashedbybcrypt');

      mockPrisma.user.findUnique.mockResolvedValue(
        makeUser({
          passwordHash: '$2a$12$hashedbybcrypt',
        }),
      );
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValueOnce('refresh-token').mockReturnValueOnce('access-token');

      await service.login({
        identifier: 'test@example.com',
        password: 'mypassword',
      });

      expect(mockCompare).toHaveBeenCalledWith('mypassword', '$2a$12$hashedbybcrypt');
    });

    it('verify bcrypt.compare receives password and hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockCompare.mockResolvedValue(false);

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockCompare).toHaveBeenCalledWith('wrongpassword', '$2a$12$hashedpassword');
      expect(mockCompare).toHaveBeenCalledTimes(1);
    });
  });
});
