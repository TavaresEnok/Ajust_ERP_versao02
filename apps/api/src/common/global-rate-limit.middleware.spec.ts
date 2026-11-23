import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';
import { GlobalRateLimitMiddleware } from './global-rate-limit.middleware';
import type { RedisService } from './redis.service';
import type { RequestWithAuth } from './request-with-auth';

describe('GlobalRateLimitMiddleware', () => {
  const createRes = () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader: jest.fn((k: string, v: string) => headers.set(k.toLowerCase(), v)),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return { res: res as unknown as Response, headers, raw: res };
  };

  it('ignora healthchecks e requisições OPTIONS sem consultar Redis', async () => {
    const incrEx = jest.fn();
    const middleware = new GlobalRateLimitMiddleware({ incrEx } as unknown as RedisService);
    const next = jest.fn() as NextFunction;
    const { res } = createRes();

    await middleware.use(
      { method: 'GET', originalUrl: '/monitoring/health', headers: {} } as RequestWithAuth,
      res,
      next,
    );
    await middleware.use(
      { method: 'GET', originalUrl: '/monitoring/ready', headers: {} } as RequestWithAuth,
      res,
      next,
    );
    await middleware.use(
      { method: 'OPTIONS', originalUrl: '/service-orders', headers: {} } as RequestWithAuth,
      res,
      next,
    );

    expect(incrEx).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('usa cota individual para usuário autenticado via JWT válido e devolve 429 ao exceder', async () => {
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
    const token = jwt.sign({ sub: 'user-42' }, secret);
    const incrEx = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(81);
    const middleware = new GlobalRateLimitMiddleware({ incrEx } as unknown as RedisService);
    const next = jest.fn() as NextFunction;

    const first = createRes();
    await middleware.use(
      {
        method: 'GET',
        originalUrl: '/service-orders',
        ip: '10.0.0.1',
        headers: { authorization: `Bearer ${token}` },
      } as unknown as RequestWithAuth,
      first.res,
      next,
    );
    expect(incrEx).toHaveBeenCalledWith('rate-limit:global:user:user-42', 1);
    expect(first.headers.get('x-ratelimit-limit')).toBe('80');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('79');
    expect(next).toHaveBeenCalledTimes(1);

    const second = createRes();
    await middleware.use(
      {
        method: 'GET',
        originalUrl: '/service-orders',
        ip: '10.0.0.1',
        headers: { authorization: `Bearer ${token}` },
      } as unknown as RequestWithAuth,
      second.res,
      next,
    );
    expect(second.raw.status).toHaveBeenCalledWith(429);
    expect(second.headers.get('retry-after')).toBe('1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('cai no bucket de IP quando o token é inválido e opera em fail-open se o Redis falhar', async () => {
    const incrEx = jest.fn().mockRejectedValueOnce(new Error('redis down'));
    const middleware = new GlobalRateLimitMiddleware({ incrEx } as unknown as RedisService);
    const next = jest.fn() as NextFunction;
    const { res } = createRes();

    await middleware.use(
      {
        method: 'GET',
        originalUrl: '/service-orders',
        ip: '198.51.100.9',
        headers: { authorization: 'Bearer invalid.jwt.token' },
      } as unknown as RequestWithAuth,
      res,
      next,
    );

    expect(incrEx).toHaveBeenCalledWith('rate-limit:global:ip:198.51.100.9', 1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
