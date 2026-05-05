import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { BootstrapTokenService } from './bootstrap-token.service';
import { TwoFactorController } from './two-factor.controller';

@Module({
  imports: [CommonModule],
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, AuthGuard, TotpService, BootstrapTokenService],
  exports: [AuthService, AuthGuard, TotpService, BootstrapTokenService]
})
export class AuthModule {}


