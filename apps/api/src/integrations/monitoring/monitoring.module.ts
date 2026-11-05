import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServiceOrdersModule } from '../../service-orders/service-orders.module';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, ServiceOrdersModule, ApiKeysModule, CommonModule],
  controllers: [MonitoringController],
})
export class MonitoringWebhookModule {}
