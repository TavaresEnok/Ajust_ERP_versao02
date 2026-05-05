import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
