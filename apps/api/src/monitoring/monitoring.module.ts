import { Module } from '@nestjs/common';
import { SentryService } from './sentry.service';
import { PrometheusService } from './prometheus.service';
import { LoggerService } from './logger.service';
import { MetricsController } from './metrics.controller';

@Module({
  providers: [SentryService, PrometheusService, LoggerService],
  controllers: [MetricsController],
  exports: [SentryService, PrometheusService, LoggerService],
})
export class MonitoringModule {}
