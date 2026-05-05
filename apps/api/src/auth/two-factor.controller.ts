import { Controller, Post, Get, Body, UseGuards, Req, BadRequestException, UnauthorizedException, Inject, HttpCode } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { TotpService } from './totp.service';
import { AuthService } from './auth.service';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaService } from '../prisma/prisma.service';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { compare } from 'bcryptjs';

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
    qr_code_url: string;
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

    const secret = this.totpService.generateSecret();
    const provisioningUrl = this.totpService.getProvisioningUrl(secret, user.email);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(provisioningUrl)}`;

    return {
      secret,
      provisioning_url: provisioningUrl,
      qr_code_url: qrCodeUrl,
    };
  }

  @Post('confirm')
  @UseGuards(AuthGuard)
  async confirmTwoFactor(
    @Req() req: RequestWithAuth,
    @Body() body: { secret: string; code: string },
  ): Promise<{ success: boolean; message: string }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    if (!body.secret || !body.code) {
      throw new BadRequestException('Secret and code are required');
    }

    // Verify the code
    const isValid = this.totpService.verifyCode(body.secret, body.code);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Encrypt and store the secret
    const encryptedSecret = this.encryptSecret(body.secret);

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
    @Body() body: { password: string },
  ): Promise<{ success: boolean; message: string }> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    if (!body.password) {
      throw new BadRequestException('Password is required to disable 2FA');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isValidPassword = await compare(body.password, user.passwordHash);
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

  private encryptSecret(secret: string): string {
    const encryptionKey = Buffer.from(process.env.SECRETS_ENCRYPTION_KEY || 'change-this-secret-key-in-production', 'utf-8');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey.subarray(0, 32), iv);

    let encrypted = cipher.update(secret, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  decryptSecret(encrypted: string): string {
    const encryptionKey = Buffer.from(process.env.SECRETS_ENCRYPTION_KEY || 'change-this-secret-key-in-production', 'utf-8');
    const [ivHex, encryptedHex, authTagHex] = encrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey.subarray(0, 32), iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }
}
