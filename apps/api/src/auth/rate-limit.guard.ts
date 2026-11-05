import {
  Inject,
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../common/redis.service';

const WINDOW_SECONDS = 15 * 60;
const LIMIT = 5;
const LOCKOUT_SECONDS = 15 * 60;
// Limiar para atraso progressivo por conta; bloqueio continua restrito ao IP + conta.
const ACCOUNT_LIMIT = 20;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async recordSuccess(request: Request) {
    const body = request.body as { identifier?: string; email?: string };
    const identifier = String(body?.identifier || body?.email || this.getClientIp(request))
      .trim()
      .toLowerCase();
    // A successful password validation is not a failed attempt. Do not remove active lockouts.
    await this.redis.del(`rate-limit:login:${this.getClientIp(request)}:${identifier}`);
    await this.redis.del(`rate-limit:login:account:${identifier}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const body = request.body as { identifier?: string; email?: string };
    const identifier = String(body?.identifier || body?.email || ip)
      .trim()
      .toLowerCase();

    const key = `rate-limit:login:${ip}:${identifier}`;
    const lockoutKey = `rate-limit:login:lockout:${ip}:${identifier}`;

    try {
      const isLockedOut = await this.redis.get(lockoutKey);
      if (isLockedOut) {
        throw new HttpException(
          {
            statusCode: 429,
            message: 'Too many login attempts. Please try again after 15 minutes.',
            retryAfter: LOCKOUT_SECONDS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const attempts = await this.redis.incrEx(key, WINDOW_SECONDS);
      const accountAttempts = await this.redis.incrEx(
        `rate-limit:login:account:${identifier}`,
        WINDOW_SECONDS,
      );

      if (attempts > LIMIT) {
        await this.redis.set(lockoutKey, '1', LOCKOUT_SECONDS);
        throw new HttpException(
          {
            statusCode: 429,
            message: 'Too many login attempts. Please try again after 15 minutes.',
            retryAfter: LOCKOUT_SECONDS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // A distributed attack may slow an account, but must not lock out its owner on another IP.
      if (accountAttempts > ACCOUNT_LIMIT) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1500, (accountAttempts - ACCOUNT_LIMIT) * 100)),
        );
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Serviço temporariamente indisponível. Tente novamente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private getClientIp(request: Request): string {
    return request.ip || '0.0.0.0';
  }
}
