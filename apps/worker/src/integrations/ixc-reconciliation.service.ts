import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common.secrets';
import { ServiceOrderStatus, ServiceOrderType, Priority } from '@prisma/client';

@Injectable()
export class IxcReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IxcReconciliationService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunAt: string | null = null;
  private lastProcessed = 0;
  private lastErrors = 0;
  private lastErrorMessage: string | null = null;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit() {
    const intervalMs = Number(process.env.IXC_RECONCILE_INTERVAL_MS || 300000);

    // run a first pass right away, then keep periodic reconciliation.
    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    this.logger.log(`IXC reconciliation loop started. intervalMs=${intervalMs}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;

    try {
      const integrations = await this.prisma.providerIntegration.findMany({
        where: {
          provider: 'IXC'
        },
        select: {
          id: true,
          tenantId: true,
          status: true,
          baseUrl: true,
          apiTokenEnc: true,
          lastSyncAt: true
        }
      });

      const active = integrations.filter((it) => !['INACTIVE', 'DISABLED'].includes((it.status || '').toUpperCase()));

      if (active.length === 0) {
        this.lastRunAt = new Date().toISOString();
        this.lastProcessed = 0;
        return;
      }

      const now = new Date();
      let processedDeltas = 0;
      let errors = 0;

      for (const integration of active) {
        try {
          const deltas = await this.fetchDelta(integration.baseUrl, integration.apiTokenEnc, integration.lastSyncAt);
          for (const delta of deltas) {
            const op = await this.applyDelta(integration.tenantId, delta);
            if (op) processedDeltas += 1;
          }

          await this.prisma.syncEvent.create({
            data: {
              tenantId: integration.tenantId,
              integrationId: integration.id,
              source: 'POLLING',
              eventType: 'IXC_RECONCILIATION_TICK',
              status: 'PROCESSED',
              processedAt: now
            }
          });

          await this.prisma.providerIntegration.update({
            where: { id: integration.id },
            data: { lastSyncAt: now }
          });
        } catch (error: any) {
          errors += 1;
          this.lastErrorMessage = error?.message || 'unknown_error';
          await this.prisma.syncEvent.create({
            data: {
              tenantId: integration.tenantId,
              integrationId: integration.id,
              source: 'POLLING',
              eventType: 'IXC_RECONCILIATION_TICK',
              status: 'FAILED',
              errorMessage: this.lastErrorMessage,
              processedAt: now
            }
          });
        }
      }

      this.lastRunAt = now.toISOString();
      this.lastProcessed = processedDeltas;
      this.lastErrors = errors;
    } catch (error: any) {
      this.logger.error(`IXC reconciliation failed: ${error?.message || 'unknown_error'}`);
      this.lastErrorMessage = error?.message || 'unknown_error';
    } finally {
      this.running = false;
    }
  }

  getStatus() {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastProcessed: this.lastProcessed,
      lastErrors: this.lastErrors,
      lastErrorMessage: this.lastErrorMessage
    };
  }

  private async fetchDelta(baseUrl: string, apiTokenEnc: string | null, lastSyncAt: Date | null) {
    const mockMode = (process.env.IXC_MOCK_RECONCILE || 'false').toLowerCase() === 'true';
    if (mockMode) {
      return [];
    }

    const since = (lastSyncAt || new Date(Date.now() - 5 * 60 * 1000)).toISOString();
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/tickets/delta?since=${encodeURIComponent(since)}`;
    const token = decryptSecret(apiTokenEnc);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.IXC_HTTP_TIMEOUT_MS || 8000));

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (!response.ok) {
        throw new Error(`IXC delta HTTP ${response.status}`);
      }

      const body = await response.json();
      const orders = Array.isArray(body?.orders) ? body.orders : [];
      return orders as Array<Record<string, any>>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async applyDelta(tenantId: string, delta: Record<string, any>) {
    const externalProtocol = String(delta.externalProtocol || '').trim();
    if (!externalProtocol) return false;

    const existing = await this.prisma.serviceOrder.findFirst({
      where: {
        tenantId,
        externalProtocol,
        deletedAt: null
      }
    });

    const mappedStatus = this.mapStatus(delta.status);
    const type = this.mapType(delta.type);
    const priority = this.mapPriority(delta.priority);
    const title = typeof delta.title === 'string' && delta.title.trim() ? delta.title.trim() : null;
    const description =
      typeof delta.description === 'string' && delta.description.trim() ? delta.description.trim() : null;
    const externalUpdatedAt = delta.updatedAt ? new Date(delta.updatedAt) : null;

    if (existing) {
      const canApplySgp = !externalUpdatedAt || externalUpdatedAt.getTime() >= existing.updatedAt.getTime();
      if (!canApplySgp) return false;

      await this.prisma.serviceOrder.update({
        where: { id: existing.id },
        data: {
          sourceSystem: 'SGP',
          ...(mappedStatus ? { status: mappedStatus } : {}),
          ...(title ? { title } : {}),
          ...(description ? { description } : {}),
          occurrences: {
            create: {
              sourceSystem: 'POLLING',
              message: `Reconciliacao IXC aplicada (externalProtocol=${externalProtocol}).`
            }
          }
        }
      });
      return true;
    }

    const protocol = await this.buildProtocol(tenantId);
    await this.prisma.serviceOrder.create({
      data: {
        tenantId,
        protocol,
        externalProtocol,
        sourceSystem: 'SGP',
        type,
        priority,
        status: mappedStatus || 'ABERTA',
        title: title || `IXC Delta ${externalProtocol}`,
        description: description || 'Criada via reconciliacao IXC.',
        deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        occurrences: {
          create: {
            sourceSystem: 'POLLING',
            message: `OS criada via reconciliacao IXC (externalProtocol=${externalProtocol}).`
          }
        }
      }
    });
    return true;
  }

  private mapStatus(status?: string): ServiceOrderStatus | null {
    if (!status) return null;
    const normalized = status.trim().toLowerCase();
    if (['aberta', 'open', 'novo'].includes(normalized)) return 'ABERTA';
    if (['em_analise', 'em analise', 'triagem', 'analysis'].includes(normalized)) return 'EM_ANALISE';
    if (['campo', 'ag_campo', 'ag campo'].includes(normalized)) return 'AG_CAMPO';
    if (['terceiros', 'ag_terceiros', 'ag terceiros'].includes(normalized)) return 'AG_TERCEIROS';
    if (['resolvida', 'resolved'].includes(normalized)) return 'RESOLVIDA';
    if (['fechada', 'closed'].includes(normalized)) return 'FECHADA';
    if (['cancelada', 'cancelled', 'canceled'].includes(normalized)) return 'CANCELADA';
    return null;
  }

  private mapType(type?: string): ServiceOrderType {
    const normalized = String(type || '').trim().toUpperCase();
    const allowed: ServiceOrderType[] = [
      'ROMPIMENTO',
      'LENTIDAO',
      'CONFIGURACAO_ONU',
      'TROCA_SENHA',
      'CANCELAMENTO',
      'AUDITORIA',
      'INSTALACAO',
      'BGP'
    ];
    return allowed.includes(normalized as ServiceOrderType) ? (normalized as ServiceOrderType) : 'AUDITORIA';
  }

  private mapPriority(priority?: string): Priority {
    const normalized = String(priority || '').trim().toUpperCase();
    const allowed: Priority[] = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'];
    return allowed.includes(normalized as Priority) ? (normalized as Priority) : 'NORMAL';
  }

  private async buildProtocol(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.serviceOrder.count({ where: { tenantId } });
    return `${year}${String(100000 + count + 1).padStart(6, '0')}`;
  }
}
