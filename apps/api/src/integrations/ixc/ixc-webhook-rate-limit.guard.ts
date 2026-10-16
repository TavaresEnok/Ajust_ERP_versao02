import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../common/redis.service';

const IXC_WEBHOOK_WINDOW_SECONDS = 60;
const IXC_WEBHOOK_LIMIT = 120; // 120 requisições por minuto por IP

@Injectable()
export class IxcWebhookRateLimitGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const key = `rate-limit:ixc-webhook:${clientIp}`;

    try {
      const attempts = await this.redis.incrEx(key, IXC_WEBHOOK_WINDOW_SECONDS);

      if (attempts > IXC_WEBHOOK_LIMIT) {
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: `Taxa limite de requisições excedida para o webhook do IXC (${IXC_WEBHOOK_LIMIT} req/${IXC_WEBHOOK_WINDOW_SECONDS}s).`,
            retryAfter: IXC_WEBHOOK_WINDOW_SECONDS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Fallback em caso de falha de conexão do Redis para não derrubar webhooks legítimos
      return true;
    }
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || '0.0.0.0';
  }
}
