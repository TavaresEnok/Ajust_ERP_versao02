import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../common/request-with-auth';
import { AuthGuard } from './auth.guard';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const mockVerify = verify as jest.Mock;

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

function validSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: 'user-1', status: 'ACTIVE', deletedAt: null },
    ...overrides,
  };
}

describe('AuthGuard', () => {
  const prisma = {
    session: { findUnique: jest.fn() },
    userTenant: { findUnique: jest.fn() },
  };
  let guard: AuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    mockVerify.mockReturnValue({
      sub: 'user-1',
      sid: 'session-1',
      tenantId: 'tenant-1',
      role: 'old-role',
      typ: 'access',
    });
    prisma.session.findUnique.mockResolvedValue(validSession());
    prisma.userTenant.findUnique.mockResolvedValue({
      role: { code: 'gerente' },
      tenant: { status: 'ACTIVE', deletedAt: null },
    });
    guard = new AuthGuard(prisma as unknown as PrismaService);
  });

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(makeContext({ headers: {} as never }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid JWTs and invalid access payloads', async () => {
    const context = makeContext({ headers: { authorization: 'Bearer token' } as never });
    mockVerify.mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid or expired access token.');

    mockVerify.mockReturnValueOnce({ sub: 'user-1', sid: 'session-1', typ: '2fa-pending' });
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid access token payload.');
  });

  it.each([
    ['missing session', null],
    ['revoked session', validSession({ revokedAt: new Date() })],
    ['expired session', validSession({ expiresAt: new Date(Date.now() - 1_000) })],
    ['wrong user', validSession({ userId: 'user-2' })],
  ])('rejects an invalid session: %s', async (_label, session) => {
    prisma.session.findUnique.mockResolvedValue(session);

    await expect(
      guard.canActivate(makeContext({ headers: { authorization: 'Bearer token' } as never })),
    ).rejects.toThrow('Session is revoked, invalid, or expired.');
  });

  it('rejects tenant scope mismatch and missing membership', async () => {
    const context = makeContext({ headers: { authorization: 'Bearer token' } as never });
    prisma.session.findUnique.mockResolvedValueOnce(validSession({ tenantId: 'tenant-2' }));
    await expect(guard.canActivate(context)).rejects.toThrow('Tenant scope mismatch for session.');

    prisma.userTenant.findUnique.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'User has no membership for this tenant.',
    );
  });

  it('rejects inactive users', async () => {
    prisma.session.findUnique.mockResolvedValue(
      validSession({ user: { id: 'user-1', status: 'INACTIVE', deletedAt: null } }),
    );

    await expect(
      guard.canActivate(makeContext({ headers: { authorization: 'Bearer token' } as never })),
    ).rejects.toThrow('User is inactive or not found.');
  });

  it('rejects inactive or suspended tenants', async () => {
    prisma.userTenant.findUnique.mockResolvedValueOnce({
      role: { code: 'gerente' },
      tenant: { status: 'SUSPENDED', deletedAt: null },
    });

    await expect(
      guard.canActivate(makeContext({ headers: { authorization: 'Bearer token' } as never })),
    ).rejects.toThrow('Tenant is inactive or suspended.');
  });

  it('attaches authenticated context using the current database role', async () => {
    const request = { headers: { authorization: 'Bearer token' } } as Partial<RequestWithAuth>;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.auth).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      role: 'gerente',
    });
  });

  it('supports tenantless sessions without querying membership', async () => {
    mockVerify.mockReturnValue({
      sub: 'user-1',
      sid: 'session-1',
      tenantId: null,
      role: 'super_admin',
      typ: 'access',
    });
    prisma.session.findUnique.mockResolvedValue(validSession({ tenantId: null }));
    const request = { headers: { authorization: 'Bearer token' } } as Partial<RequestWithAuth>;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.userTenant.findUnique).not.toHaveBeenCalled();
    expect(request.auth?.role).toBe('super_admin');
  });
});
