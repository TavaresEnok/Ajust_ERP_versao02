import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ServiceOrdersService } from './service-orders.service';
const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Atomic order and SLA history', () => {
  const prisma = new PrismaClient();
  const ids: string[] = [];
  afterAll(async () => {
    await prisma.slaAuditEvent.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.serviceOrderOccurrence.deleteMany({ where: { serviceOrderId: { in: ids } } });
    await prisma.serviceOrderStatusEvent.deleteMany({ where: { serviceOrderId: { in: ids } } });
    await prisma.serviceOrder.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
  it.each(['deadline', 'pause'])(
    'rolls back %s and its history when SLA persistence fails',
    async (mode) => {
      const member = await prisma.userTenant.findFirstOrThrow();
      const deadlineAt = new Date(Date.now() + 86400000);
      const order = await prisma.serviceOrder.create({
        data: {
          tenantId: member.tenantId,
          protocol: randomUUID(),
          type: 'DNS',
          priority: 'NORMAL',
          title: 'Atomic test',
          description: 'Atomic test',
          status: 'EM_ANALISE',
          deadlineAt,
        },
      });
      ids.push(order.id);
      const db = {
        serviceOrder: prisma.serviceOrder,
        $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
          prisma.$transaction(async (tx) =>
            callback({
              ...tx,
              slaAuditEvent: {
                create: async (args: Parameters<typeof tx.slaAuditEvent.create>[0]) => {
                  await tx.slaAuditEvent.create(args);
                  throw new Error('Simulated SLA persistence failure');
                },
              },
            }),
          ),
      };
      const service = new ServiceOrdersService(
        db as never,
        { emitTenantEvent: jest.fn() } as never,
        {} as never,
      );
      const action =
        mode === 'deadline'
          ? service.updateOrder(member.tenantId, order.id, member.userId, 'gerente', {
              expectedVersion: order.version,
              deadlineAt: new Date(Date.now() + 172800000).toISOString(),
              deadlineReason: 'Approved extension',
            })
          : service.transition(member.tenantId, order.id, member.userId, 'analista', {
              expectedVersion: order.version,
              toStatus: 'AG_TERCEIROS',
              reason: 'External dependency',
            });
      await expect(action).rejects.toThrow('Simulated SLA persistence failure');
      const persisted = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.version).toBe(order.version);
      expect(persisted.deadlineAt).toEqual(deadlineAt);
      expect(persisted.status).toBe('EM_ANALISE');
      expect(persisted.pausedAt).toBeNull();
      expect(await prisma.slaAuditEvent.count({ where: { orderId: order.id } })).toBe(0);
      expect(
        await prisma.serviceOrderOccurrence.count({ where: { serviceOrderId: order.id } }),
      ).toBe(0);
      expect(
        await prisma.serviceOrderStatusEvent.count({ where: { serviceOrderId: order.id } }),
      ).toBe(0);
    },
  );
});
