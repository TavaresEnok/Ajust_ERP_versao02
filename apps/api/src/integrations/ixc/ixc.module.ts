import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { IxcController } from './ixc.controller';
import { IxcService } from './ixc.service';
import { IxcWebhookRateLimitGuard } from './ixc-webhook-rate-limit.guard';
import { SlaModule } from '../../sla/sla.module';

@Module({
  imports: [AuthModule, CommonModule, SlaModule],
  controllers: [IxcController],
  providers: [IxcService, IxcWebhookRateLimitGuard],
  exports: [IxcService],
})
export class IxcModule {}

