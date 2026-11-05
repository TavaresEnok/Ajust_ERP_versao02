import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ChangeService } from '../change-management/change.service';
const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('History integrity in PostgreSQL', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  it('preserves time entries, topology and RFC transition history', async () => {
    const rollback = new Error('ROLLBACK_INTEGRITY');
    try {
      await prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findFirstOrThrow();
          const requester = await tx.userTenant.findFirstOrThrow({
            where: { tenantId: tenant.id, role: { code: 'gerente' } },
          });
          const approver = await tx.userTenant.findFirstOrThrow({
            where: { tenantId: tenant.id, role: { code: 'super_admin' } },
          });
          const rfc = await tx.changeRequest.create({
            data: {
              tenantId: tenant.id,
              number: randomUUID(),
              title: 'Test',
              description: 'Test',
              justification: 'Test',
              status: 'AGUARDANDO_APROVACAO',
              requestedById: requester.userId,
            },
          });
          const facade = { ...tx, $transaction: (run: (client: typeof tx) => unknown) => run(tx) };
          const service = new ChangeService(facade as never);
          await expect(
            service.transition(tenant.id, rfc.id, requester.userId, 'APROVADO', 0),
          ).rejects.toMatchObject({ status: 403 });
          const approved = await service.transition(
            tenant.id,
            rfc.id,
            approver.userId,
            'APROVADO',
            0,
          );
          expect(approved.version).toBe(1);
          await expect(
            service.transition(tenant.id, rfc.id, approver.userId, 'EM_EXECUCAO', 0),
          ).rejects.toMatchObject({ status: 409 });
          expect(
            await tx.auditLog.count({
              where: { tenantId: tenant.id, resourceType: 'change_request', resourceId: rfc.id },
            }),
          ).toBe(1);
          const order = await tx.serviceOrder.create({
            data: {
              tenantId: tenant.id,
              protocol: randomUUID(),
              type: 'DNS',
              priority: 'NORMAL',
              title: 'Test',
              description: 'Test',
              deadlineAt: new Date(),
            },
          });
          await tx.timeEntry.create({
            data: { tenantId: tenant.id, orderId: order.id, userId: requester.userId, minutes: 30 },
          });
          const customer = await tx.customer.create({
            data: { tenantId: tenant.id, legalName: 'Test', tradeName: 'Test', personType: 'J' },
          });
          await tx.networkTopology.create({
            data: {
              tenantId: tenant.id,
              customerId: customer.id,
              title: 'Test',
              xmlEnc: 'test',
              updatedByUserId: requester.userId,
              updatedByName: 'Test',
            },
          });
          for (const deletion of [
            () => tx.serviceOrder.delete({ where: { id: order.id } }),
            () => tx.user.delete({ where: { id: requester.userId } }),
            () => tx.customer.delete({ where: { id: customer.id } }),
          ]) {
            await tx.$executeRawUnsafe('SAVEPOINT restricted_delete');
            await expect(deletion()).rejects.toMatchObject({ code: 'P2003' });
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT restricted_delete');
          }
          expect(await tx.timeEntry.count({ where: { orderId: order.id } })).toBe(1);
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
