import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { SessionRetentionService } from '../../reports/session-retention.service';
import { QUEUE_SESSION_RETENTION } from '../queue.constants';
import { JOB_RETENTION } from '../job-retention';
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
      ...JOB_RETENTION,
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
    const outbox = await this.retentionService.purgeLifecycleEvents();
    if (outbox.removed) this.logger.log(`Outbox: ${outbox.removed} eventos processados removidos`);
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
