import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma, Priority, ServiceOrderStatus, ServiceOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildServiceTypeAnalytics } from './service-type-analytics';
import { buildManagementOverview, isDemonstration, managementPeriod } from './management-overview';

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

  async getOperationalHealth(
    tenantId: string,
    options?: { periodStart?: string; periodEnd?: string; daysBack?: number },
  ) {
    const whereClause: Prisma.ServiceOrderWhereInput = { tenantId, deletedAt: null };
    if (
      options?.daysBack !== undefined &&
      (!Number.isInteger(options.daysBack) || options.daysBack < 1 || options.daysBack > 3650)
    )
      throw new BadRequestException('daysBack deve estar entre 1 e 3650.');

    if (options?.periodStart || options?.periodEnd) {
      const periodStart = options.periodStart
        ? this.parsePeriodDate(options.periodStart, 'periodStart')
        : undefined;
      const periodEnd = options.periodEnd
        ? this.parsePeriodDate(options.periodEnd, 'periodEnd')
        : undefined;
      if (periodStart && periodEnd && periodStart > periodEnd)
        throw new BadRequestException('O início deve ser anterior ao fim do período.');
      whereClause.createdAt = {};
      if (periodStart) whereClause.createdAt.gte = periodStart;
      if (periodEnd) whereClause.createdAt.lte = periodEnd;
    } else if (options?.daysBack) {
      whereClause.createdAt = {
        gte: new Date(Date.now() - options.daysBack * 24 * 60 * 60 * 1000),
      };
    }

    const orders = await this.prisma.serviceOrder.findMany({
      where: whereClause,
      select: {
        id: true,
        sourceMetadata: true,
        requester: true,
        occurrence: { select: { provider: true, customerId: true } },
        priority: true,
        status: true,
        timeEntries: {
          select: { minutes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const providersData = new Map<string, any>();

    for (const rawOrder of orders) {
      if (isDemonstration(rawOrder)) continue;
      const order = rawOrder;
      const p = order.occurrence?.customerId || order.occurrence?.provider?.trim() || 'Interno';
      if (!providersData.has(p)) {
        providersData.set(p, {
          name: order.occurrence?.provider?.trim() || 'Interno',
          customerId: order.occurrence?.customerId || null,
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
        order.timeEntries?.reduce((sum: number, t: { minutes: number }) => sum + t.minutes, 0) || 0;
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

  async getManagementOverview(tenantId: string, days = 30) {
    if (!Number.isInteger(days) || days < 1 || days > 3650)
      throw new BadRequestException('daysBack deve estar entre 1 e 3650.');
    const now = new Date();
    const { start, end } = managementPeriod(days, now);
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { status: { notIn: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] } },
          { createdAt: { gte: start, lte: end } },
          { resolvedAt: { gte: start, lte: end } },
          { closedAt: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        assigneeUserId: true,
        analystName: true,
        assignee: { select: { name: true } },
        sourceMetadata: true,
        deadlineAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedAt: true,
        scheduledAt: true,
        scheduleStartedAt: true,
        slaEligible: true,
      },
    });
    return buildManagementOverview(orders, days, now);
  }

  async getManagerKPIs(tenantId: string, options?: { daysBack?: number }) {
    const days = options?.daysBack ?? 30;
    // Até um ano: a consulta traz as O.S. do período (só as colunas usadas) para calcular
    // indicadores por responsável; 10 anos carregava o histórico inteiro na memória (C-040).
    if (!Number.isInteger(days) || days < 1 || days > 366)
      throw new BadRequestException('O período deve ser de 1 a 366 dias.');
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: sinceDate },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceMetadata: true,
        analystName: true,
        assigneeUserId: true,
        status: true,
        pausedAt: true,
        slaEligible: true,
        priority: true,
        createdAt: true,
        deadlineAt: true,
        resolvedAt: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    const analystKPIs = new Map<string, any>();
    let totalOpen = 0;
    let totalClosed = 0;
    let slaBreaches = 0;
    let measuredClosed = 0;
    let resolutionTotalMs = 0;
    let slaEvaluated = 0;
    let slaMet = 0;
    let closedLate = 0;
    let resolvedAwaiting = 0;

    // Agrupa pelo id do responsável, não pelo nome: renomear ou trocar o nome não divide a
    // produtividade (C-040). O nome mais recente é só para exibir.
    for (const order of orders) {
      if (isDemonstration(order)) continue;
      const analyst = order.assigneeUserId || order.analystName || 'Sem responsável';
      if (!analystKPIs.has(analyst)) {
        analystKPIs.set(analyst, {
          userId: order.assigneeUserId ?? null,
          name: order.analystName || 'Sem responsável',
          open: 0,
          closed: 0,
          slaBreaches: 0,
          closedLate: 0,
          totalResolutionTimeMs: 0,
          measuredClosed: 0,
        });
      }

      const pData = analystKPIs.get(analyst);
      const isClosed = ['FECHADA', 'RESOLVIDA'].includes(order.status);

      if (isClosed) {
        totalClosed++;
        pData.closed += 1;
        if (order.status === 'RESOLVIDA') resolvedAwaiting++;
        // Usa a data efetiva de resolução (resolvedAt ou closedAt), evitando distorções por atualizações posteriores em updatedAt
        const effectiveResolution = order.resolvedAt || order.closedAt;
        const finished = effectiveResolution ? new Date(effectiveResolution).getTime() : NaN;
        const created = new Date(order.createdAt).getTime();
        if (
          Number.isFinite(finished) &&
          Number.isFinite(created) &&
          finished >= created &&
          finished <= Date.now()
        ) {
          const diffMs = finished - created;
          pData.totalResolutionTimeMs += diffMs;
          pData.measuredClosed++;
          measuredClosed++;
          resolutionTotalMs += diffMs;
          const deadline = order.deadlineAt ? new Date(order.deadlineAt).getTime() : NaN;
          if (order.slaEligible !== false && Number.isFinite(deadline)) {
            slaEvaluated++;
            if (finished <= deadline) slaMet++;
            else {
              // Fechada fora do prazo também é violação (C-040), além das ainda abertas.
              closedLate++;
              pData.closedLate += 1;
            }
          }
        }
      } else if (order.status !== 'CANCELADA') {
        totalOpen++;
        pData.open += 1;
      }

      if (
        order.slaEligible !== false &&
        !order.pausedAt &&
        order.deadlineAt &&
        new Date() > new Date(order.deadlineAt) &&
        !isClosed &&
        order.status !== 'CANCELADA'
      ) {
        slaBreaches++;
        pData.slaBreaches += 1;
      }
    }

    const performanceByAnalyst = Array.from(analystKPIs.values()).map((a) => ({
      ...a,
      tmrHours:
        a.measuredClosed > 0
          ? Math.round((a.totalResolutionTimeMs / a.measuredClosed / 3600000) * 10) / 10
          : null,
    }));

    return {
      overview: {
        totalOpen,
        totalClosed,
        slaBreaches,
        closedLate,
        resolvedAwaitingClosure: resolvedAwaiting,
        tmrBasis: 'HORAS_CORRIDAS',
        tmrHours: measuredClosed
          ? Math.round((resolutionTotalMs / measuredClosed / 3600000) * 10) / 10
          : null,
        measuredClosed,
        slaPercentage: slaEvaluated ? Math.round((slaMet / slaEvaluated) * 1000) / 10 : null,
        slaEvaluated,
        slaMet,
        scope: 'ORDERS_CREATED_IN_PERIOD',
      },
      performanceByAnalyst,
    };
  }

  async getServiceTypes(
    tenantId: string,
    filters: {
      periodStart?: string;
      periodEnd?: string;
      daysBack?: number;
      provider?: string;
      source?: string;
    },
  ) {
    const where: Prisma.ServiceOrderWhereInput = { tenantId, deletedAt: null };
    if (filters.source === 'SGP' || filters.source === 'ERP') where.sourceSystem = filters.source;
    else if (filters.source) throw new BadRequestException('Origem inválida. Use SGP ou ERP.');
    const start = filters.periodStart
      ? this.parsePeriodDate(filters.periodStart, 'periodStart')
      : undefined;
    const end = filters.periodEnd
      ? this.parsePeriodDate(filters.periodEnd, 'periodEnd')
      : undefined;
    if (start && end && start > end)
      throw new BadRequestException('O início deve ser anterior ao fim do período.');
    if (
      filters.daysBack !== undefined &&
      (!Number.isInteger(filters.daysBack) || filters.daysBack < 1 || filters.daysBack > 3650)
    ) {
      throw new BadRequestException('daysBack deve estar entre 1 e 3650.');
    }
    if (start || end)
      where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    else if (filters.daysBack)
      where.createdAt = { gte: new Date(Date.now() - filters.daysBack * 86400000) };
    const orders = await this.prisma.serviceOrder.findMany({
      where,
      select: {
        type: true,
        status: true,
        priority: true,
        sourceMetadata: true,
        createdAt: true,
        closedAt: true,
        resolvedAt: true,
        deadlineAt: true,
        slaEligible: true,
        analystName: true,
        assigneeUserId: true,
        requester: true,
        occurrence: { select: { type: true, provider: true, customerId: true } },
        timeEntries: { select: { minutes: true } },
      },
    });
    return buildServiceTypeAnalytics(orders, filters.provider);
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
      orderWhere.pausedAt = null;
      orderWhere.slaEligible = true;
      orderWhere.status = { in: activeStatuses };
      orderWhere.deadlineAt = { lt: now };
    } else if (filters.sla === 'risk') {
      orderWhere.pausedAt = null;
      orderWhere.slaEligible = true;
      orderWhere.status = { in: activeStatuses };
      orderWhere.deadlineAt = {
        gte: now,
        lte: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      };
    } else if (filters.sla === 'ok') {
      orderWhere.slaEligible = true;
      orderWhere.OR = [
        { status: { in: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] as ServiceOrderStatus[] } },
        { deadlineAt: { gt: new Date(now.getTime() + 2 * 60 * 60 * 1000) } },
      ];
    }

    const queriedOrders = await this.prisma.serviceOrder.findMany({
      where: orderWhere,
      select: {
        id: true,
        sourceMetadata: true,
        slaEligible: true,
        pausedAt: true,
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
    const orders = queriedOrders.filter((row) => !isDemonstration(row));

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
        o.slaEligible !== false &&
        !o.pausedAt &&
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
