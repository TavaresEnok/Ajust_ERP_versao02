/**
 * Forgot Password Rate Limit Guard
 *
 * Uses centralized RedisService for distributed rate limiting
 *
 * Previne:
 * - Enumeração de emails (descobrir quais contas existem)
 * - Ataque de força bruta
 * - DOS de spam
 */

import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../common/redis.service';

@Injectable()
export class ForgotPasswordRateLimitGuard implements CanActivate {
  private readonly ATTEMPTS_LIMIT = 3;
  private readonly WINDOW_MINUTES = 60; // 1 hora
  private readonly LOCKOUT_MINUTES = 15; // 15 minutos de lockout após ultrapassar limite

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const body = request.body as { email?: string };
    const email = body?.email?.toLowerCase() || 'unknown';

    // Usar combinação de IP + email como chave para rate limiting
    const key = `rate-limit:forgot-password:${ip}:${email}`;
    const lockoutKey = `rate-limit:forgot-password:lockout:${ip}:${email}`;

    try {
      // Verificar se está em lockout
      const isLockedOut = await this.redis.get(lockoutKey);
      if (isLockedOut) {
        throw new HttpException(
          {
            statusCode: 429,
            message: `Muitas tentativas. Tente novamente em alguns minutos.`,
            retryAfter: this.LOCKOUT_MINUTES * 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Incrementar contador
      const attempts = await this.redis.incrEx(key, this.WINDOW_MINUTES * 60);

      if (attempts > this.ATTEMPTS_LIMIT) {
        // Ativar lockout
        await this.redis.set(lockoutKey, '1', this.LOCKOUT_MINUTES * 60);
        throw new HttpException(
          {
            statusCode: 429,
            message: `Muitas tentativas de recuperação de senha. Tente novamente em ${this.LOCKOUT_MINUTES} minutos.`,
            retryAfter: this.LOCKOUT_MINUTES * 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Adicionar jitter na resposta para evitar enumeration timing attacks
      const jitter = Math.random() * 500; // 0-500ms aleatório
      await new Promise((resolve) => setTimeout(resolve, jitter));

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
