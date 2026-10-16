import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { IxcWebhookRateLimitGuard } from './ixc-webhook-rate-limit.guard';
import { RedisService } from '../../common/redis.service';

describe('IxcWebhookRateLimitGuard', () => {
  let guard: IxcWebhookRateLimitGuard;
  let redisService: jest.Mocked<Partial<RedisService>>;

  beforeEach(() => {
    redisService = {
      incrEx: jest.fn(),
    };
    guard = new IxcWebhookRateLimitGuard(redisService as RedisService);
  });

  const createMockContext = (ip = '192.168.1.100', forwardedFor?: string): ExecutionContext => {
    const request = {
      ip,
      headers: {
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('permite requisição quando o contador está abaixo do limite de 120 req/min', async () => {
    (redisService.incrEx as jest.Mock).mockResolvedValue(5);
    const context = createMockContext();

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(redisService.incrEx).toHaveBeenCalledWith('rate-limit:ixc-webhook:192.168.1.100', 60);
  });

  it('bloqueia e retorna 429 Too Many Requests quando o contador excede 120 req/min', async () => {
    (redisService.incrEx as jest.Mock).mockResolvedValue(121);
    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const response = error.getResponse();
      expect(response.retryAfter).toBe(60);
    }
  });

  it('extrai IP correto do header x-forwarded-for', async () => {
    (redisService.incrEx as jest.Mock).mockResolvedValue(1);
    const context = createMockContext('10.0.0.1', '203.0.113.195, 70.41.3.18');

    await guard.canActivate(context);

    expect(redisService.incrEx).toHaveBeenCalledWith('rate-limit:ixc-webhook:203.0.113.195', 60);
  });

  it('permite a requisição em modo fallback se o Redis apresentar erro transitório', async () => {
    (redisService.incrEx as jest.Mock).mockRejectedValue(new Error('Redis connection failure'));
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
