import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../common/redis.service';
import { RequestWithAuth } from '../common/request-with-auth';

/* ────────────────────────────────────────────────────────────────
   Decorator: @TenantRateLimit(limit, windowSeconds)
   Uso nos controllers:
     @TenantRateLimit(60, 60)   // 60 req/min por tenant
     @Get('export')
   ──────────────────────────────────────────────────────────────── */
export const TENANT_RATE_LIMIT_KEY = 'tenant_rate_limit';

export interface TenantRateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export const TenantRateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata<string, TenantRateLimitOptions>(TENANT_RATE_LIMIT_KEY, {
    limit,
    windowSeconds,
  });

/* ────────────────────────────────────────────────────────────────
   Guard: aplica o rate limit por tenantId + endpoint
   ──────────────────────────────────────────────────────────────── */
@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<TenantRateLimitOptions | undefined>(
      TENANT_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não há @TenantRateLimit no endpoint, deixa passar
    if (!options) return true;

    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;

    // Se não há sessão autenticada, o AuthGuard já vai rejeitar
    if (!tenantId && !userId) return true;

    const scope = tenantId ?? userId ?? 'anonymous';
    const route = `${req.method}:${req.route?.path ?? req.path}`;
    const key = `rate-limit:tenant:${scope}:${route}`;

    try {
      const current = await this.redis.incrEx(key, options.windowSeconds);

      if (current > options.limit) {
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: `Rate limit de ${options.limit} req/${options.windowSeconds}s por tenant excedido.`,
            retryAfter: options.windowSeconds,
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
}
