import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ReportsController } from './reports.controller';
import { HealthSummaryController } from './health-summary.controller';
import { DashboardsController } from './dashboards.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, CommonModule, MonitoringModule],
  controllers: [ReportsController, HealthSummaryController, DashboardsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
