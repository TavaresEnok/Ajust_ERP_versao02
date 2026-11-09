import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Lifecycle outbox transaction boundary in PostgreSQL', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('captures creation and status history atomically and preserves the event snapshot', async () => {
    const rollback = new Error('rollback');
    const orderId = randomUUID();
    await expect(
      db.$transaction(async (tx) => {
        const tenant = await tx.tenant.findFirstOrThrow();
        const order = await tx.serviceOrder.create({
          data: {
            id: orderId,
            tenantId: tenant.id,
            protocol: randomUUID(),
            type: 'BGP',
            priority: 'NORMAL',
            title: 'Before',
            description: 'PRIVATE',
            internalNotes: 'SECRET',
            deadlineAt: new Date(),
          },
        });
        const created = await tx.serviceOrderLifecycleEvent.findUniqueOrThrow({
          where: { id: `created:${orderId}` },
        });
        expect(created.payload).not.toHaveProperty('order.internalNotes');
        expect(created.payload).not.toHaveProperty('order.description');
        await tx.serviceOrder.update({
          where: { id: orderId },
          data: { status: 'FECHADA', title: 'Closed', version: { increment: 1 } },
        });
        const event = await tx.serviceOrderStatusEvent.create({
          data: {
            tenantId: tenant.id,
            serviceOrderId: orderId,
            fromStatus: order.status,
            toStatus: 'FECHADA',
            reason: 'done',
            metadata: { source: 'integration' },
          },
        });
        await tx.serviceOrder.update({
          where: { id: orderId },
          data: { status: 'EM_ANALISE', title: 'Reopened later' },
        });
        const saved = await tx.serviceOrderLifecycleEvent.findUniqueOrThrow({
          where: { id: `status:${event.id}` },
        });
        expect(saved.payload).toMatchObject({
          order: { title: 'Closed', status: 'FECHADA' },
          change: {
            from: 'ABERTA',
            to: 'FECHADA',
            reason: 'done',
            source: 'integration',
            workflows: true,
          },
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await db.serviceOrderLifecycleEvent.count({ where: { orderId } })).toBe(0);
    expect(await db.serviceOrder.count({ where: { id: orderId } })).toBe(0);
  });
});
