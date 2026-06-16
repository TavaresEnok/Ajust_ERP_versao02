import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Inject, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { TenantRateLimit, TenantRateLimitGuard } from '../common/tenant-rate-limit.guard';
import { PrismaService } from '../prisma/prisma.service';
import { assertManagerRole } from '../common/role-utils';

interface AgendaItem {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  attendees: string[];
  source: 'calendar_event' | 'service_order' | 'change_window';
  refId: string;
}

interface TenantServiceItem {
  id: string;
  provider: string;
  location: string;
  service: string;
  status: 'online' | 'degraded' | 'offline';
  uptime: number | null;
  latencyMs: number | null;
  throughputMbps: number | null;
  alerts: number | null;
  lastCheck: string | null;
  updatedAt: string;
  alertMsg?: string;
}

@ApiTags('Dashboards')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('dashboards')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class DashboardsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('agenda-overview')
  @UseGuards(TenantRateLimitGuard)
  @TenantRateLimit(20, 60)
  async getAgendaOverview(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const tenantId = req.auth.tenantId;

    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [events, upcomingOS, changeWindows] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: {
          tenantId,
          startAt: { gte: weekStart, lt: weekEnd },
        },
        orderBy: { startAt: 'asc' },
        take: 50,
      }),
      this.prisma.serviceOrder.findMany({
        where: {
          tenantId,
          deletedAt: null,
          deadlineAt: { gte: weekStart, lt: weekEnd },
          status: { in: ['AG_CAMPO', 'EM_ANALISE'] },
        },
        orderBy: { deadlineAt: 'asc' },
        take: 25,
        select: { id: true, protocol: true, title: true, deadlineAt: true, type: true },
      }),
      this.prisma.changeRequest.findMany({
        where: {
          tenantId,
          deletedAt: null,
          plannedStart: { gte: weekStart, lt: weekEnd },
          status: { in: ['APROVADO', 'EM_EXECUCAO'] },
        },
        orderBy: { plannedStart: 'asc' },
        take: 25,
      }),
    ]);

    const items: AgendaItem[] = [];

    for (const ev of events) {
      const end = ev.endAt ?? ev.startAt;
      items.push({
        id: ev.id,
        title: ev.title,
        type: ev.type,
        start: ev.startAt.toISOString(),
        end: end.toISOString(),
        attendees: ev.assigneeId ? [ev.assigneeId] : [],
        source: 'calendar_event',
        refId: ev.id,
      });
    }

    for (const os of upcomingOS) {
      if (!os.deadlineAt) continue;
      const end = new Date(os.deadlineAt);
      end.setHours(end.getHours() + 2);
      items.push({
        id: os.id,
        title: `O.S. ${os.protocol} — ${os.title}`,
        type: os.type,
        start: os.deadlineAt.toISOString(),
        end: end.toISOString(),
        attendees: [],
        source: 'service_order',
        refId: os.id,
      });
    }

    for (const ch of changeWindows) {
      if (!ch.plannedStart || !ch.plannedEnd) continue;
      items.push({
        id: ch.id,
        title: `Janela: ${ch.title}`,
        type: 'CHANGE_WINDOW',
        start: ch.plannedStart.toISOString(),
        end: ch.plannedEnd.toISOString(),
        attendees: [],
        source: 'change_window',
        refId: ch.id,
      });
    }

    items.sort((a, b) => a.start.localeCompare(b.start));

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      items,
    };
  }

  @Get('tenant-services')
  @UseGuards(TenantRateLimitGuard)
  @TenantRateLimit(15, 60)
  async getTenantServices(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const tenantId = req.auth.tenantId;

    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const items: TenantServiceItem[] = assets.map((a) => {
      const statusRaw = a.status;
      const status: TenantServiceItem['status'] =
        statusRaw === 'INATIVO' || statusRaw === 'DESATIVADO'
          ? 'offline'
          : statusRaw === 'MANUTENCAO'
            ? 'degraded'
            : 'online';
      return {
        id: a.id,
        provider: a.vendor || '—',
        location: a.location || '—',
        service: a.name || a.category || '—',
        status,
        uptime: null,
        latencyMs: null,
        throughputMbps: null,
        alerts: null,
        lastCheck: null,
        updatedAt: a.updatedAt.toISOString(),
        alertMsg: undefined,
      };
    });

    return { items };
  }
}
