import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { IxcReconciliationService } from '../../integrations/ixc-reconciliation.service';
import { QUEUE_IXC_RECONCILIATION } from '../queue.constants';
import { redisConnection } from '../../common/redis-connection';

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
