import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { SlaMonitoringService } from '../../sla/sla-monitoring.service';
import { QUEUE_SLA_MONITORING } from '../queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

@Injectable()
export class SlaMonitoringProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(SlaMonitoringProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(SlaMonitoringService)
    private readonly slaMonitoringService: SlaMonitoringService,
  ) {
    this.worker = new Worker(QUEUE_SLA_MONITORING, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`SLA monitoring job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`SLA monitoring job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.slaMonitoringService.evaluateOpenOrders();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
