import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Mantém o estado da ocorrência coerente com as O.S. e fluxos que ela contém:
 * enquanto houver O.S. aberta ou fluxo ativo ela fica EM_EXECUCAO; quando tudo
 * estiver fechado ou cancelado ela é ENCERRADA. Reabrir uma O.S. reabre a ocorrência.
 */
export async function syncOccurrenceStatus(
  prisma: PrismaService,
  tenantId: string,
  occurrenceId: string | null | undefined,
) {
  if (!occurrenceId) return;
  await prisma.$transaction(
    async (tx) => {
      const pending = await tx.serviceOrder.count({
        where: {
          tenantId,
          occurrenceId,
          deletedAt: null,
          status: { notIn: ['FECHADA', 'CANCELADA'] },
        },
      });
      const flows = await tx.serviceProcessInstance.count({
        where: {
          tenantId,
          occurrenceId,
          status: { in: ['ACTIVE', 'WAITING', 'PAUSED', 'FAILED'] },
        },
      });
      await tx.occurrence.updateMany({
        where: { id: occurrenceId, tenantId },
        data: {
          status: pending || flows ? 'EM_EXECUCAO' : 'ENCERRADA',
          closedAt: pending || flows ? null : new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
