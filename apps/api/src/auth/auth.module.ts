import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { BootstrapTokenService } from './bootstrap-token.service';
import { ForgotPasswordRateLimitGuard } from './forgot-password-rate-limit.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { TwoFactorController } from './two-factor.controller';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapOtpService } from './bootstrap-otp.service';
import { TwoFactorRateLimitGuard } from './two-factor-rate-limit.guard';

@Module({
  imports: [CommonModule],
  controllers: [AuthController, TwoFactorController, BootstrapController],
  providers: [
    AuthService,
    AuthGuard,
    TotpService,
    BootstrapTokenService,
    ForgotPasswordRateLimitGuard,
    RateLimitGuard,
    TwoFactorRateLimitGuard,
    BootstrapOtpService,
  ],
  exports: [AuthService, AuthGuard, TotpService, BootstrapTokenService],
})
export class AuthModule {}
