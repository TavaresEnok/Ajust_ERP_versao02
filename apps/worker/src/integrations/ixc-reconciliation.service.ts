import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common.secrets';
import { assertSafeUrl, safeFetch } from '../common/ssrf-guard';

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
    // O token do IXC só vai para endereço público, sem seguir redirecionamento (C-066/C-055).
    await assertSafeUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const response = await safeFetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual',
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
    if (!String(delta.externalProtocol || '').trim()) return false;
    const token = process.env.WORKER_API_TOKEN;
    if (!token) throw new Error('WORKER_API_TOKEN não configurado.');
    const base = (process.env.API_INTERNAL_URL || 'http://api:3001').replace(/\/+$/, '');
    const response = await fetch(`${base}/integrations/ixc/internal/delta`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, delta }),
    });
    if (!response.ok) throw new Error(`Reconciliação recusada pela API: HTTP ${response.status}`);
    const result = (await response.json()) as { applied: boolean };
    return result.applied;
  }
}
