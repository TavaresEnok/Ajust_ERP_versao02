import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { SentryService } from './sentry.service';
import { PrometheusService } from './prometheus.service';
import { LoggerService } from './logger.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [SentryService, PrometheusService, LoggerService],
  controllers: [MetricsController],
  exports: [SentryService, PrometheusService, LoggerService],
})
export class MonitoringModule {}
