require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
/** Corrects the one-time timestamp-unit error in provider-volume-120d-v1. */
import { PrismaClient, Priority } from '@prisma/client';

const prisma = new PrismaClient();
const tenantSlug = 'ajust-demo';
const orderPrefix = 'DEMO-120D-';
const occurrencePrefix = 'DEMO-INC-120D-';
const backupProof = process.env.AJUST_PROVIDER_VOLUME_BACKUP_VERIFIED;
const execute = process.argv.includes('--execute');
const groupSizes = [3, 4, 4, 4, 3, 4, 4, 4, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
const priorityHours: Record<Priority, number> = {
  BAIXA: 48,
  NORMAL: 24,
  ALTA: 8,
  CRITICA: 4,
};

function daysBefore(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function hoursAfter(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function ageDays(groupIndex: number) {
  if (groupIndex < 4) return [0.3, 1.1, 2.4, 5.2][groupIndex];
  if (groupIndex < 8) return [0.6, 2.2, 5.8, 10.5][groupIndex - 4];
  return [118, 106, 94, 82, 70, 58, 48, 38, 28, 18, 7, 3][groupIndex - 8];
}

function splits(groupIndex: number, size: number) {
  return size === 2 && groupIndex >= 8 && groupIndex < 12 ? [1, 1] : [size];
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error('Workspace Ajust não encontrado.');
  const orders = await prisma.serviceOrder.findMany({
    where: { tenantId: tenant.id, protocol: { startsWith: orderPrefix } },
    select: {
      id: true,
      protocol: true,
      status: true,
      priority: true,
      occurrenceId: true,
    },
    orderBy: { protocol: 'asc' },
  });
  const occurrences = await prisma.occurrence.findMany({
    where: { tenantId: tenant.id, number: { startsWith: occurrencePrefix } },
    select: { id: true, number: true },
    orderBy: { number: 'asc' },
  });
  if (orders.length !== 60 || occurrences.length !== 24)
    throw new Error(
      `Esperava 60 O.S. e 24 ocorrências; encontrei ${orders.length} e ${occurrences.length}.`,
    );

  const now = new Date();
  const corrected = orders.map((order, index) => {
    let groupIndex = 0;
    let orderStart = 0;
    for (; groupIndex < groupSizes.length; groupIndex++) {
      if (index < orderStart + groupSizes[groupIndex]) break;
      orderStart += groupSizes[groupIndex];
    }
    const localIndex = index - orderStart;
    const createdAt = hoursAfter(daysBefore(now, ageDays(groupIndex)), 0.5 + localIndex * 2.5);
    const deadlineAt = hoursAfter(createdAt, priorityHours[order.priority]);
    const isClosed = order.status === 'FECHADA';
    const durationHours = isClosed
      ? (index + 1) % 4 === 0
        ? priorityHours[order.priority] + 2.5
        : Math.max(0.75, Math.min(12, priorityHours[order.priority] * 0.55))
      : 0;
    const resolvedAt = isClosed ? hoursAfter(createdAt, Math.max(0.5, durationHours - 0.25)) : null;
    const closedAt = isClosed ? hoursAfter(createdAt, durationHours) : null;
    return {
      ...order,
      index,
      groupIndex,
      localIndex,
      createdAt,
      deadlineAt,
      durationHours,
      resolvedAt,
      closedAt,
    };
  });
  const byId = new Map(corrected.map((order) => [order.id, order]));

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          status: 'DRY_RUN',
          orders: corrected.length,
          occurrences: occurrences.length,
          correctedDateRange: {
            oldest: corrected
              .reduce(
                (oldest, order) => (order.createdAt < oldest ? order.createdAt : oldest),
                corrected[0].createdAt,
              )
              .toISOString(),
            newest: corrected
              .reduce(
                (latest, order) => (order.createdAt > latest ? order.createdAt : latest),
                corrected[0].createdAt,
              )
              .toISOString(),
          },
          futureCreatedOrdersAfterCorrection: corrected.filter((order) => order.createdAt > now)
            .length,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!backupProof?.startsWith('pg_dump+uploads:'))
    throw new Error('Execução exige backup validado de banco e uploads no ambiente.');

  const result = await prisma.$transaction(
    async (tx) => {
      for (const order of corrected) {
        const nextUpdatedAt =
          order.closedAt ||
          new Date(
            Math.min(
              now.getTime(),
              order.status === 'ABERTA'
                ? order.createdAt.getTime()
                : hoursAfter(
                    order.createdAt,
                    Math.min(24, Math.max(1, ageDays(order.groupIndex))),
                  ).getTime(),
            ),
          );
        await tx.serviceOrder.update({
          where: { id: order.id },
          data: {
            createdAt: order.createdAt,
            deadlineAt: order.deadlineAt,
            resolvedAt: order.resolvedAt,
            closedAt: order.closedAt,
            updatedAt: nextUpdatedAt,
          },
        });

        const events = await tx.serviceOrderStatusEvent.findMany({
          where: { serviceOrderId: order.id },
          select: { id: true, fromStatus: true, toStatus: true },
        });
        for (const event of events) {
          const createdAt =
            event.fromStatus === 'ABERTA' && event.toStatus === 'EM_ANALISE'
              ? hoursAfter(order.createdAt, 0.5)
              : event.toStatus === 'AG_CAMPO' || event.toStatus === 'AG_TERCEIROS'
                ? hoursAfter(order.createdAt, 1.25)
                : event.toStatus === 'RESOLVIDA'
                  ? order.resolvedAt!
                  : event.toStatus === 'FECHADA'
                    ? order.closedAt!
                    : order.createdAt;
          await tx.serviceOrderStatusEvent.update({ where: { id: event.id }, data: { createdAt } });
        }

        const notes = await tx.serviceOrderOccurrence.findMany({
          where: { serviceOrderId: order.id },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
          const createdAt =
            order.status === 'FECHADA' && noteIndex === 1
              ? order.closedAt!
              : hoursAfter(order.createdAt, noteIndex === 0 ? 0.2 : 1.5);
          await tx.serviceOrderOccurrence.update({
            where: { id: notes[noteIndex].id },
            data: { createdAt },
          });
        }

        const entries = await tx.timeEntry.findMany({
          where: { orderId: order.id },
          select: { id: true },
          orderBy: { loggedAt: 'asc' },
        });
        for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
          const loggedAt =
            order.status === 'FECHADA'
              ? hoursAfter(
                  order.createdAt,
                  Math.min(
                    (order.durationHours * (entryIndex + 1)) / (entries.length + 1),
                    Math.max(0.2, order.durationHours - 0.1),
                  ),
                )
              : hoursAfter(
                  order.createdAt,
                  Math.min(entryIndex + 1, order.status === 'ABERTA' ? 0.75 : 2),
                );
          await tx.timeEntry.update({
            where: { id: entries[entryIndex].id },
            data: { loggedAt, createdAt: loggedAt },
          });
        }

        const referenceEnd = order.closedAt || now;
        const breached = order.deadlineAt < referenceEnd;
        await tx.slaEvent.updateMany({
          where: { serviceOrderId: order.id },
          data: {
            deadlineAt: order.deadlineAt,
            breachedAt: breached ? referenceEnd : null,
            delayMinutes: breached
              ? Math.max(
                  1,
                  Math.floor((referenceEnd.getTime() - order.deadlineAt.getTime()) / 60000),
                )
              : 0,
            createdAt: order.createdAt,
          },
        });
      }

      let occurrenceNumber = 1;
      let orderIndex = 0;
      for (let groupIndex = 0; groupIndex < groupSizes.length; groupIndex++) {
        const size = groupSizes[groupIndex];
        const splitSizes = splits(groupIndex, size);
        let localStart = 0;
        for (const splitSize of splitSizes) {
          const occurrence = occurrences.find(
            (row) =>
              row.number === `${occurrencePrefix}${String(occurrenceNumber).padStart(3, '0')}`,
          );
          if (!occurrence) throw new Error(`Ocorrência ${occurrenceNumber} ausente.`);
          const subset = corrected.slice(
            orderIndex + localStart,
            orderIndex + localStart + splitSize,
          );
          const createdAt = hoursAfter(daysBefore(now, ageDays(groupIndex)), -1);
          const closedAt = subset.every((order) => order.status === 'FECHADA')
            ? subset.reduce<Date | null>(
                (latest, order) => (!latest || order.closedAt! > latest ? order.closedAt : latest),
                null,
              )
            : null;
          await tx.occurrence.update({
            where: { id: occurrence.id },
            data: {
              createdAt,
              closedAt,
              updatedAt:
                closedAt ||
                new Date(
                  Math.min(
                    now.getTime(),
                    hoursAfter(createdAt, Math.min(24, Math.max(1, ageDays(groupIndex)))).getTime(),
                  ),
                ),
            },
          });
          const notes = await tx.occurrenceAnnotation.findMany({
            where: { occurrenceId: occurrence.id },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
            const noteAt =
              noteIndex === 1 && closedAt ? closedAt : hoursAfter(createdAt, noteIndex + 1);
            await tx.occurrenceAnnotation.update({
              where: { id: notes[noteIndex].id },
              data: { createdAt: noteAt },
            });
          }
          occurrenceNumber++;
          localStart += splitSize;
        }
        orderIndex += size;
      }

      const stillFuture = await tx.serviceOrder.count({
        where: {
          tenantId: tenant.id,
          protocol: { startsWith: orderPrefix },
          createdAt: { gt: now },
        },
      });
      const currentOrders = await tx.serviceOrder.count({
        where: { tenantId: tenant.id, protocol: { startsWith: orderPrefix } },
      });
      if (stillFuture || currentOrders !== 60)
        throw new Error(
          `Validação de datas falhou: ${stillFuture} O.S. futuras entre ${currentOrders}.`,
        );
      return {
        correctedOrders: currentOrders,
        correctedOccurrences: occurrences.length,
        futureCreatedOrders: stillFuture,
      };
    },
    { maxWait: 15000, timeout: 120000 },
  );

  console.log(JSON.stringify({ status: 'REPAIRED', ...result }, null, 2));
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
