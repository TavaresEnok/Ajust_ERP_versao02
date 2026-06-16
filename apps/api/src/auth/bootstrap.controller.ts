import { ApiTags } from '@nestjs/swagger';
/**
 * Bootstrap Controller
 *
 * Endpoints para gerenciar primeira autenticação de clientes via CNPJ
 * Fluxo: Cliente faz login com CNPJ → API gera e envia OTP → Cliente valida OTP
 */

import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Inject,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { BootstrapOtpService } from './bootstrap-otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitGuard } from './rate-limit.guard';

const RequestOtpSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos'),
  email: z.string().email('Email inválido'),
});

const ValidateOtpSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos'),
  email: z.string().email('Email inválido'),
  otp: z.string().regex(/^\d{6}$/, 'OTP deve conter 6 dígitos'),
  newPassword: z.string().min(8, 'A nova senha deve conter pelo menos 8 caracteres'),
});

@ApiTags('Bootstrap')
@Controller('auth/bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

  constructor(
    @Inject(BootstrapOtpService) private readonly bootstrapOtpService: BootstrapOtpService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Solicita OTP para primeira autenticação de cliente via CNPJ
   *
   * POST /auth/bootstrap/request-otp
   * Body: { cnpj: "12345678901234", email: "cliente@empresa.com" }
   */
  @Post('request-otp')
  @UseGuards(RateLimitGuard)
  async requestOtp(@Body() input: unknown) {
    const data = RequestOtpSchema.parse(input);

    // Busca tenant pelo CNPJ
    const tenant = await this.prisma.tenant.findUnique({
      where: { taxId: data.cnpj },
      include: {
        users: {
          include: {
            user: {
              include: {
                tenants: { include: { role: true } },
              },
            },
            role: true,
          },
        },
      },
    });

    const clientMembership = tenant?.users.find(
      (membership) =>
        tenant.status === 'ACTIVE' &&
        !tenant.deletedAt &&
        membership.role.code === 'cliente' &&
        membership.user.status === 'ACTIVE' &&
        !membership.user.deletedAt &&
        !membership.user.lastLoginAt &&
        membership.user.email.toLowerCase() === data.email.toLowerCase(),
    );

    if (tenant && clientMembership) {
      try {
        await this.bootstrapOtpService.generateAndSendOtp(
          clientMembership.user.id,
          clientMembership.user.email,
          tenant.tradeName,
        );
      } catch (error) {
        this.logger.error(`Failed to send first-access OTP: ${(error as Error).message}`);
      }
    }

    return {
      success: true,
      message: 'Se os dados corresponderem a um primeiro acesso, o código será enviado por e-mail.',
      expiresIn: 900,
    };
  }

  /**
   * Valida OTP fornecido pelo cliente
   *
   * POST /auth/bootstrap/validate-otp
   * Body: { userId: "uuid", otp: "123456" }
   */
  @Post('validate-otp')
  @UseGuards(RateLimitGuard)
  async validateOtp(@Body() input: unknown) {
    const data = ValidateOtpSchema.parse(input);

    const tenant = await this.prisma.tenant.findUnique({
      where: { taxId: data.cnpj },
      include: {
        users: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });
    const clientMembership = tenant?.users.find(
      (membership) =>
        tenant.status === 'ACTIVE' &&
        !tenant.deletedAt &&
        membership.role.code === 'cliente' &&
        membership.user.status === 'ACTIVE' &&
        !membership.user.deletedAt &&
        !membership.user.lastLoginAt &&
        membership.user.email.toLowerCase() === data.email.toLowerCase(),
    );
    if (!clientMembership) {
      throw new BadRequestException('Código inválido ou expirado.');
    }

    const bootstrapToken = await this.bootstrapOtpService.completeFirstAccess(
      clientMembership.user.id,
      data.otp,
      data.newPassword,
    );

    return {
      success: true,
      message: 'Código validado. Concluindo o primeiro acesso.',
      bootstrapToken,
    };
  }
}
