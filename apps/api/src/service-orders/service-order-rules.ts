import { BadRequestException } from '@nestjs/common';
import type { Priority, Prisma, ServiceOrderStatus } from '@prisma/client';

/**
 * Regras únicas do ciclo de vida da O.S. (auditoria C-013/C-035). Funções puras, usadas
 * pela transição manual, pelas operações do analista e pelo motor de processos.
 */

export const ACTIVE_ORDER_STATUSES: ServiceOrderStatus[] = [
  'ABERTA',
  'EM_ANALISE',
  'AG_CAMPO',
  'AG_TERCEIROS',
];

/** Transições manuais permitidas (tela "Alterar etapa" / PATCH :id/transition). */
export const ORDER_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA', 'CANCELADA'],
  AG_CAMPO: ['EM_ANALISE', 'RESOLVIDA'],
  AG_TERCEIROS: ['RESOLVIDA', 'EM_ANALISE'],
  RESOLVIDA: ['FECHADA', 'EM_ANALISE'],
  FECHADA: ['EM_ANALISE'],
  CANCELADA: [],
};

export const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  AG_CAMPO: 'Aguardando campo',
  AG_TERCEIROS: 'Aguardando terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

export const isActiveStatus = (status: ServiceOrderStatus) =>
  ACTIVE_ORDER_STATUSES.includes(status);

export function assertTransition(from: ServiceOrderStatus, to: ServiceOrderStatus) {
  if (from === to) throw new BadRequestException('A O.S. já está nesta etapa.');
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    const allowed = ORDER_TRANSITIONS[from].map((s) => STATUS_LABEL[s]).join(', ');
    throw new BadRequestException(
      `Não é possível passar de ${STATUS_LABEL[from]} para ${STATUS_LABEL[to]}.` +
        (allowed ? ` A partir de ${STATUS_LABEL[from]}: ${allowed}.` : ''),
    );
  }
}

type DatedOrder = {
  status: ServiceOrderStatus;
  resolvedAt: Date | null;
  closedAt: Date | null;
  canceledAt: Date | null;
};

/**
 * Datas e contador coerentes com o status de destino (C-014): sair de RESOLVIDA ou FECHADA
 * para uma etapa ativa é reabertura e limpa as datas de conclusão.
 */
export function statusDates(
  order: DatedOrder,
  to: ServiceOrderStatus,
  now = new Date(),
): Prisma.ServiceOrderUncheckedUpdateManyInput {
  if (to === 'RESOLVIDA') return { resolvedAt: now, closedAt: null };
  if (to === 'FECHADA') return { resolvedAt: order.resolvedAt ?? now, closedAt: now };
  if (to === 'CANCELADA') return { canceledAt: now };
  if (order.status === 'RESOLVIDA' || order.status === 'FECHADA')
    return { resolvedAt: null, closedAt: null, reopenedCount: { increment: 1 } };
  return {};
}

export const isReopen = (from: ServiceOrderStatus, to: ServiceOrderStatus) =>
  (from === 'RESOLVIDA' || from === 'FECHADA') && isActiveStatus(to);

/** Fechamento de O.S. ALTA/CRÍTICA atrasada que exige decisão gerencial. */
export function needsClosingApproval(
  order: { requiresApproval: boolean; priority: Priority; deadlineAt: Date },
  now = new Date(),
) {
  return (
    order.requiresApproval &&
    (order.priority === 'ALTA' || order.priority === 'CRITICA') &&
    order.deadlineAt.getTime() < now.getTime()
  );
}

type ApprovalReader = {
  serviceOrderApproval: {
    findFirst(args: Prisma.ServiceOrderApprovalFindFirstArgs): Promise<{ status: string } | null>;
  };
};

/** Vale só a decisão mais recente desta resolução (C-003). */
export async function hasCurrentApproval(
  db: ApprovalReader,
  order: { id: string; resolvedAt: Date | null },
) {
  const decision = await db.serviceOrderApproval.findFirst({
    where: {
      serviceOrderId: order.id,
      status: { in: ['APPROVED', 'REJECTED'] },
      ...(order.resolvedAt ? { createdAt: { gte: order.resolvedAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return decision?.status === 'APPROVED';
}

export const AWAITING_APPROVAL_MESSAGE =
  'Resolvida e aguardando aprovação gerencial para fechar (O.S. de prioridade alta/crítica atrasada).';
