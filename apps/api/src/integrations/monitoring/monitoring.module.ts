import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServiceOrdersModule } from '../../service-orders/service-orders.module';

@Module({
  imports: [PrismaModule, ServiceOrdersModule],
  controllers: [MonitoringController],
})
export class MonitoringWebhookModule {}
