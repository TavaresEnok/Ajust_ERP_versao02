import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_AUDIT_ARCHIVING } from '../queue.constants';

const redisConnection = {
  host: (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[0],
  port: parseInt(
    (process.env.REDIS_URL || 'redis://redis:6379').replace(/^redis:\/\//, '').split(':')[1] ||
      '6379',
    10,
  ),
};

const ARCHIVE_AFTER_DAYS = Number(process.env.AUDIT_ARCHIVE_AFTER_DAYS || 90);
const BATCH_SIZE = 500;

@Injectable()
export class AuditArchivingProcessor {
  private readonly logger = new Logger(AuditArchivingProcessor.name);
  private worker: Worker;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.worker = new Worker(QUEUE_AUDIT_ARCHIVING, async (job: Job) => this.process(job), {
      connection: redisConnection,
      concurrency: 1,
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Audit archiving job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Audit archiving job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(_job: Job): Promise<{ archived: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);

    let totalArchived = 0;

    // Process in batches to avoid locking large tables
    while (true) {
      const records = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoffDate } },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });

      if (records.length === 0) break;

      const ids = records.map((r) => r.id);

      // Insert into archive table (raw query — ArchivedAuditLog has no FK constraints)
      await this.prisma.$executeRaw`
        INSERT INTO "ArchivedAuditLog" (
          "id", "tenantId", "actorUserId", "action", "resourceType",
          "resourceId", "metadata", "ip", "userAgent", "createdAt", "archivedAt"
        )
        SELECT
          "id", "tenantId", "actorUserId", "action"::"text", "resourceType",
          "resourceId", "metadata", "ip", "userAgent", "createdAt", NOW()
        FROM "AuditLog"
        WHERE "id" = ANY(${ids})
        ON CONFLICT ("id") DO NOTHING
      `;

      // Delete from active table
      await this.prisma.auditLog.deleteMany({ where: { id: { in: ids } } });

      totalArchived += records.length;
      this.logger.log(`Archived batch of ${records.length} audit logs (total: ${totalArchived})`);
    }

    this.logger.log(`Audit archiving complete. Total archived: ${totalArchived}`);
    return { archived: totalArchived };
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
