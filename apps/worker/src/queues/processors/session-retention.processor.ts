import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { SessionRetentionService } from '../../reports/session-retention.service';
import { QUEUE_SESSION_RETENTION } from '../queue.constants';
import { redisConnection } from '../../common/redis-connection';

@Injectable()
export class SessionRetentionProcessor {
  private readonly logger = new Logger(SessionRetentionProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(SessionRetentionService)
    private readonly retentionService: SessionRetentionService,
  ) {
    this.worker = new Worker(QUEUE_SESSION_RETENTION, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Session retention job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Session retention job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.retentionService.runOnce();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
