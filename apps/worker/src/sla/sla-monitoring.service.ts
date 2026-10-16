import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeUrl } from '../common/ssrf-guard';
import Redis from 'ioredis';
import nodemailer, { Transporter } from 'nodemailer';

export type SlaThreshold = 'WARNING_75' | 'WARNING_90' | 'BREACHED';

export interface SlaEvaluationResult {
  evaluated: number;
  warnings75: number;
  warnings90: number;
  breaches: number;
  alertsSent: number;
}

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
    } catch (err) {
      this.logger.warn(`Failed to initialize Redis client for SLA monitoring: ${(err as Error).message}`);
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

    const openOrders = await this.prisma.serviceOrder.findMany({
      where: {
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
        tenant: {
          select: {
            id: true,
            tradeName: true,
            legalName: true,
          },
        },
      },
      orderBy: { deadlineAt: 'asc' },
    });

    result.evaluated = openOrders.length;

    for (const order of openOrders) {
      try {
        const totalDurationMs = order.deadlineAt.getTime() - order.createdAt.getTime();
        const elapsedMs = now.getTime() - order.createdAt.getTime();
        const percentElapsed = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 100;
        const isBreached = now.getTime() >= order.deadlineAt.getTime() || percentElapsed >= 100;

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

        const shouldAlert = await this.checkAndSetIdempotency(order.tenantId, order.id, primaryThreshold);
        if (!shouldAlert) {
          continue;
        }

        // Mark any lower threshold as bypassed so it never triggers backwards
        await this.markBypassedThresholds(order.tenantId, order.id, primaryThreshold, order.deadlineAt);

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
        }

        // Dispatch notifications via configured channels
        const delayMinutes = Math.max(0, Math.round((now.getTime() - order.deadlineAt.getTime()) / 60000));
        await this.dispatchNotifications(order, primaryThreshold, percentElapsed, delayMinutes);

        result.alertsSent++;
      } catch (err) {
        this.logger.error(`Error evaluating SLA for order ${order.id}: ${(err as Error).message}`);
      }
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
  async checkAndSetIdempotency(tenantId: string, orderId: string, threshold: SlaThreshold): Promise<boolean> {
    const redisKey = `sla:alert:${orderId}:${threshold}`;

    // 1. Check Redis if available
    if (this.redisClient) {
      try {
        // SETNX with 7-day TTL (604800s)
        const setResponse = await this.redisClient.set(redisKey, '1', 'EX', 604800, 'NX');
        if (setResponse === null) {
          // Key already existed in Redis
          return false;
        }
      } catch (err) {
        this.logger.debug(`Redis check failed, falling back to DB: ${(err as Error).message}`);
      }
    }

    // 2. Check Database (SlaAuditEvent)
    const existing = await this.prisma.slaAuditEvent.findFirst({
      where: {
        tenantId,
        orderId,
        eventType: threshold,
      },
    });

    if (existing) {
      // Re-populate Redis key if it was missing
      if (this.redisClient) {
        try {
          await this.redisClient.set(redisKey, '1', 'EX', 604800);
        } catch {
          // ignore
        }
      }
      return false;
    }

    return true;
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
      const redisKey = `sla:alert:${orderId}:${bypassed}`;
      if (this.redisClient) {
        try {
          await this.redisClient.set(redisKey, '1', 'EX', 604800);
        } catch {
          // ignore
        }
      }

      const exists = await this.prisma.slaAuditEvent.findFirst({
        where: { tenantId, orderId, eventType: bypassed },
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

  private async recordSlaBreachEvent(order: { id: string; tenantId: string; deadlineAt: Date; status: any }, now: Date) {
    const existing = await this.prisma.slaEvent.findFirst({
      where: {
        serviceOrderId: order.id,
        breachedAt: { not: null },
      },
    });

    if (!existing) {
      const delayMinutes = Math.max(0, Math.round((now.getTime() - order.deadlineAt.getTime()) / 60000));
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
      tenant?: { tradeName?: string | null; legalName?: string | null } | null;
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

      if (configs.length === 0) {
        return;
      }

      const clientName = order.tenant?.tradeName || order.tenant?.legalName || 'Provedor';
      const label =
        threshold === 'BREACHED'
          ? '🚨 VIOLAÇÃO DE SLA'
          : threshold === 'WARNING_90'
            ? '⚠️ ALERTA 90% SLA'
            : '⏳ AVISO 75% SLA';

      const payload = {
        trigger: 'SLA_BREACH_WARNING',
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
            const response = await fetch(cfg.target, {
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
              `*Prazo Limite:* ${order.deadlineAt.toLocaleString('pt-BR')}\n` +
              (threshold === 'BREACHED' ? `*Atraso:* ${delayMinutes} minutos\n` : `*Decorrido:* ${Math.round(percentElapsed)}%\n`);

            const waBody = JSON.stringify({
              number: cfg.target,
              textMessage: { text: messageText },
              message: messageText,
              metadata: payload,
            });

            await fetch(cfg.target, {
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
                `Prazo Limite: ${order.deadlineAt.toISOString()}\n` +
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
    } catch (err) {
      this.logger.error(`Error in dispatchNotifications for order ${order.id}: ${(err as Error).message}`);
    }
  }
}
