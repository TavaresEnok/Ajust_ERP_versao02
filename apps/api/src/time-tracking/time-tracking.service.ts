import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  async listByOrder(tenantId: string, orderId: string) {
    return this.prisma.timeEntry.findMany({
      where: { tenantId, orderId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async listByTenant(tenantId: string, from?: string, to?: string) {
    const where: Prisma.TimeEntryWhereInput = { tenantId };
    if (from || to) {
      where.loggedAt = {};
      if (from) where.loggedAt.gte = new Date(from);
      if (to) where.loggedAt.lte = new Date(to);
    }
    return this.prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        order: { select: { id: true, protocol: true, type: true } },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async create(tenantId: string, userId: string, input: CreateTimeEntryInput) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.orderId, tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId,
        orderId: input.orderId,
        minutes: Math.max(1, Math.round(input.minutes)),
        description: input.description,
        billable: input.billable ?? true,
        loggedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(),
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

  async summary(tenantId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true } } },
    });
    const byUser = new Map<string, { name: string; minutes: number; billable: number }>();
    for (const e of entries) {
      const existing = byUser.get(e.userId) || { name: e.user.name, minutes: 0, billable: 0 };
      existing.minutes += e.minutes;
      if (e.billable) existing.billable += e.minutes;
      byUser.set(e.userId, existing);
    }
    return {
      totalMinutes: entries.reduce((s, e) => s + e.minutes, 0),
      billableMinutes: entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0),
      byUser: Array.from(byUser.entries()).map(([id, v]) => ({ id, ...v })),
    };
  }
}
