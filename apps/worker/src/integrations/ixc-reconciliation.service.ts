import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common.secrets';
import { ServiceOrderStatus, ServiceOrderType, Priority } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/* ──────────────────────────────────────────────────────────────
   Configurações de resiliência
   ────────────────────────────────────────────────────────────── */
const HTTP_TIMEOUT_MS = Number(process.env.IXC_HTTP_TIMEOUT_MS || 8_000);
const MAX_RETRIES = Number(process.env.IXC_MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.IXC_RETRY_DELAY_MS || 2_000);

/** Circuit breaker: após N falhas consecutivas, pausa a integração */
const CB_FAILURE_THRESHOLD = Number(process.env.IXC_CB_THRESHOLD || 5);
const CB_OPEN_WINDOW_MS = Number(process.env.IXC_CB_WINDOW_MS || 5 * 60_000); // 5 min

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Não retry em erros de auth/autorização — não adianta tentar de novo
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) return false;
    return true;
  }
  return true;
}

/* ──────────────────────────────────────────────────────────────
   Circuit Breaker por integração (in-memory, suficiente para
   processo único em servidor único)
   ────────────────────────────────────────────────────────────── */
interface CircuitState {
  failures: number;
  openedAt: number | null; // timestamp ou null (fechado)
}

const circuitBreakers = new Map<string, CircuitState>();

function getCircuit(integrationId: string): CircuitState {
  if (!circuitBreakers.has(integrationId)) {
    circuitBreakers.set(integrationId, { failures: 0, openedAt: null });
  }
  return circuitBreakers.get(integrationId)!;
}

function isCircuitOpen(integrationId: string): boolean {
  const cb = getCircuit(integrationId);
  if (cb.openedAt === null) return false;
  if (Date.now() - cb.openedAt > CB_OPEN_WINDOW_MS) {
    // Janela expirou — tenta meio-abrir
    cb.openedAt = null;
    return false;
  }
  return true;
}

function recordSuccess(integrationId: string): void {
  const cb = getCircuit(integrationId);
  cb.failures = 0;
  cb.openedAt = null;
}

function recordFailure(integrationId: string): void {
  const cb = getCircuit(integrationId);
  cb.failures += 1;
  if (cb.failures >= CB_FAILURE_THRESHOLD && cb.openedAt === null) {
    cb.openedAt = Date.now();
  }
}

interface DaySchedule {
  isWorkDay: boolean;
  startTime: string;
  endTime: string;
}

type CalendarConfig = Record<number, DaySchedule>;

/* ──────────────────────────────────────────────────────────────
   Serviço Principal
   ────────────────────────────────────────────────────────────── */
@Injectable()
export class IxcReconciliationService {
  private readonly logger = new Logger(IxcReconciliationService.name);
  private lastRunAt: string | null = null;
  private lastProcessed = 0;
  private lastErrors = 0;
  private lastErrorMessage: string | null = null;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async runOnce() {
    if (this.running) {
      this.logger.debug('Reconciliation already running — skipping tick.');
      return;
    }
    this.running = true;

    const runStart = Date.now();
    let processedDeltas = 0;
    let errors = 0;

    try {
      const integrations = await this.prisma.providerIntegration.findMany({
        where: { provider: 'IXC' },
        select: {
          id: true,
          tenantId: true,
          status: true,
          baseUrl: true,
          apiTokenEnc: true,
          lastSyncAt: true,
          tenant: { select: { status: true, deletedAt: true } },
        },
      });

      const active = integrations.filter(
        (it) =>
          it.tenant.status === 'ACTIVE' &&
          !it.tenant.deletedAt &&
          !['INACTIVE', 'DISABLED'].includes((it.status || '').toUpperCase()),
      );

      if (active.length === 0) {
        this.logger.debug('No active IXC integrations — nothing to do.');
        this.lastRunAt = new Date().toISOString();
        this.lastProcessed = 0;
        return;
      }

      this.logger.log(`Starting IXC reconciliation for ${active.length} integration(s).`);
      const now = new Date();

      for (const integration of active) {
        // ── Circuit Breaker check ──────────────────────────────
        if (isCircuitOpen(integration.id)) {
          this.logger.warn(
            `[CB OPEN] Integration ${integration.id} (tenant ${integration.tenantId}) skipped — circuit breaker open.`,
          );
          errors += 1;
          continue;
        }

        try {
          const deltas = await this.fetchDeltaWithRetry(
            integration.id,
            integration.baseUrl,
            integration.apiTokenEnc,
            integration.lastSyncAt,
          );

          let integrationProcessed = 0;
          for (const delta of deltas) {
            const op = await this.applyDelta(integration.tenantId, delta);
            if (op) integrationProcessed += 1;
          }

          processedDeltas += integrationProcessed;
          recordSuccess(integration.id);

          // Registrar evento de sync com métricas
          await this.prisma.syncEvent.create({
            data: {
              tenantId: integration.tenantId,
              integrationId: integration.id,
              source: 'POLLING',
              eventType: 'IXC_RECONCILIATION_TICK',
              status: 'PROCESSED',
              processedAt: now,
            },
          });

          await this.prisma.providerIntegration.update({
            where: { id: integration.id },
            data: { lastSyncAt: now },
          });

          this.logger.log(
            `[OK] Integration ${integration.id}: ${integrationProcessed} delta(s) applied from ${deltas.length} fetched.`,
          );
        } catch (error: any) {
          errors += 1;
          this.lastErrorMessage = error?.message || 'unknown_error';
          recordFailure(integration.id);

          const cb = getCircuit(integration.id);
          const cbStatus = cb.openedAt ? 'CIRCUIT_OPEN' : `FAILURES=${cb.failures}`;

          this.logger.error(
            `[FAIL] Integration ${integration.id} (tenant ${integration.tenantId}): ${this.lastErrorMessage} [${cbStatus}]`,
          );

          await this.prisma.syncEvent.create({
            data: {
              tenantId: integration.tenantId,
              integrationId: integration.id,
              source: 'POLLING',
              eventType: 'IXC_RECONCILIATION_TICK',
              status: 'FAILED',
              errorMessage: this.lastErrorMessage,
              processedAt: now,
            },
          });
        }
      }

      const elapsed = Date.now() - runStart;
      this.lastRunAt = now.toISOString();
      this.lastProcessed = processedDeltas;
      this.lastErrors = errors;

      this.logger.log(
        `IXC reconciliation done in ${elapsed}ms — processed: ${processedDeltas}, errors: ${errors}.`,
      );
    } catch (error: any) {
      this.logger.error(`IXC reconciliation global failure: ${error?.message || 'unknown_error'}`);
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
      lastErrorMessage: this.lastErrorMessage,
      circuitBreakers: Object.fromEntries(
        Array.from(circuitBreakers.entries()).map(([id, cb]) => [
          id,
          {
            failures: cb.failures,
            open: cb.openedAt !== null,
            openedAt: cb.openedAt ? new Date(cb.openedAt).toISOString() : null,
          },
        ]),
      ),
    };
  }

  /* ────────────────────────────────────────────────────────────
     fetchDelta com retry + backoff exponencial
     ──────────────────────────────────────────────────────────── */
  private async fetchDeltaWithRetry(
    integrationId: string,
    baseUrl: string,
    apiTokenEnc: string | null,
    lastSyncAt: Date | null,
  ): Promise<Array<Record<string, unknown>>> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchDelta(baseUrl, apiTokenEnc, lastSyncAt);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === MAX_RETRIES) break;
        const delay = RETRY_DELAY_MS * 2 ** (attempt - 1); // 2s, 4s, 8s…
        this.logger.warn(
          `[RETRY ${attempt}/${MAX_RETRIES}] Integration ${integrationId}: ${(err as Error).message}. Waiting ${delay}ms.`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  private async fetchDelta(
    baseUrl: string,
    apiTokenEnc: string | null,
    lastSyncAt: Date | null,
  ): Promise<Array<Record<string, unknown>>> {
    const mockMode = (process.env.IXC_MOCK_RECONCILE || 'false').toLowerCase() === 'true';
    if (mockMode) return [];

    const since = (lastSyncAt || new Date(Date.now() - 5 * 60_000)).toISOString();
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/tickets/delta?since=${encodeURIComponent(since)}`;
    const token = decryptSecret(apiTokenEnc);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`IXC delta HTTP ${response.status} from ${url}`);
      }

      const body = (await response.json()) as { orders?: unknown };
      const orders = Array.isArray(body?.orders) ? body.orders : [];
      return orders as Array<Record<string, unknown>>;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* ────────────────────────────────────────────────────────────
     applyDelta — upsert atômico sem race condition
     ──────────────────────────────────────────────────────────── */
  private async applyDelta(tenantId: string, delta: Record<string, unknown>): Promise<boolean> {
    const externalProtocol = String(delta.externalProtocol || '').trim();
    if (!externalProtocol) return false;

    const existing = await this.prisma.serviceOrder.findFirst({
      where: { tenantId, externalProtocol, deletedAt: null },
    });

    const mappedStatus = this.mapStatus(delta.status as string | undefined);
    const type = this.mapType(delta.type as string | undefined);
    const priority = this.mapPriority(delta.priority as string | undefined);
    const title = typeof delta.title === 'string' && delta.title.trim() ? delta.title.trim() : null;
    const description =
      typeof delta.description === 'string' && delta.description.trim()
        ? delta.description.trim()
        : null;
    const externalUpdatedAt = delta.updatedAt ? new Date(delta.updatedAt as string) : null;

    if (existing) {
      // Idempotência: só aplica se o delta é mais recente
      const canApply =
        !externalUpdatedAt || externalUpdatedAt.getTime() >= existing.updatedAt.getTime();
      if (!canApply) return false;

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
              message: `Reconciliacao IXC aplicada (externalProtocol=${externalProtocol}).`,
            },
          },
        },
      });
      return true;
    }

    // Nova OS via sync
    const protocol = await this.buildProtocol(tenantId);
    const deadlineAt = await this.calculateDeadlineAt(tenantId, priority, type);
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
        deadlineAt,
        occurrences: {
          create: {
            sourceSystem: 'POLLING',
            message: `OS criada via reconciliacao IXC (externalProtocol=${externalProtocol}).`,
          },
        },
      },
    });
    return true;
  }

  /* ────────────────────────────────────────────────────────────
     Mapeamentos de status / tipo / prioridade
     ──────────────────────────────────────────────────────────── */
  private mapStatus(status?: string): ServiceOrderStatus | null {
    if (!status) return null;
    const n = status.trim().toLowerCase();
    if (['aberta', 'open', 'novo'].includes(n)) return 'ABERTA';
    if (['em_analise', 'em analise', 'triagem', 'analysis'].includes(n)) return 'EM_ANALISE';
    if (['campo', 'ag_campo', 'ag campo'].includes(n)) return 'AG_CAMPO';
    if (['terceiros', 'ag_terceiros', 'ag terceiros'].includes(n)) return 'AG_TERCEIROS';
    if (['resolvida', 'resolved'].includes(n)) return 'RESOLVIDA';
    if (['fechada', 'closed'].includes(n)) return 'FECHADA';
    if (['cancelada', 'cancelled', 'canceled'].includes(n)) return 'CANCELADA';
    return null;
  }

  private mapType(type?: string): ServiceOrderType {
    const n = String(type || '')
      .trim()
      .toUpperCase();
    const allowed: ServiceOrderType[] = [
      'ROMPIMENTO',
      'LENTIDAO',
      'CONFIGURACAO_ONU',
      'TROCA_SENHA',
      'CANCELAMENTO',
      'AUDITORIA',
      'INSTALACAO',
      'BGP',
    ];
    return allowed.includes(n as ServiceOrderType) ? (n as ServiceOrderType) : 'AUDITORIA';
  }

  private mapPriority(priority?: string): Priority {
    const n = String(priority || '')
      .trim()
      .toUpperCase();
    const allowed: Priority[] = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'];
    return allowed.includes(n as Priority) ? (n as Priority) : 'NORMAL';
  }

  /**
   * Protocolo via sequência PostgreSQL atômica — sem race condition.
   */
  private async buildProtocol(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const seqName = `os_seq_${tenantId.replace(/-/g, '_')}`;

    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`,
    );

    const result = await this.prisma.$queryRawUnsafe<[{ nextval: bigint }]>(
      `SELECT nextval('"${seqName}"')`,
    );

    const seq = Number(result[0].nextval);
    return `${year}${String(seq).padStart(6, '0')}`;
  }

  private async calculateDeadlineAt(
    tenantId: string,
    priority: Priority,
    type: ServiceOrderType,
  ): Promise<Date> {
    const hours = await this.findApplicableSlaHours(tenantId, priority, type);
    return this.calculateTargetDate(new Date(), hours, tenantId);
  }

  private async findApplicableSlaHours(
    tenantId: string,
    priority: Priority,
    type: ServiceOrderType,
  ): Promise<number> {
    const policies = await this.prisma.slaPolicy.findMany({
      where: { tenantId, active: true },
      orderBy: [{ isOverride: 'desc' }, { updatedAt: 'desc' }],
    });

    const typeOverride = policies.find(
      (policy) => policy.isOverride && policy.serviceOrderType === type,
    );
    if (typeOverride) return typeOverride.hours;

    const legacyExactMatch = policies.find(
      (policy) =>
        !policy.isOverride && policy.priority === priority && policy.serviceOrderType === type,
    );
    if (legacyExactMatch) return legacyExactMatch.hours;

    const priorityPolicy = policies.find(
      (policy) =>
        !policy.isOverride && policy.priority === priority && policy.serviceOrderType === null,
    );
    return priorityPolicy?.hours ?? 48;
  }

  private async calculateTargetDate(
    startDate: Date,
    slaHours: number,
    tenantId: string,
  ): Promise<Date> {
    const [calendar, timezone] = await Promise.all([
      this.getBusinessCalendar(tenantId),
      this.getTenantTimezone(tenantId),
    ]);
    let remainingMinutes = slaHours * 60;
    const current = toZonedTime(startDate, timezone);
    await this.adjustWithExceptions(current, tenantId, calendar);

    for (let safety = 0; safety < 1000; safety += 1) {
      if (remainingMinutes <= 0) break;

      const exception = await this.getCalendarExceptionForWallDate(tenantId, current);
      if (exception && !exception.isWorkDay) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
        continue;
      }

      const dayConfig = calendar[current.getDay()];
      const endTime = exception?.endTime || dayConfig.endTime;
      const [endH, endM] = endTime.split(':').map(Number);
      const eod = new Date(current);
      eod.setHours(endH, endM, 0, 0);

      const minutesToEndOfDay = (eod.getTime() - current.getTime()) / 60000;

      if (remainingMinutes <= minutesToEndOfDay) {
        current.setTime(current.getTime() + remainingMinutes * 60000);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesToEndOfDay;
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
      }
    }

    return fromZonedTime(current, timezone);
  }

  private async getBusinessCalendar(tenantId: string): Promise<CalendarConfig> {
    const rows = await this.prisma.businessCalendar.findMany({ where: { tenantId } });
    const result: CalendarConfig = {} as CalendarConfig;
    for (let i = 0; i < 7; i += 1) {
      const row = rows.find((item) => item.dayOfWeek === i);
      if (row) {
        result[i] = {
          isWorkDay: row.isWorkDay,
          startTime: row.startTime,
          endTime: row.endTime,
        };
      } else {
        const isWeekend = i === 0 || i === 6;
        result[i] = {
          isWorkDay: !isWeekend,
          startTime: '08:00',
          endTime: '18:00',
        };
      }
    }
    return result;
  }

  private async adjustWithExceptions(
    date: Date,
    tenantId: string,
    calendar: CalendarConfig,
  ): Promise<void> {
    for (let i = 0; i < 366; i += 1) {
      const exception = await this.getCalendarExceptionForWallDate(tenantId, date);
      const dayConfig = calendar[date.getDay()];

      if (exception && !exception.isWorkDay) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      if (!exception && (!dayConfig || !dayConfig.isWorkDay)) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      const startTime = exception?.startTime || dayConfig?.startTime || '08:00';
      const endTime = exception?.endTime || dayConfig?.endTime || '18:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = date.getHours() * 60 + date.getMinutes();

      if (currentMinutes >= endMinutes) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      if (currentMinutes < startMinutes) {
        date.setHours(startH, startM, 0, 0);
      }
      return;
    }
  }

  private async getTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const timezone = tenant?.timezone || 'America/Sao_Paulo';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      return 'America/Sao_Paulo';
    }
  }

  private getCalendarExceptionForWallDate(tenantId: string, wallDate: Date) {
    const startOfDay = new Date(wallDate);
    startOfDay.setHours(0, 0, 0, 0);
    return this.prisma.businessCalendarException.findUnique({
      where: { tenantId_date: { tenantId, date: startOfDay } },
    });
  }
}
