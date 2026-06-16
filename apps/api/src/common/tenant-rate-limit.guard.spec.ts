import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from './redis.service';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';

function makeContext(auth?: { tenantId: string | null; userId: string }): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        auth,
        method: 'GET',
        route: { path: '/reports' },
        path: '/reports',
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('TenantRateLimitGuard', () => {
  const redis = { incrEx: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: TenantRateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.incrEx.mockResolvedValue(1);
    reflector.getAllAndOverride.mockReturnValue({ limit: 2, windowSeconds: 60 });
    guard = new TenantRateLimitGuard(
      redis as unknown as RedisService,
      reflector as unknown as Reflector,
    );
  });

  it('allows endpoints without rate-limit metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(redis.incrEx).not.toHaveBeenCalled();
  });

  it('uses tenant scope when authenticated', async () => {
    await expect(
      guard.canActivate(makeContext({ tenantId: 'tenant-1', userId: 'user-1' })),
    ).resolves.toBe(true);
    expect(redis.incrEx).toHaveBeenCalledWith('rate-limit:tenant:tenant-1:GET:/reports', 60);
  });

  it('rejects requests above the configured limit', async () => {
    redis.incrEx.mockResolvedValue(3);

    await expect(
      guard.canActivate(makeContext({ tenantId: 'tenant-1', userId: 'user-1' })),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.incrEx.mockRejectedValue(new Error('Redis unavailable'));

    try {
      await guard.canActivate(makeContext({ tenantId: null, userId: 'user-1' }));
      throw new Error('Expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    }
  });
});
