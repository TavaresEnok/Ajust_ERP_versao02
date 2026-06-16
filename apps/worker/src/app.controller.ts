import { Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { IxcReconciliationService } from './integrations/ixc-reconciliation.service';
import { ExportRetentionService } from './reports/export-retention.service';
import { WorkerAuthGuard } from './worker-auth.guard';

@Controller()
export class AppController {
  constructor(
    @Inject(IxcReconciliationService) private readonly ixcReconciliation: IxcReconciliationService,
    @Inject(ExportRetentionService) private readonly exportRetention: ExportRetentionService,
  ) {}

  @Get('health')
  health() {
    return {
      service: 'worker',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @UseGuards(WorkerAuthGuard)
  status() {
    return {
      service: 'worker',
      timestamp: new Date().toISOString(),
      ixcReconciliation: this.ixcReconciliation.getStatus(),
      exportRetention: this.exportRetention.getStatus(),
    };
  }

  @Post('jobs/ixc/reconcile')
  @UseGuards(WorkerAuthGuard)
  async triggerReconcile() {
    await this.ixcReconciliation.runOnce();
    return {
      ok: true,
      ...this.ixcReconciliation.getStatus(),
    };
  }

  @Post('jobs/exports/cleanup')
  @UseGuards(WorkerAuthGuard)
  async triggerExportCleanup() {
    await this.exportRetention.runOnce();
    return {
      ok: true,
      ...this.exportRetention.getStatus(),
    };
  }
}
