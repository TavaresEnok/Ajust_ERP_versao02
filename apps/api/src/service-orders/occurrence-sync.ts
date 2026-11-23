import { Prisma, type OccurrenceStatus, type ServiceOrderStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Reader = Pick<Prisma.TransactionClient, 'serviceOrder' | 'serviceProcessInstance'>;
type Writer = Reader & Pick<Prisma.TransactionClient, 'occurrence'>;

/**
 * Estado da ocorrência a partir das O.S. ainda não encerradas:
 * - ENCERRADA: nada aberto (todas fechadas ou canceladas) e nenhum fluxo em andamento;
 * - ABERTA: ninguém começou (todas as O.S. abertas, sem pausa);
 * - PENDENTE: tudo o que falta depende de outro (resolvida aguardando fechamento, SLA
 *   pausado ou aguardando terceiros);
 * - EM_EXECUCAO: há trabalho em andamento.
 */
export function occurrenceStatusFor(
  orders: { status: ServiceOrderStatus; pausedAt: Date | null }[],
  activeFlows: number,
): OccurrenceStatus {
  if (!orders.length) return activeFlows ? 'EM_EXECUCAO' : 'ENCERRADA';
  if (orders.every((o) => o.status === 'ABERTA' && !o.pausedAt)) return 'ABERTA';
  if (orders.every((o) => o.status === 'RESOLVIDA' || o.status === 'AG_TERCEIROS' || o.pausedAt))
    return 'PENDENTE';
  return 'EM_EXECUCAO';
}

/** Recalcula e grava o estado da ocorrência na transação recebida. */
export async function writeOccurrenceStatus(tx: Writer, tenantId: string, occurrenceId: string) {
  const orders = await tx.serviceOrder.findMany({
    where: { tenantId, occurrenceId, deletedAt: null, status: { notIn: ['FECHADA', 'CANCELADA'] } },
    select: { status: true, pausedAt: true },
  });
  const flows = await tx.serviceProcessInstance.count({
    where: { tenantId, occurrenceId, status: { in: ['ACTIVE', 'WAITING', 'PAUSED', 'FAILED'] } },
  });
  const status = occurrenceStatusFor(orders, flows);
  await tx.occurrence.updateMany({
    where: { id: occurrenceId, tenantId },
    data: { status, closedAt: status === 'ENCERRADA' ? new Date() : null },
  });
  return status;
}

/**
 * Mantém o estado da ocorrência coerente com as O.S. e fluxos que ela contém. Roda em
 * transação serializável; conflito com outra conclusão simultânea é tentado de novo.
 */
export async function syncOccurrenceStatus(
  prisma: PrismaService,
  tenantId: string,
  occurrenceId: string | null | undefined,
) {
  if (!occurrenceId) return;
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction((tx) => writeOccurrenceStatus(tx, tenantId, occurrenceId), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return;
    } catch (error) {
      if (
        attempt < 4 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        continue;
      throw error;
    }
  }
}
