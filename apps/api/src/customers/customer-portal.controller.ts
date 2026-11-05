import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaService } from '../prisma/prisma.service';

const Page = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['all', 'active', 'closed']).default('all'),
  search: z.string().trim().max(200).optional(),
});
const publicFields = {
  id: true,
  protocol: true,
  title: true,
  type: true,
  status: true,
  priority: true,
  createdAt: true,
  closedAt: true,
  resolvedAt: true,
  analystName: true,
  deadlineAt: true,
  slaEligible: true,
} satisfies Prisma.ServiceOrderSelect;

@Controller('customer-portal')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class CustomerPortalController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private where(req: RequestWithAuth): Prisma.ServiceOrderWhereInput {
    if (req.auth?.role !== 'cliente' || !req.auth.customerId || !req.auth.tenantId)
      throw new ForbiddenException('Conta sem cliente vinculado.');
    return {
      tenantId: req.auth.tenantId,
      deletedAt: null,
      isCustomerVisible: true,
      occurrence: { customerId: req.auth.customerId, tenantId: req.auth.tenantId, deletedAt: null },
    };
  }
  @Get()
  async list(@Req() req: RequestWithAuth, @Query() query: unknown) {
    const where = this.where(req);
    const page = Page.parse(query);
    const filtered: Prisma.ServiceOrderWhereInput = {
      ...where,
      ...(page.status === 'active'
        ? { status: { notIn: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] } }
        : page.status === 'closed'
          ? { status: { in: ['FECHADA', 'RESOLVIDA'] } }
          : {}),
      ...(page.search
        ? {
            OR: [
              { title: { contains: page.search, mode: 'insensitive' } },
              { protocol: { contains: page.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const now = new Date();
    const month = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .slice(0, 7);
    const monthStart = new Date(`${month}-01T00:00:00-03:00`);
    const [customer, orders, groups, filteredTotal, entriesThisMonth, closedThisMonth] =
      await Promise.all([
        this.prisma.customer.findFirst({
          where: { id: req.auth!.customerId, tenantId: req.auth!.tenantId!, deletedAt: null },
          select: { tradeName: true, legalName: true, taxId: true },
        }),
        this.prisma.serviceOrder.findMany({
          where: filtered,
          select: publicFields,
          orderBy: { createdAt: 'desc' },
          skip: page.offset,
          take: page.limit,
        }),
        this.prisma.serviceOrder.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.serviceOrder.count({ where: filtered }),
        this.prisma.serviceOrder.count({
          where: { ...where, createdAt: { gte: monthStart, lte: now } },
        }),
        this.prisma.serviceOrder.count({
          where: {
            ...where,
            status: { in: ['FECHADA', 'RESOLVIDA'] },
            OR: [
              { resolvedAt: null, closedAt: { gte: monthStart, lte: now } },
              { resolvedAt: { gte: monthStart, lte: now } },
            ],
          },
        }),
      ]);
    const count = (statuses: string[]) =>
      groups
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);
    const total = groups.reduce((sum, row) => sum + row._count._all, 0);
    return {
      customer,
      orders: orders.map((order) => ({
        ...order,
        deadlineAt: order.slaEligible ? order.deadlineAt : null,
      })),
      total: filteredTotal,
      offset: page.offset,
      limit: page.limit,
      summary: {
        total,
        closed: count(['FECHADA', 'RESOLVIDA']),
        canceled: count(['CANCELADA']),
        active: total - count(['FECHADA', 'RESOLVIDA', 'CANCELADA']),
        entriesThisMonth,
        closedThisMonth,
      },
    };
  }
  @Get('agenda')
  async agenda(@Req() req: RequestWithAuth) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: this.where(req),
      select: { id: true },
    });
    // Never include global/team events or join by a customer name supplied by the browser.
    return this.prisma.calendarEvent.findMany({
      where: {
        tenantId: req.auth!.tenantId!,
        serviceOrderId: { in: orders.map((order) => order.id) },
      },
      select: { id: true, title: true, startAt: true, endAt: true, serviceOrderId: true },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
  }
  @Get('orders/:id')
  async detail(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { ...this.where(req), id },
      select: {
        ...publicFields,
        description: true,
        occurrences: {
          where: { isCustomerVisible: true },
          select: { id: true, message: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!order) throw new NotFoundException('Atendimento não encontrado.');
    return { ...order, deadlineAt: order.slaEligible ? order.deadlineAt : null };
  }
}
