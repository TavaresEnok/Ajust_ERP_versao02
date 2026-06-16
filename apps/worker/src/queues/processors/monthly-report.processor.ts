import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { MonthlyHealthReportService } from '../../reports/monthly-health-report.service';
import { QUEUE_MONTHLY_HEALTH_REPORT } from '../queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

@Injectable()
export class MonthlyReportProcessor {
  private readonly logger = new Logger(MonthlyReportProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(MonthlyHealthReportService)
    private readonly reportService: MonthlyHealthReportService,
  ) {
    this.worker = new Worker(QUEUE_MONTHLY_HEALTH_REPORT, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Monthly health report job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Monthly health report job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.reportService.runCheck();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
