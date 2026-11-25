import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { MonthlyHealthReportService } from '../../reports/monthly-health-report.service';
import { QUEUE_MONTHLY_HEALTH_REPORT } from '../queue.constants';
import { JOB_RETENTION } from '../job-retention';
import { redisConnection } from '../../common/redis-connection';

@Injectable()
export class MonthlyReportProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MonthlyReportProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(MonthlyHealthReportService)
    private readonly reportService: MonthlyHealthReportService,
  ) {}

  /** Só depois de todos os onModuleInit (Prisma, serviços), para o job não rodar antes. */
  onApplicationBootstrap() {
    this.worker = new Worker(QUEUE_MONTHLY_HEALTH_REPORT, async (job: Job) => this.process(job), {
      connection: redisConnection,
      ...JOB_RETENTION,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Monthly health report job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Monthly health report job ${job?.id} failed: ${err.message}`);
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
    await this.reportService.runCheck();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
