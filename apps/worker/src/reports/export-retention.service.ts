import { Inject, Injectable, Logger } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { validatePathWithinBase } from '../path-security';

@Injectable()
export class ExportRetentionService {
  private readonly logger = new Logger(ExportRetentionService.name);
  private running = false;
  private lastRunAt: string | null = null;
  private lastProcessed = 0;
  private lastErrors = 0;
  private lastErrorMessage: string | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getStatus() {
    return {
      running: this.running,
      retentionDays: this.retentionDays(),
      lastRunAt: this.lastRunAt,
      lastProcessed: this.lastProcessed,
      lastErrors: this.lastErrors,
      lastErrorMessage: this.lastErrorMessage,
    };
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;

    try {
      const cutoff = new Date(Date.now() - this.retentionDays() * 24 * 60 * 60 * 1000);
      const targets = await this.prisma.reportExport.findMany({
        where: {
          reportType: 'service_orders_csv',
          fileUrl: { not: null },
          createdAt: { lt: cutoff },
        },
        select: {
          id: true,
          tenantId: true,
          fileUrl: true,
        },
        take: 500,
      });

      let processed = 0;
      let errors = 0;

      for (const target of targets) {
        if (!target.fileUrl) continue;
        try {
          const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
          const safePath = validatePathWithinBase(uploadRoot, target.fileUrl);
          await unlink(safePath).catch((error: NodeJS.ErrnoException) => {
            if (error?.code !== 'ENOENT') throw error;
          });

          await this.prisma.reportExport.update({
            where: { id: target.id },
            data: {
              fileUrl: null,
              status: 'EXPIRED',
            },
          });

          await this.prisma.auditLog.create({
            data: {
              tenantId: target.tenantId,
              actorUserId: null,
              action: 'EXPORT',
              resourceType: 'report_export',
              resourceId: target.id,
              metadata: {
                operation: 'retention_cleanup',
                retentionDays: this.retentionDays(),
              },
            },
          });

          processed += 1;
        } catch (error: any) {
          errors += 1;
          this.lastErrorMessage = error?.message || 'unknown_error';
        }
      }

      this.lastRunAt = new Date().toISOString();
      this.lastProcessed = processed;
      this.lastErrors = errors;
    } catch (error: any) {
      this.lastErrorMessage = error?.message || 'unknown_error';
      this.logger.error(`Export retention failed: ${this.lastErrorMessage}`);
    } finally {
      this.running = false;
    }
  }

  private retentionDays() {
    const value = Number(process.env.EXPORT_RETENTION_DAYS || 30);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
  }
}
