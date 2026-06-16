import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { ForgotPasswordRateLimitGuard } from './forgot-password-rate-limit.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('ForgotPasswordRateLimitGuard', () => {
  const redis = {
    get: jest.fn(),
    incrEx: jest.fn(),
    set: jest.fn(),
  };
  let guard: ForgotPasswordRateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    redis.get.mockResolvedValue(null);
    redis.incrEx.mockResolvedValue(1);
    redis.set.mockResolvedValue(undefined);
    guard = new ForgotPasswordRateLimitGuard(redis as unknown as RedisService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes email and ignores spoofable forwarded IP headers', async () => {
    const context = makeContext({
      body: { email: 'User@Example.COM' },
      headers: { 'x-forwarded-for': '203.0.113.20, 10.0.0.1' },
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(redis.incrEx).toHaveBeenCalledWith(
      'rate-limit:forgot-password:127.0.0.1:user@example.com',
      60 * 60,
    );
  });

  it('rejects existing lockouts', async () => {
    redis.get.mockResolvedValue('1');

    await expect(
      guard.canActivate(makeContext({ body: {}, headers: {}, ip: '127.0.0.1' })),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('creates a lockout after the attempt limit', async () => {
    redis.incrEx.mockResolvedValue(4);
    const context = makeContext({
      body: { email: 'user@example.com' },
      headers: {},
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(redis.set).toHaveBeenCalledWith(
      'rate-limit:forgot-password:lockout:127.0.0.1:user@example.com',
      '1',
      15 * 60,
    );
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));

    try {
      await guard.canActivate(makeContext({ body: {}, headers: {}, ip: '127.0.0.1' }));
      throw new Error('Expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    }
  });
});
