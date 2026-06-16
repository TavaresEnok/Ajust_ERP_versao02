/**
 * Bootstrap OTP Service
 *
 * Gera e valida OTPs de 6 dígitos para primeiro acesso de clientes via CNPJ
 * Substitui o frágil sistema de 4 últimos dígitos
 */

import { Inject, Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { hash } from 'bcryptjs';
import { BootstrapTokenService } from './bootstrap-token.service';

@Injectable()
export class BootstrapOtpService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_VALIDITY_MINUTES = 15;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(BootstrapTokenService) private readonly bootstrapTokenService: BootstrapTokenService,
  ) {}

  /**
   * Gera e envia OTP para email do usuário na primeira autenticação por CNPJ
   */
  async generateAndSendOtp(userId: string, email: string, tenantName: string): Promise<void> {
    // Gera OTP de 6 dígitos aleatórios
    const otp = this.generateSecureOtp();
    const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);

    // Remove OTPs antigos expirados
    await this.prisma.bootstrapOtp.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Remove OTP anterior se existir (evita múltiplos OTPs ativos)
    await this.prisma.bootstrapOtp.deleteMany({
      where: {
        userId,
        validatedAt: null,
      },
    });

    // Cria novo OTP
    await this.prisma.bootstrapOtp.create({
      data: {
        userId,
        otp: this.hashOtp(otp),
        expiresAt,
        attempts: 0,
      },
    });

    // Envia OTP por email
    await this.emailService.sendBootstrapOtp({
      email,
      otp,
      tenantName,
      expiresAtMinutes: this.OTP_VALIDITY_MINUTES,
    });
  }

  /**
   * Valida OTP fornecido pelo usuário
   * Implementa rate limiting e expiração
   */
  async validateOtp(userId: string, providedOtp: string): Promise<boolean> {
    const otpRecord = await this.prisma.bootstrapOtp.findFirst({
      where: {
        userId,
        validatedAt: null, // Não foi validado ainda
        expiresAt: { gt: new Date() }, // Ainda é válido
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('OTP inválido ou expirado. Solicite um novo.');
    }

    // Verifica se já excedeu tentativas máximas
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        `Muitas tentativas falhas. Espere ${this.OTP_VALIDITY_MINUTES} minutos e solicite novo OTP.`,
      );
    }

    // Incrementa contador de tentativas
    await this.prisma.bootstrapOtp.update({
      where: { id: otpRecord.id },
      data: { attempts: otpRecord.attempts + 1 },
    });

    // Valida OTP (usando comparação segura contra timing attacks)
    const isValid = this.secureCompare(this.hashOtp(providedOtp), otpRecord.otp);

    if (isValid) {
      // Marca como validado
      await this.prisma.bootstrapOtp.update({
        where: { id: otpRecord.id },
        data: { validatedAt: new Date() },
      });
      return true;
    }

    return false;
  }

  async completeFirstAccess(userId: string, otp: string, newPassword: string): Promise<string> {
    const isValid = await this.validateOtp(userId, otp);
    if (!isValid) {
      throw new BadRequestException('Código inválido ou expirado.');
    }

    const bootstrap = this.bootstrapTokenService.generateTokenWithExpiry(1);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(newPassword, 12),
        bootstrapTokenHash: bootstrap.hash,
        bootstrapTokenExpiresAt: bootstrap.expiresAt,
      },
    });

    return bootstrap.token;
  }

  /**
   * Gera OTP seguro de 6 dígitos
   */
  private generateSecureOtp(): string {
    // Gera número entre 0 e 999999 (6 dígitos)
    const otp = randomInt(0, 1000000);
    // Padeia com zeros à esquerda (ex: 12345 → 012345)
    return String(otp).padStart(this.OTP_LENGTH, '0');
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Comparação segura contra timing attacks
   * Implementa timing-safe comparison
   */
  private secureCompare(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  /**
   * Limpa OTPs expirados do banco (pode ser chamado periodicamente)
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.prisma.bootstrapOtp.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
