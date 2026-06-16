import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { SlaModule } from '../../sla/sla.module';

@Module({
  imports: [PrismaModule, RealtimeModule, SlaModule],
  controllers: [MonitoringController],
})
export class MonitoringWebhookModule {}
