import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { IxcReconciliationService } from '../../integrations/ixc-reconciliation.service';
import { QUEUE_IXC_RECONCILIATION } from '../queue.constants';
import { JOB_RETENTION } from '../job-retention';
import { redisConnection } from '../../common/redis-connection';

@Injectable()
export class IxcReconciliationProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IxcReconciliationProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(IxcReconciliationService)
    private readonly reconciliationService: IxcReconciliationService,
  ) {}

  /** Só depois de todos os onModuleInit (Prisma, serviços), para o job não rodar antes. */
  onApplicationBootstrap() {
    this.worker = new Worker(QUEUE_IXC_RECONCILIATION, async (job: Job) => this.process(job), {
      connection: redisConnection,
      ...JOB_RETENTION,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`IXC reconciliation job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`IXC reconciliation job ${job?.id} failed: ${err.message}`);
    });

    // Sem listener de 'error', uma queda do Redis vira exceção não tratada e derruba o processo.
    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });
    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled; será reprocessado.`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.reconciliationService.runOnce();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
