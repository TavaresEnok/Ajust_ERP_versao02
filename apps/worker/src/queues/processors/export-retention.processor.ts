import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ExportRetentionService } from '../../reports/export-retention.service';
import { QUEUE_EXPORT_RETENTION } from '../queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

@Injectable()
export class ExportRetentionProcessor {
  private readonly logger = new Logger(ExportRetentionProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(ExportRetentionService)
    private readonly retentionService: ExportRetentionService,
  ) {
    this.worker = new Worker(QUEUE_EXPORT_RETENTION, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Export retention job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Export retention job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.retentionService.runOnce();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
