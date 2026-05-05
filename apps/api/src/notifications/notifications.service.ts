import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return (this.prisma as any).notificationConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, input: { name: string; channel: string; trigger: string; target: string; active?: boolean }) {
    return (this.prisma as any).notificationConfig.create({
      data: { tenantId, name: input.name, channel: input.channel, trigger: input.trigger, target: input.target, active: input.active ?? true },
    });
  }

  async update(tenantId: string, id: string, input: Record<string, any>) {
    return (this.prisma as any).notificationConfig.update({ where: { id }, data: input });
  }

  async remove(tenantId: string, id: string) {
    await (this.prisma as any).notificationConfig.delete({ where: { id } });
    return { success: true };
  }

  /** Called internally by other services when events occur */
  async dispatch(tenantId: string, trigger: string, payload: Record<string, string>) {
    try {
      const configs: any[] = await (this.prisma as any).notificationConfig.findMany({
        where: { tenantId, trigger, active: true },
      });
      for (const cfg of configs) {
        if (cfg.channel === 'WEBHOOK' || cfg.channel === 'SLACK') {
          const body = JSON.stringify({ trigger, tenantId, ...payload, timestamp: new Date().toISOString() });
          fetch(cfg.target, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
            .catch(err => this.logger.warn(`Webhook dispatch failed for ${cfg.id}: ${err.message}`));
        }
        if (cfg.channel === 'EMAIL') {
          // Stub — in production integrate nodemailer or SendGrid
          this.logger.log(`[EMAIL STUB] To: ${cfg.target} | Trigger: ${trigger} | OS: ${payload.protocol || '-'}`);
        }
      }
    } catch (err) {
      this.logger.error('Notification dispatch error', err);
    }
  }
}
