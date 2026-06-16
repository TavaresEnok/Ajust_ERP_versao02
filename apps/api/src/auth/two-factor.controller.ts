import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  UnauthorizedException,
  Inject,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { TotpService } from './totp.service';
import { AuthService } from './auth.service';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { decryptSecret, encryptSecret } from '../common/secrets.crypto';

const ConfirmTwoFactorSchema = z.object({
  secret: z.string().trim().min(16).max(256),
  code: z.string().regex(/^\d{6}$/),
});

const DisableTwoFactorSchema = z.object({
  password: z.string().min(1).max(256),
});

@ApiTags('2FA')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    @Inject(TotpService) private readonly totpService: TotpService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post('setup')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async setupTwoFactor(@Req() req: RequestWithAuth): Promise<{
    secret: string;
    provisioning_url: string;
    qr_code_url: null;
  }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Disable the current 2FA configuration before replacing it.');
    }

    const secret = this.totpService.generateSecret();
    const provisioningUrl = this.totpService.getProvisioningUrl(secret, user.email);

    return {
      secret,
      provisioning_url: provisioningUrl,
      qr_code_url: null,
    };
  }

  @Post('confirm')
  @UseGuards(AuthGuard)
  async confirmTwoFactor(
    @Req() req: RequestWithAuth,
    @Body() body: unknown,
  ): Promise<{ success: boolean; message: string }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    const input = ConfirmTwoFactorSchema.parse(body);
    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { twoFactorEnabled: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Disable the current 2FA configuration before replacing it.');
    }

    const isValid = this.totpService.verifyCode(input.secret, input.code);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Encrypt and store the secret
    const encryptedSecret = encryptSecret(input.secret);

    // Update user
    await this.prisma.user.update({
      where: { id: req.auth.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecretEnc: encryptedSecret,
      },
    });

    return {
      success: true,
      message: '2FA has been enabled successfully',
    };
  }

  @Post('disable')
  @UseGuards(AuthGuard)
  async disableTwoFactor(
    @Req() req: RequestWithAuth,
    @Body() body: unknown,
  ): Promise<{ success: boolean; message: string }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    const input = DisableTwoFactorSchema.parse(body);

    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isValidPassword = await compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestException('Invalid password');
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: req.auth.userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEnc: null,
      },
    });

    return {
      success: true,
      message: '2FA has been disabled',
    };
  }

  @Get('status')
  @UseGuards(AuthGuard)
  async getTwoFactorStatus(@Req() req: RequestWithAuth): Promise<{ enabled: boolean }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    return {
      enabled: user?.twoFactorEnabled || false,
    };
  }
  decryptSecret(encrypted: string): string {
    return decryptSecret(encrypted);
  }
}
