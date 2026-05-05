/**
 * Bootstrap Controller
 * 
 * Endpoints para gerenciar primeira autenticação de clientes via CNPJ
 * Fluxo: Cliente faz login com CNPJ → API gera e envia OTP → Cliente valida OTP
 */

import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { BootstrapOtpService } from './bootstrap-otp.service';
import { PrismaService } from '../prisma/prisma.service';

const RequestOtpSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos'),
  email: z.string().email('Email inválido')
});

const ValidateOtpSchema = z.object({
  userId: z.string().uuid('userId inválido'),
  otp: z.string().regex(/^\d{6}$/, 'OTP deve conter 6 dígitos')
});

@Controller('auth/bootstrap')
export class BootstrapController {
  constructor(
    private readonly bootstrapOtpService: BootstrapOtpService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Solicita OTP para primeira autenticação de cliente via CNPJ
   * 
   * POST /auth/bootstrap/request-otp
   * Body: { cnpj: "12345678901234", email: "cliente@empresa.com" }
   */
  @Post('request-otp')
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
                tenants: { include: { role: true } }
              }
            },
            role: true
          }
        }
      }
    });

    if (!tenant) {
      throw new BadRequestException('CNPJ não encontrado no sistema.');
    }

    // Busca usuário cliente para este tenant
    const clientMembership = tenant.users.find(
      (m) => m.role.code === 'cliente' && m.user.status === 'ACTIVE' && !m.user.deletedAt
    );

    if (!clientMembership) {
      throw new BadRequestException('Nenhum usuário cliente ativo para este CNPJ.');
    }

    const user = clientMembership.user;

    // Valida se email fornecido bate com email registrado
    if (user.email.toLowerCase() !== data.email.toLowerCase()) {
      throw new BadRequestException('Email não corresponde ao usuário registrado.');
    }

    // Gera e envia OTP
    await this.bootstrapOtpService.generateAndSendOtp(
      user.id,
      user.email,
      tenant.tradeName
    );

    return {
      success: true,
      message: `OTP enviado para ${data.email}. Válido por 15 minutos.`,
      userId: user.id, // Cliente usa isso no próximo passo
      expiresIn: 900 // 15 minutos em segundos
    };
  }

  /**
   * Valida OTP fornecido pelo cliente
   * 
   * POST /auth/bootstrap/validate-otp
   * Body: { userId: "uuid", otp: "123456" }
   */
  @Post('validate-otp')
  async validateOtp(@Body() input: unknown) {
    const data = ValidateOtpSchema.parse(input);

    try {
      const isValid = await this.bootstrapOtpService.validateOtp(data.userId, data.otp);

      if (!isValid) {
        throw new BadRequestException('OTP inválido. Verifique e tente novamente.');
      }

      return {
        success: true,
        message: 'OTP validado com sucesso. Você pode agora realizar login.',
        userId: data.userId
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof Error) {
        throw error;
      }
      throw new BadRequestException('Erro ao validar OTP.');
    }
  }
}
