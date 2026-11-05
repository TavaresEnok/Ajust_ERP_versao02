import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateTimeEntryInput = {
  orderId: string;
  minutes: number;
  description?: string;
  billable?: boolean;
  loggedAt?: string;
};

@Injectable()
export class TimeTrackingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listByOrder(tenantId: string, orderId: string, userId?: string, limit = 50, offset = 0) {
    return this.prisma.timeEntry.findMany({
      where: { tenantId, orderId, ...(userId ? { userId } : {}) },
      take: Math.min(200, Math.max(1, limit)),
      skip: Math.max(0, offset),
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listByTenant(
    tenantId: string,
    from?: string,
    to?: string,
    userId?: string,
    limit = 50,
    offset = 0,
  ) {
    const where: Prisma.TimeEntryWhereInput = { tenantId, ...(userId ? { userId } : {}) };
    if (from || to) {
      where.loggedAt = {};
      if (from) where.loggedAt.gte = new Date(from);
      if (to) where.loggedAt.lte = new Date(to);
    }
    return this.prisma.timeEntry.findMany({
      where,
      take: Math.min(200, Math.max(1, limit)),
      skip: Math.max(0, offset),
      include: {
        user: { select: { id: true, name: true } },
        order: { select: { id: true, protocol: true, type: true } },
      },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create(tenantId: string, userId: string, input: CreateTimeEntryInput, role = 'analista') {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.orderId, tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found.');
    const loggedAt = input.loggedAt ? new Date(input.loggedAt) : new Date();
    const now = Date.now();
    if (!Number.isFinite(loggedAt.getTime()) || loggedAt.getTime() > now)
      throw new BadRequestException('A data do apontamento não pode estar no futuro.');
    if (!['super_admin', 'gerente'].includes(role)) {
      if (['FECHADA', 'CANCELADA'].includes(order.status))
        throw new ForbiddenException('Apenas gerentes podem apontar horas em O.S. encerrada.');
      if (loggedAt.getTime() < now - 30 * 86400000)
        throw new ForbiddenException('Apontamentos com mais de 30 dias exigem um gerente.');
    }
    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId,
        orderId: input.orderId,
        minutes: Math.max(1, Math.round(input.minutes)),
        description: input.description,
        billable: input.billable ?? true,
        loggedAt,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string, actorUserId: string, role: string) {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Time entry not found.');
    if (!['super_admin', 'gerente'].includes(role) && entry.userId !== actorUserId) {
      throw new ForbiddenException('You can only remove your own time entries.');
    }
    await this.prisma.timeEntry.delete({ where: { id } });
    return { success: true };
  }

  async orderTotal(tenantId: string, orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('O.S. não encontrada.');
    const aggregate = await this.prisma.timeEntry.aggregate({
      where: { tenantId, orderId },
      _sum: { minutes: true },
    });
    return { orderId, totalMinutes: aggregate._sum.minutes ?? 0 };
  }

  async summary(tenantId: string, userId?: string) {
    const groups = await this.prisma.timeEntry.groupBy({
      by: ['userId', 'billable'],
      where: { tenantId, ...(userId ? { userId } : {}) },
      _sum: { minutes: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    const byUser = new Map<
      string,
      { id: string; name: string; minutes: number; billable: number }
    >();
    for (const group of groups) {
      const row = byUser.get(group.userId) ?? {
        id: group.userId,
        name: names.get(group.userId) ?? 'Usuário removido',
        minutes: 0,
        billable: 0,
      };
      row.minutes += group._sum.minutes ?? 0;
      if (group.billable) row.billable += group._sum.minutes ?? 0;
      byUser.set(group.userId, row);
    }
    const rows = [...byUser.values()];
    return {
      totalMinutes: rows.reduce((n, r) => n + r.minutes, 0),
      billableMinutes: rows.reduce((n, r) => n + r.billable, 0),
      byUser: rows,
    };
  }
}
