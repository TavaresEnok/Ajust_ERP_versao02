import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationTrigger, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeUrl } from '../common/ssrf-guard';
import { EmailService } from '../common/email.service';

export type NotificationConfigInput = {
  name?: string;
  channel?: NotificationChannel;
  trigger?: NotificationTrigger;
  target?: string;
  active?: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.notificationConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    input: NotificationConfigInput & {
      name: string;
      channel: NotificationChannel;
      trigger: NotificationTrigger;
      target: string;
    },
  ) {
    await this.validateTarget(input.channel, input.target);
    return this.prisma.notificationConfig.create({
      data: {
        tenantId,
        name: input.name,
        channel: input.channel,
        trigger: input.trigger,
        target: input.target,
        active: input.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, input: NotificationConfigInput) {
    const existing = await this.prisma.notificationConfig.findFirst({
      where: { id, tenantId },
      select: { id: true, channel: true, target: true },
    });
    if (!existing) throw new NotFoundException('Configuração de notificação não encontrada');
    await this.validateTarget(input.channel ?? existing.channel, input.target ?? existing.target);

    const data: Prisma.NotificationConfigUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    return this.prisma.notificationConfig.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.notificationConfig.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Configuração de notificação não encontrada');

    await this.prisma.notificationConfig.delete({ where: { id } });
    return { success: true };
  }

  /** Called internally by other services when events occur */
  async dispatch(tenantId: string, trigger: string, payload: Record<string, string>) {
    try {
      const configs = await this.prisma.notificationConfig.findMany({
        where: { tenantId, trigger: trigger as NotificationTrigger, active: true },
      });
      for (const cfg of configs) {
        if (cfg.channel === 'WEBHOOK' || cfg.channel === 'SLACK') {
          const body = JSON.stringify({
            trigger,
            tenantId,
            ...payload,
            timestamp: new Date().toISOString(),
          });
          try {
            await assertSafeUrl(cfg.target);
            const response = await fetch(cfg.target, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body,
              signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) {
              throw new Error(`Webhook returned HTTP ${response.status}`);
            }
          } catch (err) {
            this.logger.warn(`Webhook dispatch failed for ${cfg.id}: ${(err as Error).message}`);
          }
        }
        if (cfg.channel === 'EMAIL') {
          this.emailService.sendEmail(
            cfg.target,
            `Ajust ERP - ${trigger}`,
            `Evento: ${trigger}\nTenant: ${tenantId}\nProtocolo: ${payload.protocol || '-'}\n\n${JSON.stringify(payload, null, 2)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Notification dispatch error', err);
    }
  }

  private async validateTarget(channel: NotificationChannel, target: string): Promise<void> {
    if (channel === NotificationChannel.EMAIL) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
        throw new BadRequestException('Invalid notification email target.');
      }
      return;
    }
    await assertSafeUrl(target);
  }
}
