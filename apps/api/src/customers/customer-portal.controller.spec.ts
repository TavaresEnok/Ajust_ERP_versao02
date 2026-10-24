import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerPortalController } from './customer-portal.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../common/request-with-auth';
const request = {
  auth: { role: 'cliente', tenantId: 'ajust', customerId: 'meganet' },
} as RequestWithAuth;
describe('CustomerPortalController', () => {
  const prisma = {
    customer: { findFirst: jest.fn() },
    serviceOrder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    calendarEvent: { findMany: jest.fn() },
  };
  let controller: CustomerPortalController;
  beforeEach(() => {
    jest.resetAllMocks();
    controller = new CustomerPortalController(prisma as unknown as PrismaService);
    prisma.customer.findFirst.mockResolvedValue({ tradeName: 'Meganet' });
    prisma.serviceOrder.findMany.mockResolvedValue([]);
    prisma.serviceOrder.count.mockResolvedValue(0);
    prisma.serviceOrder.groupBy.mockResolvedValue([]);
  });
  it('requires a linked client, not merely a tenant or a client-supplied ID', async () => {
    await expect(
      controller.list({ auth: { role: 'cliente', tenantId: 'ajust' } } as RequestWithAuth, {
        customerId: 'meganet',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.serviceOrder.findMany).not.toHaveBeenCalled();
  });
  it('filters by trusted customer, workspace and public visibility without returning raw metadata', async () => {
    await controller.list(request, {
      search: 'DNS',
      status: 'active',
      customerId: 'other',
      offset: 25,
    });
    const args = prisma.serviceOrder.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      tenantId: 'ajust',
      deletedAt: null,
      isCustomerVisible: true,
      occurrence: { customerId: 'meganet', tenantId: 'ajust', deletedAt: null },
      status: { notIn: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] },
    });
    expect(args.skip).toBe(25);
    expect(args.select.sourceMetadata).toBeUndefined();
    expect(args.select.internalNotes).toBeUndefined();
  });
  it('rejects invalid pagination instead of truncating or accepting unlimited reads', async () => {
    await expect(controller.list(request, { limit: 500 })).rejects.toThrow();
    expect(prisma.serviceOrder.findMany).not.toHaveBeenCalled();
  });
  it('uses the Fortaleza month and prefers resolution over a later administrative closure', async () => {
    const now = new Date('2026-11-01T01:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    try {
      await controller.list(request, {});
      const monthRange = { gte: new Date('2026-10-01T03:00:00.000Z'), lte: now };
      expect(prisma.serviceOrder.count.mock.calls[1][0].where.createdAt).toEqual(monthRange);
      expect(prisma.serviceOrder.count.mock.calls[2][0].where).toMatchObject({
        isCustomerVisible: true,
        occurrence: { customerId: 'meganet' },
        status: { in: ['FECHADA', 'RESOLVIDA'] },
        OR: [{ resolvedAt: null, closedAt: monthRange }, { resolvedAt: monthRange }],
      });
    } finally {
      jest.useRealTimers();
    }
  });
  it('hides private comments and denies unknown/other-customer order IDs', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(controller.detail(request, 'other-order')).rejects.toThrow(NotFoundException);
    const args = prisma.serviceOrder.findFirst.mock.calls[0][0];
    expect(args.where.occurrence.customerId).toBe('meganet');
    expect(args.select.occurrences.where).toEqual({ isCustomerVisible: true });
  });
  it('does not invent SLA deadlines for imported history', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      slaEligible: false,
      deadlineAt: new Date(),
      occurrences: [],
    });
    expect((await controller.detail(request, 'order-1')).deadlineAt).toBeNull();
  });
  it('limits the calendar to the customer visible service order IDs', async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([{ id: 'own-order' }]);
    prisma.calendarEvent.findMany.mockResolvedValue([]);
    await controller.agenda(request);
    expect(prisma.calendarEvent.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 'ajust',
      serviceOrderId: { in: ['own-order'] },
    });
  });
});
