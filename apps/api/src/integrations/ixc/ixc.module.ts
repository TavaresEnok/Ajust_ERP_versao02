import { IxcInternalController } from './ixc-internal.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { IxcController } from './ixc.controller';
import { IxcService } from './ixc.service';
import { IxcWebhookRateLimitGuard } from './ixc-webhook-rate-limit.guard';
import { SlaModule } from '../../sla/sla.module';
import { ServiceOrdersModule } from '../../service-orders/service-orders.module';
import { ServiceOrderLifecycleModule } from '../../service-orders/service-order-lifecycle.service';

@Module({
  imports: [AuthModule, CommonModule, SlaModule, ServiceOrdersModule, ServiceOrderLifecycleModule],
  controllers: [IxcController, IxcInternalController],
  providers: [IxcService, IxcWebhookRateLimitGuard],
  exports: [IxcService],
})
export class IxcModule {}
