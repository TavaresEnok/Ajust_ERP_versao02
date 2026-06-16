import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { IxcReconciliationService } from '../../integrations/ixc-reconciliation.service';
import { QUEUE_IXC_RECONCILIATION } from '../queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

@Injectable()
export class IxcReconciliationProcessor {
  private readonly logger = new Logger(IxcReconciliationProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(IxcReconciliationService)
    private readonly reconciliationService: IxcReconciliationService,
  ) {
    this.worker = new Worker(QUEUE_IXC_RECONCILIATION, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`IXC reconciliation job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`IXC reconciliation job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.reconciliationService.runOnce();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
