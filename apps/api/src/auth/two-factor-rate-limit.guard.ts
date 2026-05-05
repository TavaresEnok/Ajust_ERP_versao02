/**
 * Two Factor Auth Rate Limit Guard - Updated for Fase 2
 * 
 * Uses centralized RedisService for distributed rate limiting
 * 
 * Previne:
 * - Brute force de 6 dígitos (1M combinações possíveis)
 * - Bypass de 2FA
 * 
 * Implementa:
 * - Máximo 3 tentativas
 * - Backoff exponencial: 1s, 2s, 4s, 8s...
 * - Lockout após limite
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../common/redis.service';

@Injectable()
export class TwoFactorRateLimitGuard implements CanActivate {
  private readonly MAX_ATTEMPTS = 3;
  private readonly WINDOW_MINUTES = 15;
  private readonly LOCKOUT_MINUTES = 15;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as { userId?: string; temporaryToken?: string };
    const userId = body?.userId;

    if (!userId) {
      return true;
    }

    const attemptsKey = `2fa-attempts:${userId}`;
    const lockoutKey = `2fa-lockout:${userId}`;

    try {
      // Verificar lockout
      const isLockedOut = await this.redis.get(lockoutKey);
      if (isLockedOut) {
        throw new HttpException(
          {
            statusCode: 429,
            message: `Muitas tentativas falhas. Tente novamente em alguns minutos.`,
            retryAfter: this.LOCKOUT_MINUTES * 60
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Obter número de tentativas
      const attempts = await this.redis.incrEx(attemptsKey, this.WINDOW_MINUTES * 60);

      if (attempts > this.MAX_ATTEMPTS) {
        // Ativar lockout
        await this.redis.set(lockoutKey, '1', this.LOCKOUT_MINUTES * 60);
        // Limpar counter de tentativas
        await this.redis.del(attemptsKey);

        throw new HttpException(
          {
            statusCode: 429,
            message: `Muitas tentativas falhas na validação de 2FA. Tente novamente em ${this.LOCKOUT_MINUTES} minutos.`,
            retryAfter: this.LOCKOUT_MINUTES * 60
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Aplicar backoff exponencial
      // Tentativa 1: 0s (primeira é rápida)
      // Tentativa 2: 1s
      // Tentativa 3: 2s
      // Tentativa 4+: lockout (mas nunca chegamos aqui)
      const backoffSeconds = Math.pow(2, Math.max(0, attempts - 2));
      if (backoffSeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Em caso de erro, deixar passar (melhor que bloquear tudo)
      return true;
    }
  }
}
