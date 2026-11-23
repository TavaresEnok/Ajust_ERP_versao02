import { HttpStatus, Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RedisService } from './redis.service';
import { RequestWithAuth } from './request-with-auth';

const EXEMPT_PATHS = new Set(['/monitoring/health', '/monitoring/ready']);
const DEFAULT_USER_LIMIT_PER_SEC = 80;
const DEFAULT_IP_LIMIT_PER_SEC = 200;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  private resolveAuthenticatedUserId(req: RequestWithAuth): string | null {
    if (req.auth?.userId) return req.auth.userId;
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return null;
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
    try {
      const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
      return payload.userId || payload.sub || null;
    } catch {
      return null;
    }
  }

  async use(req: RequestWithAuth, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') return next();
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (EXEMPT_PATHS.has(path)) return next();

    const userId = this.resolveAuthenticatedUserId(req);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userLimit = parsePositiveInt(
      process.env.GLOBAL_RATE_LIMIT_USER_PER_SEC,
      DEFAULT_USER_LIMIT_PER_SEC,
    );
    const ipLimit = parsePositiveInt(
      process.env.GLOBAL_RATE_LIMIT_IP_PER_SEC,
      DEFAULT_IP_LIMIT_PER_SEC,
    );

    const limit = userId ? userLimit : ipLimit;
    const key = userId ? `rate-limit:global:user:${userId}` : `rate-limit:global:ip:${ip}`;
    const windowSeconds = 1;

    try {
      const current = await this.redis.incrEx(key, windowSeconds);
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - current)));

      if (current > limit) {
        res.setHeader('Retry-After', String(windowSeconds));
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Limite de requisições excedido. Aguarde um instante.',
        });
      }
    } catch {
      // Fail-open em indisponibilidade transitória do Redis para não derrubar o NOC.
    }

    return next();
  }
}
