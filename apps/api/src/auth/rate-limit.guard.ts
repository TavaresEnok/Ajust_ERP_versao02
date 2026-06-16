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

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const body = request.body as { identifier?: string; email?: string };
    const identifier = body?.identifier || body?.email || ip;

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
