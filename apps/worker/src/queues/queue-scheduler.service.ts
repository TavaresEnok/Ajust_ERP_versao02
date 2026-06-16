import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  QUEUE_IXC_RECONCILIATION,
  QUEUE_EXPORT_RETENTION,
  QUEUE_MONTHLY_HEALTH_REPORT,
  QUEUE_AUDIT_ARCHIVING,
  JOB_IXC_RECONCILE,
  JOB_EXPORT_CLEANUP,
  JOB_MONTHLY_REPORT,
  JOB_AUDIT_ARCHIVE,
} from './queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

@Injectable()
export class QueueSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueSchedulerService.name);
  private queues: Queue[] = [];

  async onModuleInit() {
    await this.scheduleRecurringJobs();
  }

  async onModuleDestroy() {
    await Promise.all(this.queues.map((q) => q.close()));
  }

  private createQueue(name: string): Queue {
    const q = new Queue(name, { connection: redisConnection });
    this.queues.push(q);
    return q;
  }

  private async scheduleRecurringJobs() {
    const ixcQueue = this.createQueue(QUEUE_IXC_RECONCILIATION);
    const retentionQueue = this.createQueue(QUEUE_EXPORT_RETENTION);
    const reportQueue = this.createQueue(QUEUE_MONTHLY_HEALTH_REPORT);
    const archiveQueue = this.createQueue(QUEUE_AUDIT_ARCHIVING);

    const ixcIntervalMs = Number(process.env.IXC_RECONCILE_INTERVAL_MS || 300_000);
    const retentionIntervalMs = Number(process.env.EXPORT_RETENTION_INTERVAL_MS || 3_600_000);

    // IXC Reconciliation — configurable interval (default 5 min)
    await ixcQueue.upsertJobScheduler(
      'ixc-reconcile-schedule',
      { every: ixcIntervalMs },
      {
        name: JOB_IXC_RECONCILE,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
      },
    );

    // Export retention cleanup — hourly
    await retentionQueue.upsertJobScheduler(
      'export-retention-schedule',
      { every: retentionIntervalMs },
      {
        name: JOB_EXPORT_CLEANUP,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
      },
    );

    // Monthly health report — 1st of each month at 06:00 UTC
    await reportQueue.upsertJobScheduler(
      'monthly-report-schedule',
      { pattern: '0 6 1 * *' },
      {
        name: JOB_MONTHLY_REPORT,
        opts: { attempts: 2, backoff: { type: 'fixed', delay: 30_000 } },
      },
    );

    // Audit log archiving — daily at 02:00 UTC
    await archiveQueue.upsertJobScheduler(
      'audit-archive-schedule',
      { pattern: '0 2 * * *' },
      {
        name: JOB_AUDIT_ARCHIVE,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 15_000 } },
      },
    );

    this.logger.log('Recurring job schedules registered via BullMQ');
  }
}
