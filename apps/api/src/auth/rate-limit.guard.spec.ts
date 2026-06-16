import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { RateLimitGuard } from './rate-limit.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const redis = {
    get: jest.fn(),
    incrEx: jest.fn(),
    set: jest.fn(),
  };
  let guard: RateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.incrEx.mockResolvedValue(1);
    redis.set.mockResolvedValue(undefined);
    guard = new RateLimitGuard(redis as unknown as RedisService);
  });

  it('uses the trusted Express client IP instead of spoofable forwarded headers', async () => {
    const context = makeContext({
      body: { email: 'user@example.com' },
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(redis.incrEx).toHaveBeenCalledWith(
      'rate-limit:login:127.0.0.1:user@example.com',
      15 * 60,
    );
  });

  it('locks out requests after the attempt limit', async () => {
    redis.incrEx.mockResolvedValue(6);
    const context = makeContext({
      body: { identifier: 'user@example.com' },
      headers: {},
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(redis.set).toHaveBeenCalledWith(
      'rate-limit:login:lockout:127.0.0.1:user@example.com',
      '1',
      15 * 60,
    );
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));
    const context = makeContext({ body: {}, headers: {}, ip: '127.0.0.1' });

    try {
      await guard.canActivate(context);
      throw new Error('Expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    }
  });
});
