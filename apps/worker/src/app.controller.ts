import { Controller, Get, Inject, Post } from '@nestjs/common';
import { IxcReconciliationService } from './integrations/ixc-reconciliation.service';
import { ExportRetentionService } from './reports/export-retention.service';

@Controller()
export class AppController {
  constructor(
    @Inject(IxcReconciliationService) private readonly ixcReconciliation: IxcReconciliationService,
    @Inject(ExportRetentionService) private readonly exportRetention: ExportRetentionService
  ) {}

  @Get('health')
  health() {
    return {
      service: 'worker',
      status: 'ok',
      timestamp: new Date().toISOString(),
      ixcReconciliation: this.ixcReconciliation.getStatus(),
      exportRetention: this.exportRetention.getStatus()
    };
  }

  @Post('jobs/ixc/reconcile')
  async triggerReconcile() {
    await this.ixcReconciliation.runOnce();
    return {
      ok: true,
      ...this.ixcReconciliation.getStatus()
    };
  }

  @Post('jobs/exports/cleanup')
  async triggerExportCleanup() {
    await this.exportRetention.runOnce();
    return {
      ok: true,
      ...this.exportRetention.getStatus()
    };
  }
}
