import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { IxcReconciliationService } from './integrations/ixc-reconciliation.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExportRetentionService } from './reports/export-retention.service';
import { MonthlyHealthReportService } from './reports/monthly-health-report.service';
import { QueueSchedulerService } from './queues/queue-scheduler.service';
import { IxcReconciliationProcessor } from './queues/processors/ixc-reconciliation.processor';
import { ExportRetentionProcessor } from './queues/processors/export-retention.processor';
import { MonthlyReportProcessor } from './queues/processors/monthly-report.processor';
import { AuditArchivingProcessor } from './queues/processors/audit-archiving.processor';
import { WorkerAuthGuard } from './worker-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [
    IxcReconciliationService,
    ExportRetentionService,
    MonthlyHealthReportService,
    QueueSchedulerService,
    IxcReconciliationProcessor,
    ExportRetentionProcessor,
    MonthlyReportProcessor,
    AuditArchivingProcessor,
    WorkerAuthGuard,
  ],
})
export class AppModule {}
