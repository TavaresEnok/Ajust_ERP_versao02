import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma, ServiceOrderLifecycleEvent } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type EffectRunner = (name: string, run: () => Promise<unknown>) => Promise<void>;
type Handler = (event: ServiceOrderLifecycleEvent, effect: EffectRunner) => Promise<void>;
const LEASE_MS = 5 * 60_000;
/** Eventos entregues ficam 30 dias para diagnóstico e depois saem (a tabela só crescia). */
const RETENTION_MS = Number(process.env.LIFECYCLE_OUTBOX_RETENTION_DAYS || 30) * 86_400_000;
const PRUNE_EVERY_MS = 60 * 60_000;

/** PostgreSQL outbox: claims are shared by replicas; each successful effect is checkpointed. */
@Injectable()
export class LifecycleOutboxService implements OnModuleDestroy {
  private readonly logger = new Logger(LifecycleOutboxService.name);
  private timer?: ReturnType<typeof setInterval>;
  private handler?: Handler;
  private delivering = false;
  private lastPruneAt = 0;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  start(handler: Handler) {
    this.handler = handler;
    this.timer = setInterval(
      () =>
        void this.deliver().catch((error: Error) => {
          this.logger.error(`Lifecycle outbox unavailable: ${error.message}`);
        }),
      10_000,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async deliver(orderId?: string) {
    if (!this.handler || this.delivering) return;
    this.delivering = true;
    try {
      const now = new Date();
      const events = await this.prisma.serviceOrderLifecycleEvent.findMany({
        where: {
          ...(orderId ? { orderId } : {}),
          processedAt: null,
          availableAt: { lte: now },
          OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - LEASE_MS) } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 20,
      });
      for (const event of events) await this.deliverOne(event);
      if (!orderId && Date.now() - this.lastPruneAt > PRUNE_EVERY_MS)
        await this.prune().catch((error: Error) =>
          this.logger.warn(`Lifecycle outbox prune failed: ${error.message}`),
        );
    } finally {
      this.delivering = false;
    }
  }

  /** Remove em lotes os eventos já processados além da retenção. */
  async prune() {
    this.lastPruneAt = Date.now();
    const cutoff = new Date(Date.now() - RETENTION_MS);
    for (let round = 0; round < 50; round++) {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM "ServiceOrderLifecycleEvent" WHERE "id" IN (
          SELECT "id" FROM "ServiceOrderLifecycleEvent"
          WHERE "processedAt" IS NOT NULL AND "processedAt" < ${cutoff}
          LIMIT 5000
        )`;
      if (deleted < 5000) break;
    }
  }

  private async deliverOne(event: ServiceOrderLifecycleEvent) {
    const token = randomUUID();
    const claim = await this.prisma.serviceOrderLifecycleEvent.updateMany({
      where: {
        id: event.id,
        processedAt: null,
        claimToken: event.claimToken,
        attempts: event.attempts,
      },
      data: { claimedAt: new Date(), claimToken: token, attempts: { increment: 1 } },
    });
    if (!claim.count) return;
    const completed = new Set(
      Array.isArray(event.completedEffects) ? (event.completedEffects as string[]) : [],
    );
    const owned = { id: event.id, claimToken: token, processedAt: null };
    const effect: EffectRunner = async (name, run) => {
      if (completed.has(name)) return;
      // Refresh the lease before each external call and refuse work after losing ownership.
      const renewed = await this.prisma.serviceOrderLifecycleEvent.updateMany({
        where: owned,
        data: { claimedAt: new Date() },
      });
      if (!renewed.count) throw new Error('Lifecycle event lease lost.');
      await run();
      completed.add(name);
      const saved = await this.prisma.serviceOrderLifecycleEvent.updateMany({
        where: owned,
        data: { completedEffects: [...completed] as Prisma.InputJsonValue, claimedAt: new Date() },
      });
      if (!saved.count) throw new Error('Lifecycle event lease lost.');
    };
    try {
      await this.handler!(event, effect);
      await this.prisma.serviceOrderLifecycleEvent.updateMany({
        where: owned,
        data: { processedAt: new Date(), error: null, claimedAt: null, claimToken: null },
      });
    } catch (error) {
      // Keep retrying with a capped delay. Do not discard a business event after N failures.
      await this.prisma.serviceOrderLifecycleEvent.updateMany({
        where: owned,
        data: {
          error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
          availableAt: new Date(
            Date.now() + Math.min(3_600_000, 10_000 * 2 ** Math.min(event.attempts, 9)),
          ),
          claimedAt: null,
          claimToken: null,
        },
      });
      // Não descarta evento de negócio, mas deixa visível quando ele está preso.
      const log = event.attempts + 1 >= 10 ? this.logger.error : this.logger.warn;
      log.call(
        this.logger,
        `Lifecycle event ${event.id} failed (attempt ${event.attempts + 1}); will be retried.`,
      );
    }
  }
}
