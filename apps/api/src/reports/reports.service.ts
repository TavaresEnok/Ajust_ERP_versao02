import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma, Priority, ServiceOrderStatus, ServiceOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private parsePeriodDate(value: string, field: 'periodStart' | 'periodEnd'): Date {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const normalized =
      dateOnly && field === 'periodStart'
        ? `${value}T00:00:00.000Z`
        : dateOnly
          ? `${value}T23:59:59.999Z`
          : value;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime()) || (dateOnly && !parsed.toISOString().startsWith(value))) {
      throw new BadRequestException(`${field} must be a valid ISO date.`);
    }
    return parsed;
  }

  async getOperationalHealth(tenantId: string) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: { tenantId, deletedAt: null },
      include: { timeEntries: true },
      take: 2000,
      orderBy: { createdAt: 'desc' },
    });

    const providersData = new Map<string, any>();

    for (const rawOrder of orders) {
      const order = rawOrder;
      const p = order.requester || 'Interno';
      if (!providersData.has(p)) {
        providersData.set(p, {
          name: p,
          totalOrders: 0,
          criticalOrders: 0,
          closedOrders: 0,
          totalMinutes: 0,
        });
      }

      const pData = providersData.get(p);
      pData.totalOrders += 1;
      if (order.priority === 'CRITICA') pData.criticalOrders += 1;
      if (['FECHADA', 'RESOLVIDA'].includes(order.status)) pData.closedOrders += 1;

      const orderMinutes =
        order.timeEntries?.reduce((sum: number, t: any) => sum + t.minutes, 0) || 0;
      pData.totalMinutes += orderMinutes;
    }

    const report = Array.from(providersData.values()).map((p) => {
      const criticalRate = p.totalOrders > 0 ? p.criticalOrders / p.totalOrders : 0;
      const resolutionRate = p.totalOrders > 0 ? p.closedOrders / p.totalOrders : 0;
      const hoursConsumed = Math.round((p.totalMinutes / 60) * 10) / 10;

      // Calculate Grade A-F based on critical rate and resolution rate
      // Low critical rate + high resolution = A
      let score = 100;
      score -= criticalRate * 100; // penalty for criticals
      score -= (1 - resolutionRate) * 50; // penalty for unresolved

      let grade = 'A';
      if (score < 50) grade = 'F';
      else if (score < 65) grade = 'D';
      else if (score < 80) grade = 'C';
      else if (score < 90) grade = 'B';

      return {
        ...p,
        criticalRate: Math.round(criticalRate * 100),
        resolutionRate: Math.round(resolutionRate * 100),
        hoursConsumed,
        score: Math.round(score),
        grade,
      };
    });

    // Sort by grade worst to best, then by volume
    return report.sort((a, b) => a.score - b.score);
  }

  async getManagerKPIs(tenantId: string) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
      },
      take: 2000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        analystName: true,
        status: true,
        priority: true,
        createdAt: true,
        deadlineAt: true,
        updatedAt: true,
      },
    });

    const analystKPIs = new Map<string, any>();
    let totalOpen = 0;
    let totalClosed = 0;
    let slaBreaches = 0;

    for (const order of orders) {
      const analyst = order.analystName || 'Unassigned';
      if (!analystKPIs.has(analyst)) {
        analystKPIs.set(analyst, {
          name: analyst,
          open: 0,
          closed: 0,
          slaBreaches: 0,
          totalResolutionTimeMs: 0,
        });
      }

      const pData = analystKPIs.get(analyst);
      const isClosed = ['FECHADA', 'RESOLVIDA'].includes(order.status);

      if (isClosed) {
        totalClosed++;
        pData.closed += 1;
        pData.totalResolutionTimeMs +=
          new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime();
      } else {
        totalOpen++;
        pData.open += 1;
      }

      if (order.deadlineAt && new Date() > new Date(order.deadlineAt) && !isClosed) {
        slaBreaches++;
        pData.slaBreaches += 1;
      }
    }

    const performanceByAnalyst = Array.from(analystKPIs.values()).map((a) => ({
      ...a,
      tmrHours:
        a.closed > 0 ? Math.round((a.totalResolutionTimeMs / a.closed / 3600000) * 10) / 10 : 0,
    }));

    return {
      overview: {
        totalOpen,
        totalClosed,
        slaBreaches,
      },
      performanceByAnalyst,
    };
  }

  async getServiceOrderFlow(
    tenantId: string,
    filters: {
      periodStart?: string;
      periodEnd?: string;
      priority?: string;
      type?: string;
      provider?: string;
      analyst?: string;
      sector?: string;
      sla?: string;
    },
  ) {
    const now = new Date();
    const activeStatuses: ServiceOrderStatus[] = [
      'ABERTA',
      'EM_ANALISE',
      'AG_CAMPO',
      'AG_TERCEIROS',
      'RESOLVIDA',
    ];
    const orderWhere: Prisma.ServiceOrderWhereInput = { tenantId, deletedAt: null };

    if (filters.periodStart || filters.periodEnd) {
      const periodStart = filters.periodStart
        ? this.parsePeriodDate(filters.periodStart, 'periodStart')
        : undefined;
      const periodEnd = filters.periodEnd
        ? this.parsePeriodDate(filters.periodEnd, 'periodEnd')
        : undefined;
      if (periodStart && periodEnd && periodStart > periodEnd) {
        throw new BadRequestException('periodStart must be before or equal to periodEnd.');
      }
      orderWhere.createdAt = {};
      if (periodStart) orderWhere.createdAt.gte = periodStart;
      if (periodEnd) orderWhere.createdAt.lte = periodEnd;
    }
    if (filters.priority && Object.values(Priority).includes(filters.priority as Priority)) {
      orderWhere.priority = filters.priority as Priority;
    }
    if (
      filters.type &&
      Object.values(ServiceOrderType).includes(filters.type as ServiceOrderType)
    ) {
      orderWhere.type = filters.type as ServiceOrderType;
    }
    if (filters.sector) orderWhere.sector = { contains: filters.sector, mode: 'insensitive' };
    if (filters.analyst)
      orderWhere.analystName = { contains: filters.analyst, mode: 'insensitive' };
    if (filters.provider) {
      orderWhere.occurrence = {
        is: {
          provider: { contains: filters.provider, mode: 'insensitive' },
        },
      };
    }
    if (filters.sla === 'overdue') {
      orderWhere.status = { in: activeStatuses };
      orderWhere.deadlineAt = { lt: now };
    } else if (filters.sla === 'risk') {
      orderWhere.status = { in: activeStatuses };
      orderWhere.deadlineAt = {
        gte: now,
        lte: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      };
    } else if (filters.sla === 'ok') {
      orderWhere.OR = [
        { status: { in: ['FECHADA', 'CANCELADA'] as ServiceOrderStatus[] } },
        { deadlineAt: { gt: new Date(now.getTime() + 2 * 60 * 60 * 1000) } },
      ];
    }

    const orders = await this.prisma.serviceOrder.findMany({
      where: orderWhere,
      select: {
        id: true,
        status: true,
        priority: true,
        protocol: true,
        title: true,
        type: true,
        createdAt: true,
        deadlineAt: true,
        analystName: true,
        sector: true,
        occurrence: {
          select: { provider: true },
        },
      },
    });

    const orderIds = orders.map((o) => o.id);
    const orderById = new Map(orders.map((o) => [o.id, o]));

    const events =
      orderIds.length > 0
        ? await this.prisma.serviceOrderStatusEvent.findMany({
            where: { tenantId, serviceOrderId: { in: orderIds } },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    const statusCounts = new Map<
      string,
      {
        total: number;
        overdue: number;
        ageTotalMinutes: number;
        byPriority: Record<string, number>;
        orders: Array<{
          id: string;
          protocol: string;
          title: string;
          priority: string;
          type: string;
          deadlineAt: string;
          analystName: string | null;
          provider: string | null;
        }>;
      }
    >();
    const transitionStats = new Map<string, { count: number; totalMinutes: number }>();

    for (const o of orders) {
      const createdAt = o.createdAt ? new Date(o.createdAt) : now;
      const deadlineAt = o.deadlineAt ? new Date(o.deadlineAt) : now;
      const entry = statusCounts.get(o.status) || {
        total: 0,
        overdue: 0,
        ageTotalMinutes: 0,
        byPriority: {},
        orders: [],
      };
      entry.total++;
      entry.ageTotalMinutes += Math.max(
        0,
        Math.round((now.getTime() - createdAt.getTime()) / 60000),
      );
      if (
        o.deadlineAt &&
        now > deadlineAt &&
        !['FECHADA', 'RESOLVIDA', 'CANCELADA'].includes(o.status)
      ) {
        entry.overdue++;
      }
      entry.byPriority[o.priority] = (entry.byPriority[o.priority] || 0) + 1;
      if (entry.orders.length < 25) {
        entry.orders.push({
          id: o.id,
          protocol: o.protocol,
          title: o.title || '-',
          priority: o.priority,
          type: o.type || '-',
          deadlineAt: deadlineAt.toISOString(),
          analystName: o.analystName,
          provider: o.occurrence?.provider ?? null,
        });
      }
      statusCounts.set(o.status, entry);
    }

    const lastEventAtByOrder = new Map<string, Date>();
    for (const ev of events) {
      const key = `${ev.fromStatus}->${ev.toStatus}`;
      const order = orderById.get(ev.serviceOrderId);
      const eventAt = ev.createdAt ? new Date(ev.createdAt) : now;
      const previousAt =
        lastEventAtByOrder.get(ev.serviceOrderId) ??
        (order?.createdAt ? new Date(order.createdAt) : eventAt);
      const minutes = Math.max(0, Math.round((eventAt.getTime() - previousAt.getTime()) / 60000));
      const entry = transitionStats.get(key) || { count: 0, totalMinutes: 0 };
      entry.count++;
      entry.totalMinutes += minutes;
      transitionStats.set(key, entry);
      lastEventAtByOrder.set(ev.serviceOrderId, eventAt);
    }

    const nodes = Array.from(statusCounts.entries()).map(([status, data]) => ({
      status,
      total: data.total,
      overdue: data.overdue,
      avgAgeMinutes: data.total > 0 ? Math.round(data.ageTotalMinutes / data.total) : 0,
      priorityBreakdown: data.byPriority,
      orders: data.orders,
    }));

    const edges = Array.from(transitionStats.entries()).map(([key, stat]) => {
      const [from, to] = key.split('->');
      return {
        from,
        to,
        count: stat.count,
        avgTransitionMinutes: stat.count > 0 ? Math.round(stat.totalMinutes / stat.count) : 0,
      };
    });

    return {
      nodes,
      edges,
      totalOrders: orders.length,
    };
  }
}
