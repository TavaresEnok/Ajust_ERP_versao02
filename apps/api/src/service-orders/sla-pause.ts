import type { Prisma } from '@prisma/client';

/** Pausa automática ao entrar em "Aguardando terceiros" (C-030). */
export const AUTO_PAUSE_PREFIX = 'Aguardando terceiros: ';
/** Pausa aplicada a todas as O.S. abertas quando o fluxo de atendimento é pausado. */
export const PROCESS_PAUSE_PREFIX = 'Fluxo pausado: ';

type Clock = {
  calculateBusinessPauseDuration(start: Date, end: Date, tenantId: string): Promise<number>;
  calculateTargetDate(start: Date, hours: number, tenantId: string): Promise<Date>;
};

/**
 * Prazo depois de um intervalo em que o relógio do SLA ficou parado (pausa, ou período em que
 * a O.S. ficou encerrada antes de uma reabertura): o prazo avança o mesmo tempo útil parado,
 * preservando o tempo útil que restava.
 */
export async function deadlineAfterStop(
  sla: Clock,
  tenantId: string,
  stoppedAt: Date,
  deadlineAt: Date,
  now = new Date(),
) {
  const minutes = await sla.calculateBusinessPauseDuration(stoppedAt, now, tenantId);
  return {
    minutes,
    deadlineAt:
      minutes > 0 ? await sla.calculateTargetDate(deadlineAt, minutes / 60, tenantId) : deadlineAt,
  };
}

type AuditReader = {
  slaAuditEvent: {
    findMany(
      args: Prisma.SlaAuditEventFindManyArgs,
    ): Promise<{ metadata: Prisma.JsonValue; createdAt: Date }[]>;
  };
};

/**
 * Minutos úteis já devolvidos ao prazo por retomadas e reaberturas. Um recálculo a partir da
 * abertura precisa somá-los de volta, senão o tempo parado some do prazo.
 */
export async function creditedStopMinutes(
  db: AuditReader,
  sla: Clock,
  tenantId: string,
  orderId: string,
) {
  const events = await db.slaAuditEvent.findMany({
    where: { tenantId, orderId, eventType: { in: ['RESUMED', 'REOPENED'] } },
    select: { metadata: true, createdAt: true },
  });
  let total = 0;
  for (const event of events) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.pausedBusinessMinutes === 'number') total += meta.pausedBusinessMinutes;
    else if (typeof meta.pausedAt === 'string')
      // Retomadas antigas só guardam o início da pausa; o fim é o instante do evento.
      total += await sla.calculateBusinessPauseDuration(
        new Date(meta.pausedAt),
        event.createdAt,
        tenantId,
      );
  }
  return total;
}
