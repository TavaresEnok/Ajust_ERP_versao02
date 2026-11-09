/**
 * Filtros, ordenação e visibilidade das listagens de O.S. (extraído de service-orders.service.ts, C-084).
 * Funções puras: não acessam o banco.
 */
import type { Prisma } from '@prisma/client';
import type { ListInput } from './service-orders.types';

export function isCustomerRole(role?: string | null): boolean {
  return role === 'cliente';
}

export function buildOrderWhere(
  tenantId: string,
  input: ListInput,
  role?: string | null,
): Prisma.ServiceOrderWhereInput {
  const where: Prisma.ServiceOrderWhereInput = {
    tenantId,
    deletedAt: null,
  };

  if (isCustomerRole(role)) {
    where.isCustomerVisible = true;
  }

  if (input.status) where.status = input.status;
  if (input.situation && input.situation !== 'all') {
    where.AND = [
      {
        status:
          input.situation === 'active'
            ? { notIn: ['RESOLVIDA', 'FECHADA', 'CANCELADA'] }
            : { in: ['RESOLVIDA', 'FECHADA'] },
      },
    ];
  }
  if (input.priority) where.priority = input.priority;
  if (input.type) where.type = input.type;

  if (input.responsibleUserId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ ownerUserId: input.responsibleUserId }, { assigneeUserId: input.responsibleUserId }],
      },
    ];
  }

  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
  }

  if (input.customerId) where.occurrence = { customerId: input.customerId, tenantId };
  if (input.provider && !input.customerId) {
    const restrictions = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...restrictions,
      {
        OR: [
          { requester: { equals: input.provider, mode: 'insensitive' } },
          { occurrence: { provider: { equals: input.provider, mode: 'insensitive' } } },
        ],
      },
    ];
  }
  if (input.search) {
    where.OR = [
      { protocol: { contains: input.search, mode: 'insensitive' } },
      { title: { contains: input.search, mode: 'insensitive' } },
      { description: { contains: input.search, mode: 'insensitive' } },
      { externalProtocol: { contains: input.search, mode: 'insensitive' } },
      { requester: { contains: input.search, mode: 'insensitive' } },
      { occurrence: { provider: { contains: input.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export function andOrderWhere(
  base: Prisma.ServiceOrderWhereInput,
  extra: Prisma.ServiceOrderWhereInput,
): Prisma.ServiceOrderWhereInput {
  return { AND: [base, extra] };
}

export function sanitizeOrderForRole<T>(order: T, role?: string | null): T {
  if (!isCustomerRole(role) || !order || typeof order !== 'object') {
    return order;
  }

  const record = order as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {
    ...record,
    internalNotes: null,
  };

  if ('approvals' in sanitized) {
    sanitized.approvals = [];
  }

  return sanitized as T;
}

export function buildOrderOrderBy(input: ListInput): Prisma.ServiceOrderOrderByWithRelationInput[] {
  const orderBy = input.orderBy || 'createdAt';
  const orderDir: Prisma.SortOrder = input.orderDir || 'desc';
  return [{ [orderBy]: orderDir }, { id: 'asc' }];
}
