import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeUrl, safeFetch } from '../common/ssrf-guard';
import Redis from 'ioredis';
import nodemailer, { Transporter } from 'nodemailer';
import { businessMinutesBetween, defaultDays, type TenantCalendar } from './business-clock';

export type SlaThreshold = 'WARNING_75' | 'WARNING_90' | 'BREACHED';

export interface SlaEvaluationResult {
  evaluated: number;
  warnings75: number;
  warnings90: number;
  breaches: number;
  alertsSent: number;
}

const urgentHint = (threshold: SlaThreshold, priority: string) =>
  (threshold === 'BREACHED' || threshold === 'WARNING_90') &&
  (priority === 'ALTA' || priority === 'CRITICA');

@Injectable()
export class SlaMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaMonitoringService.name);
  private redisClient: Redis | null = null;
  private emailTransporter?: Transporter;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.initRedis();
    this.initEmail();
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
      this.redisClient = null;
    }
  }

  private initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 1000, 15000),
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn(`Redis connection warning in SlaMonitoringService: ${err.message}`);
      });
      // Com lazyConnect e sem fila offline, o cliente nunca conectava sozinho: todo GET falhava
      // e a checagem caía no banco a cada minuto. Conecta já; o retryStrategy cuida das quedas.
      this.redisClient.connect().catch((err: Error) => {
        this.logger.warn(`Redis unavailable for SLA monitoring, using DB: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(
        `Failed to initialize Redis client for SLA monitoring: ${(err as Error).message}`,
      );
      this.redisClient = null;
    }
  }

  private initEmail() {
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Main evaluation method called periodically by the BullMQ processor.
   */
  async evaluateOpenOrders(): Promise<SlaEvaluationResult> {
    const now = new Date();
    const result: SlaEvaluationResult = {
      evaluated: 0,
      warnings75: 0,
      warnings90: 0,
      breaches: 0,
      alertsSent: 0,
    };

    const calendars = new Map<string, TenantCalendar>();
    let cursor: string | undefined;
    while (true) {
      const openOrders = await this.prisma.serviceOrder.findMany({
        where: {
          slaEligible: true,
          pausedAt: null,
          deletedAt: null,
          status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
        },
        select: {
          id: true,
          tenantId: true,
          protocol: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          deadlineAt: true,
          createdAt: true,
          requester: true,
          occurrence: {
            select: {
              provider: true,
              customer: { select: { tradeName: true, legalName: true } },
            },
          },
          tenant: {
            select: {
              id: true,
              tradeName: true,
              legalName: true,
              timezone: true,
            },
          },
        },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      result.evaluated += openOrders.length;

      for (const order of openOrders) {
        try {
          // Percentual em minutos úteis, com o mesmo calendário do prazo (C-027): sem avisos
          // no fim de semana para O.S. aberta na sexta.
          const calendar = await this.calendarFor(
            order.tenantId,
            order.tenant?.timezone,
            calendars,
          );
          const totalBiz = businessMinutesBetween(order.createdAt, order.deadlineAt, calendar);
          const elapsedBiz = businessMinutesBetween(order.createdAt, now, calendar);
          const percentElapsed =
            totalBiz > 0
              ? (elapsedBiz / totalBiz) * 100
              : now.getTime() >= order.deadlineAt.getTime()
                ? 100
                : 0;
          const isBreached = now.getTime() >= order.deadlineAt.getTime();

          let primaryThreshold: SlaThreshold | null = null;
          if (isBreached) {
            primaryThreshold = 'BREACHED';
            result.breaches++;
          } else if (percentElapsed >= 90) {
            primaryThreshold = 'WARNING_90';
            result.warnings90++;
          } else if (percentElapsed >= 75) {
            primaryThreshold = 'WARNING_75';
            result.warnings75++;
          }

          if (!primaryThreshold) {
            continue;
          }

          const shouldAlert = await this.checkAndSetIdempotency(
            order.tenantId,
            order.id,
            primaryThreshold,
            order.deadlineAt,
          );
          if (!shouldAlert) {
            continue;
          }

          // Mark any lower threshold as bypassed so it never triggers backwards
          await this.markBypassedThresholds(
            order.tenantId,
            order.id,
            primaryThreshold,
            order.deadlineAt,
          );

          // Record persistent SLA audit event
          await this.prisma.slaAuditEvent.create({
            data: {
              tenantId: order.tenantId,
              orderId: order.id,
              eventType: primaryThreshold,
              deadlineAt: order.deadlineAt,
              reason: `SLA ${primaryThreshold === 'BREACHED' ? 'violation' : primaryThreshold === 'WARNING_90' ? '90% warning' : '75% warning'} (${Math.round(percentElapsed)}% elapsed)`,
              metadata: {
                threshold: primaryThreshold,
                percentElapsed: Math.round(percentElapsed),
                priority: order.priority,
                status: order.status,
                protocol: order.protocol,
                detectedAt: now.toISOString(),
              },
            },
          });

          // Record in SlaEvent if breached
          if (primaryThreshold === 'BREACHED') {
            await this.recordSlaBreachEvent(order, now);
            await this.publishBreachToWorkflows(order.tenantId, order.id);
          }

          // Dispatch notifications via configured channels
          const delayMinutes = Math.max(
            0,
            Math.round((now.getTime() - order.deadlineAt.getTime()) / 60000),
          );
          await this.dispatchNotifications(order, primaryThreshold, percentElapsed, delayMinutes);
          // Trava gravada só depois do registro e do envio: uma falha não bloqueia o alerta (C-028).
          await this.markAlerted(order.id, primaryThreshold, order.deadlineAt);

          result.alertsSent++;
        } catch (err) {
          this.logger.error(
            `Error evaluating SLA for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }

      if (openOrders.length < 500) break;
      cursor = openOrders[openOrders.length - 1].id;
    }

    this.logger.log(
      `SLA evaluation complete: ${result.evaluated} evaluated, ${result.warnings75} at 75%, ${result.warnings90} at 90%, ${result.breaches} breaches, ${result.alertsSent} alerts dispatched.`,
    );

    return result;
  }

  /**
   * Dual-layer idempotency check:
   * 1. Redis distributed lock/key (7 days TTL)
   * 2. Postgres SlaAuditEvent check
   * Returns true if the alert should be sent, false if already alerted.
   */
  async checkAndSetIdempotency(
    tenantId: string,
    orderId: string,
    threshold: SlaThreshold,
    deadlineAt?: Date,
  ): Promise<boolean> {
    // A chave inclui o prazo vigente: prazo novo (retomada de pausa, reabertura) volta a
    // avisar (C-028). Só lê aqui; a gravação é feita em markAlerted, depois do envio.
    const redisKey = this.alertKey(orderId, threshold, deadlineAt);
    if (this.redisClient) {
      try {
        if (await this.redisClient.get(redisKey)) return false;
      } catch (err) {
        this.logger.debug(`Redis check failed, falling back to DB: ${(err as Error).message}`);
      }
    }
    const existing = await this.prisma.slaAuditEvent.findFirst({
      where: {
        tenantId,
        orderId,
        eventType: threshold,
        ...(deadlineAt ? { deadlineAt } : {}),
      },
    });
    if (existing) {
      await this.markAlerted(orderId, threshold, deadlineAt);
      return false;
    }
    return true;
  }

  private alertKey(orderId: string, threshold: SlaThreshold, deadlineAt?: Date) {
    return `sla:alert:${orderId}:${threshold}${deadlineAt ? `:${deadlineAt.getTime()}` : ''}`;
  }

  private async markAlerted(orderId: string, threshold: SlaThreshold, deadlineAt?: Date) {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(this.alertKey(orderId, threshold, deadlineAt), '1', 'EX', 604800);
    } catch {
      // o banco continua sendo a fonte da idempotência
    }
  }

  private async calendarFor(
    tenantId: string,
    timezone: string | null | undefined,
    cache: Map<string, TenantCalendar>,
  ): Promise<TenantCalendar> {
    const cached = cache.get(tenantId);
    if (cached) return cached;
    const [rows, exceptions] = await Promise.all([
      this.prisma.businessCalendar.findMany({ where: { tenantId } }),
      this.prisma.businessCalendarException.findMany({ where: { tenantId } }),
    ]);
    const calendar: TenantCalendar = {
      timezone: timezone || 'America/Fortaleza',
      days: defaultDays(rows),
      exceptions: new Map(
        exceptions.map((e) => [
          e.date.toISOString().slice(0, 10),
          { isWorkDay: e.isWorkDay, startTime: e.startTime, endTime: e.endTime },
        ]),
      ),
    };
    cache.set(tenantId, calendar);
    return calendar;
  }

  /**
   * Prevents back-firing of lower thresholds if an order jumped straight to a higher threshold.
   */
  private async markBypassedThresholds(
    tenantId: string,
    orderId: string,
    currentThreshold: SlaThreshold,
    deadlineAt: Date,
  ): Promise<void> {
    const toBypass: SlaThreshold[] = [];
    if (currentThreshold === 'BREACHED') {
      toBypass.push('WARNING_75', 'WARNING_90');
    } else if (currentThreshold === 'WARNING_90') {
      toBypass.push('WARNING_75');
    }

    for (const bypassed of toBypass) {
      await this.markAlerted(orderId, bypassed, deadlineAt);

      const exists = await this.prisma.slaAuditEvent.findFirst({
        where: { tenantId, orderId, eventType: bypassed, deadlineAt },
      });

      if (!exists) {
        await this.prisma.slaAuditEvent.create({
          data: {
            tenantId,
            orderId,
            eventType: bypassed,
            deadlineAt,
            reason: `Bypassed automatically due to higher threshold ${currentThreshold}`,
            metadata: { bypassedBy: currentThreshold },
          },
        });
      }
    }
  }

  /** Publica a violação para as regras de workflow "SLA violado" da API (C-036). */
  private async publishBreachToWorkflows(tenantId: string, orderId: string) {
    const token = process.env.WORKER_API_TOKEN;
    const base = (process.env.API_INTERNAL_URL || 'http://api:3001').replace(/\/+$/, '');
    if (!token) return;
    try {
      const response = await fetch(`${base}/workflows/internal/sla-breach`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, orderId }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) this.logger.warn(`Workflow de SLA violado respondeu ${response.status}`);
    } catch (err) {
      this.logger.warn(`Falha ao publicar SLA violado: ${(err as Error).message}`);
    }
  }

  private async recordSlaBreachEvent(
    order: { id: string; tenantId: string; deadlineAt: Date; status: any },
    now: Date,
  ) {
    const existing = await this.prisma.slaEvent.findFirst({
      where: {
        serviceOrderId: order.id,
        breachedAt: { not: null },
        deadlineAt: order.deadlineAt,
      },
    });

    if (!existing) {
      const delayMinutes = Math.max(
        0,
        Math.round((now.getTime() - order.deadlineAt.getTime()) / 60000),
      );
      await this.prisma.slaEvent.create({
        data: {
          tenantId: order.tenantId,
          serviceOrderId: order.id,
          deadlineAt: order.deadlineAt,
          breachedAt: now,
          delayMinutes,
          snapshotStatus: order.status,
        },
      });
    }
  }

  private async dispatchNotifications(
    order: {
      id: string;
      tenantId: string;
      protocol: string;
      title: string;
      priority: string;
      status: string;
      deadlineAt: Date;
      requester?: string | null;
      occurrence?: {
        provider?: string | null;
        customer?: { tradeName?: string | null; legalName?: string | null } | null;
      } | null;
      tenant?: {
        tradeName?: string | null;
        legalName?: string | null;
        timezone?: string | null;
      } | null;
    },
    threshold: SlaThreshold,
    percentElapsed: number,
    delayMinutes: number,
  ) {
    try {
      const configs = await this.prisma.notificationConfig.findMany({
        where: {
          tenantId: order.tenantId,
          trigger: 'SLA_BREACH_WARNING',
          active: true,
        },
      });

      if (configs.length === 0 && !urgentHint(threshold, order.priority)) {
        return;
      }

      // "Cliente" é o provedor atendido, não o tenant (a própria Ajust) (C-029).
      const clientName =
        order.occurrence?.customer?.tradeName ||
        order.occurrence?.customer?.legalName ||
        order.occurrence?.provider ||
        order.requester ||
        'Provedor';
      const deadlineText = order.deadlineAt.toLocaleString('pt-BR', {
        timeZone: order.tenant?.timezone || 'America/Fortaleza',
      });
      const label =
        threshold === 'BREACHED'
          ? '🚨 VIOLAÇÃO DE SLA'
          : threshold === 'WARNING_90'
            ? '⚠️ ALERTA 90% SLA'
            : '⏳ AVISO 75% SLA';

      // Plantonista atual recebe os alertas graves de O.S. alta/crítica (decisão C-059).
      const urgent =
        (threshold === 'BREACHED' || threshold === 'WARNING_90') &&
        (order.priority === 'ALTA' || order.priority === 'CRITICA');
      const onCall = urgent ? await this.currentOnCall(order.tenantId) : null;

      const payload = {
        trigger: 'SLA_BREACH_WARNING',
        ...(onCall ? { onCall: { name: onCall.name, email: onCall.email } } : {}),
        threshold,
        tenantId: order.tenantId,
        orderId: order.id,
        protocol: order.protocol,
        title: order.title,
        priority: order.priority,
        status: order.status,
        client: clientName,
        deadlineAt: order.deadlineAt.toISOString(),
        percentElapsed: Math.round(percentElapsed),
        delayMinutes,
        timestamp: new Date().toISOString(),
      };

      for (const cfg of configs) {
        try {
          if (cfg.channel === 'WEBHOOK' || cfg.channel === 'SLACK') {
            await assertSafeUrl(cfg.target);
            const response = await safeFetch(cfg.target, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
              this.logger.warn(`Webhook ${cfg.target} returned status ${response.status}`);
            }
          } else if ((cfg.channel as string) === 'WHATSAPP') {
            await assertSafeUrl(cfg.target);
            const messageText =
              `*${label}*\n` +
              `*Protocolo:* ${order.protocol}\n` +
              `*Cliente:* ${clientName}\n` +
              `*Título:* ${order.title}\n` +
              `*Prioridade:* ${order.priority}\n` +
              `*Prazo Limite:* ${deadlineText}\n` +
              (threshold === 'BREACHED'
                ? `*Atraso:* ${delayMinutes} minutos\n`
                : `*Decorrido:* ${Math.round(percentElapsed)}%\n`) +
              (onCall ? `*Plantonista:* ${onCall.name}\n` : '');

            const waBody = JSON.stringify({
              number: cfg.target,
              textMessage: { text: messageText },
              message: messageText,
              metadata: payload,
            });

            await safeFetch(cfg.target, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: waBody,
              signal: AbortSignal.timeout(10000),
            });
          } else if (cfg.channel === 'EMAIL' && this.emailTransporter) {
            await this.emailTransporter.sendMail({
              from: process.env.SMTP_FROM || 'noreply@ajusterp.com.br',
              to: cfg.target,
              subject: `[Ajust ERP] ${label} - Protocolo ${order.protocol}`,
              text:
                `${label}\n\n` +
                `Protocolo: ${order.protocol}\n` +
                `Cliente: ${clientName}\n` +
                `Título: ${order.title}\n` +
                `Prioridade: ${order.priority}\n` +
                `Status: ${order.status}\n` +
                `Prazo Limite: ${deadlineText}\n` +
                `Tempo decorrido: ${Math.round(percentElapsed)}%\n` +
                (threshold === 'BREACHED' ? `Atraso: ${delayMinutes} minutos\n` : ''),
            });
          }
        } catch (deliveryErr) {
          this.logger.warn(
            `Failed to dispatch SLA alert to ${cfg.channel} (${cfg.target}): ${(deliveryErr as Error).message}`,
          );
        }
      }
      if (onCall?.email && this.emailTransporter) {
        try {
          await this.emailTransporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@ajusterp.com.br',
            to: onCall.email,
            subject: `[Ajust ERP] ${label} - Protocolo ${order.protocol} (você está de plantão)`,
            text:
              `${label}\n\nProtocolo: ${order.protocol}\nCliente: ${clientName}\n` +
              `Título: ${order.title}\nPrioridade: ${order.priority}\nPrazo Limite: ${deadlineText}\n`,
          });
        } catch (mailErr) {
          this.logger.warn(`Falha ao avisar o plantonista: ${(mailErr as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(
        `Error in dispatchNotifications for order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

  private async currentOnCall(tenantId: string) {
    const now = new Date();
    const schedule = await this.prisma.onCallSchedule
      ?.findFirst({
        where: { tenantId, startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { startsAt: 'desc' },
        select: { user: { select: { name: true, email: true } } },
      })
      .catch(() => null);
    return schedule?.user ?? null;
  }
}
