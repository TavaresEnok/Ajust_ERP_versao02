import { ExecutionContext, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { RedisService } from '../common/redis.service';
import { TwoFactorRateLimitGuard } from './two-factor-rate-limit.guard';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const mockVerify = verify as jest.Mock;

function makeContext(body: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  } as ExecutionContext;
}

describe('TwoFactorRateLimitGuard', () => {
  const redis = {
    get: jest.fn(),
    incrEx: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  let guard: TwoFactorRateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    mockVerify.mockReturnValue({ sub: 'user-1', sid: 'session-1', typ: '2fa-pending' });
    redis.get.mockResolvedValue(null);
    redis.incrEx.mockResolvedValue(1);
    redis.set.mockResolvedValue(undefined);
    redis.del.mockResolvedValue(1);
    guard = new TwoFactorRateLimitGuard(redis as unknown as RedisService);
  });

  it('rejects missing, invalid, and wrong-type temporary tokens', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);

    mockVerify.mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    await expect(guard.canActivate(makeContext({ temporaryToken: 'invalid' }))).rejects.toThrow(
      'Invalid temporary token',
    );

    mockVerify.mockReturnValueOnce({ sub: 'user-1', typ: 'access' });
    await expect(guard.canActivate(makeContext({ temporaryToken: 'wrong-type' }))).rejects.toThrow(
      'Invalid token type',
    );
  });

  it('allows the first attempt without artificial backoff', async () => {
    const timer = jest.spyOn(global, 'setTimeout');

    await expect(guard.canActivate(makeContext({ temporaryToken: 'valid' }))).resolves.toBe(true);

    expect(redis.incrEx).toHaveBeenCalledWith('2fa-attempts:session-1', 15 * 60);
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });

  it('rejects existing lockouts', async () => {
    redis.get.mockResolvedValue('1');

    await expect(guard.canActivate(makeContext({ temporaryToken: 'valid' }))).rejects.toMatchObject(
      { status: HttpStatus.TOO_MANY_REQUESTS },
    );
  });

  it('locks the user after the maximum attempts', async () => {
    redis.incrEx.mockResolvedValue(4);

    await expect(guard.canActivate(makeContext({ temporaryToken: 'valid' }))).rejects.toMatchObject(
      { status: HttpStatus.TOO_MANY_REQUESTS },
    );
    expect(redis.set).toHaveBeenCalledWith('2fa-lockout:session-1', '1', 15 * 60);
    expect(redis.del).toHaveBeenCalledWith('2fa-attempts:session-1');
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));

    try {
      await guard.canActivate(makeContext({ temporaryToken: 'valid' }));
      throw new Error('Expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    }
  });
});
