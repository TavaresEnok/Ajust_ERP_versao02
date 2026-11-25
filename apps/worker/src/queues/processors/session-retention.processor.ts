import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { SessionRetentionService } from '../../reports/session-retention.service';
import { QUEUE_SESSION_RETENTION } from '../queue.constants';
import { JOB_RETENTION } from '../job-retention';
import { redisConnection } from '../../common/redis-connection';

@Injectable()
export class SessionRetentionProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SessionRetentionProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(SessionRetentionService)
    private readonly retentionService: SessionRetentionService,
  ) {}

  /** Só depois de todos os onModuleInit (Prisma, serviços), para o job não rodar antes. */
  onApplicationBootstrap() {
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

    // Sem listener de 'error', uma queda do Redis vira exceção não tratada e derruba o processo.
    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });
    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled; será reprocessado.`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.retentionService.runOnce();
    const outbox = await this.retentionService.purgeLifecycleEvents();
    if (outbox.removed) this.logger.log(`Outbox: ${outbox.removed} eventos processados removidos`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
