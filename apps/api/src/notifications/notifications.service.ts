import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationTrigger, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeUrl, safeFetch } from '../common/ssrf-guard';
import { EmailService } from '../common/email.service';
import type { EffectRunner } from '../service-orders/lifecycle-outbox.service';
type DeliveryOptions = { eventId: string; effect: EffectRunner };

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
  async dispatch(
    tenantId: string,
    trigger: string,
    payload: Record<string, string>,
    delivery?: DeliveryOptions,
  ) {
    try {
      const configs = await this.prisma.notificationConfig.findMany({
        where: { tenantId, trigger: trigger as NotificationTrigger, active: true },
      });
      for (const cfg of configs) {
        const send = async () => {
          if (cfg.channel === 'WEBHOOK' || cfg.channel === 'SLACK') {
            const body = JSON.stringify({
              trigger,
              tenantId,
              ...payload,
              timestamp: new Date().toISOString(),
            });
            try {
              await assertSafeUrl(cfg.target);
              const response = await safeFetch(cfg.target, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  ...(delivery ? { 'idempotency-key': `${delivery.eventId}:${cfg.id}` } : {}),
                },
                body,
                signal: AbortSignal.timeout(10_000),
              });
              if (!response.ok) {
                throw new Error(`Webhook returned HTTP ${response.status}`);
              }
            } catch (err) {
              if (delivery) throw err;
              this.logger.warn(`Webhook dispatch failed for ${cfg.id}: ${(err as Error).message}`);
            }
          }
          if (cfg.channel === 'EMAIL') {
            const email = delivery
              ? this.emailService.sendEmailConfirmed.bind(this.emailService)
              : this.emailService.sendEmail.bind(this.emailService);
            await email(
              cfg.target,
              `Ajust ERP - ${trigger}`,
              `Evento: ${trigger}\nTenant: ${tenantId}\nProtocolo: ${payload.protocol || '-'}\n\n${JSON.stringify(payload, null, 2)}`,
            );
          }
          if ((cfg.channel as string) === 'WHATSAPP') {
            // Despacho para Gateway WhatsApp (Evolution API / Z-API / Webhook)
            const messageText =
              payload.message ||
              `*🚨 [AJUST ERP - ${trigger}]*\n` +
                `*Protocolo:* ${payload.protocol || '-'}\n` +
                `*Provedor:* ${payload.provider || '-'}\n` +
                `*Título:* ${payload.title || '-'}\n` +
                (payload.pdfUrl ? `\n*📄 Relatório PDF:* ${payload.pdfUrl}` : '');

            const waBody = JSON.stringify({
              number: payload.targetNumber || payload.groupJid || cfg.target,
              textMessage: { text: messageText },
              message: messageText,
              pdfUrl: payload.pdfUrl,
              metadata: payload,
            });

            try {
              await assertSafeUrl(cfg.target);
              const response = await safeFetch(cfg.target, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  ...(delivery ? { 'idempotency-key': `${delivery.eventId}:${cfg.id}` } : {}),
                },
                body: waBody,
                signal: AbortSignal.timeout(10_000),
              });
              if (!response.ok) throw new Error(`WhatsApp returned HTTP ${response.status}`);
            } catch (err) {
              if (delivery) throw err;
              this.logger.warn(`WhatsApp dispatch failed for ${cfg.id}: ${(err as Error).message}`);
            }
          }
        };
        if (delivery) await delivery.effect(`notificação:${cfg.id}`, send);
        else await send();
      }
    } catch (err) {
      if (delivery) throw err;
      this.logger.error('Notification dispatch error', err);
    }
  }

  /** Disparo sob demanda de O.S. para grupos/números de WhatsApp com link direto do PDF */
  async dispatchWhatsAppOrder(
    tenantId: string,
    input: { orderId: string; target?: string; customMessage?: string },
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.orderId, tenantId },
      include: {
        occurrence: { select: { provider: true } },
      },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');

    const providerName = order.requester || order.occurrence?.provider || 'Provedor';
    // Sem IP fixo de produção: sem URL pública configurada, a mensagem sai sem link (C-033).
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.WEB_BASE_URL || '').replace(
      /\/+$/,
      '',
    );
    const pdfUrl = baseUrl ? `${baseUrl}/gerencia?view=ordens&exportPdf=${order.id}` : '';
    const deadline = await this.formatInTenantZone(tenantId, order.deadlineAt);

    const formattedMessage =
      input.customMessage ||
      `*🚨 [AJUST NOC] ORDEM DE SERVIÇO: ${order.protocol}*\n\n` +
        `*Provedor:* ${providerName}\n` +
        `*Tipo:* ${order.type}\n` +
        `*Prioridade:* ${order.priority}\n` +
        `*Status:* ${order.status}\n` +
        `*Responsável:* ${order.analystName || 'Equipe NOC'}\n` +
        `*Prazo SLA:* ${deadline}\n\n` +
        `*Título:* ${order.title}\n` +
        `*Descrição:* ${order.description.slice(0, 300)}${order.description.length > 300 ? '...' : ''}\n\n` +
        (pdfUrl ? `*📄 Relatório Técnico / PDF:* ${pdfUrl}` : '');

    // Dispara via canais configurados de WhatsApp ou webhook geral
    await this.dispatch(tenantId, 'ORDER_ESCALATED', {
      orderId: order.id,
      protocol: order.protocol,
      provider: providerName,
      title: order.title,
      pdfUrl,
      message: formattedMessage,
      targetNumber: input.target || '',
    });

    return {
      success: true,
      protocol: order.protocol,
      target: input.target || 'Canais WhatsApp Configurados',
      message: formattedMessage,
      pdfUrl,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Aviso de O.S. fechada no gatilho próprio ORDER_CLOSED (C-033): não usa o canal de
   * escalonamento, não leva descrição interna e mostra o horário no fuso do tenant.
   */
  async notifyOrderClosed(tenantId: string, orderId: string, delivery?: DeliveryOptions) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { occurrence: { select: { provider: true } } },
    });
    if (!order) return;
    const provider = order.requester || order.occurrence?.provider || 'Provedor';
    const closedAt = await this.formatInTenantZone(tenantId, order.closedAt ?? new Date());
    const message =
      `*✅ O.S. ${order.protocol} fechada*\n\n` +
      `*Provedor:* ${provider}\n` +
      `*Título:* ${order.title}\n` +
      `*Responsável:* ${order.analystName || 'Equipe Ajust'}\n` +
      `*Fechada em:* ${closedAt}`;
    await this.dispatch(
      tenantId,
      'ORDER_CLOSED',
      {
        orderId: order.id,
        protocol: order.protocol,
        provider,
        title: order.title,
        message,
      },
      delivery,
    );
  }

  private async formatInTenantZone(tenantId: string, date: Date) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return new Date(date).toLocaleString('pt-BR', {
      timeZone: tenant?.timezone || 'America/Fortaleza',
    });
  }

  private async validateTarget(channel: NotificationChannel, target: string): Promise<void> {
    if (channel === NotificationChannel.EMAIL) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
        throw new BadRequestException('Invalid notification email target.');
      }
      return;
    }
    // WhatsApp pode ser uma URL de Gateway (ex: http://...) ou identificador de grupo/telefone
    if ((channel as string) === 'WHATSAPP') {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        await assertSafeUrl(target);
      }
      return;
    }
    await assertSafeUrl(target);
  }
}
