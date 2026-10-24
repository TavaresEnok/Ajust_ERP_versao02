import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OrderOperationsService } from './order-operations.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import { OperationalProcessesService } from '../service-processes/operational-processes.service';
import { ajustFlow } from '../service-processes/ajust-default-flows';
import { ServiceOrdersService } from './service-orders.service';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Atendimento Ajust: operações integradas com rollback', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  it('agenda fim de semana, pausa, encaminha, conclui e reabre sem duplicar entregas', async () => {
    const rollback = new Error('ROLLBACK_AJUST_OPERATIONS');
    try {
      await prisma.$transaction(
        async (tx) => {
          const member = await tx.userTenant.findFirstOrThrow({
            where: { role: { code: 'gerente' }, user: { status: 'ACTIVE' } },
            include: { user: true },
          });
          const analyst = await tx.userTenant.findFirstOrThrow({
            where: {
              tenantId: member.tenantId,
              role: { code: 'analista' },
              user: { status: 'ACTIVE' },
            },
          });
          const tenantId = member.tenantId,
            actor = member.userId;
          const client = {
            ...tx,
            $transaction: async (cb: (t: typeof tx) => unknown) => {
              await tx.$executeRawUnsafe('SAVEPOINT ajust_operation_test');
              try {
                const result = await cb(tx);
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT ajust_operation_test');
                return result;
              } catch (e) {
                await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ajust_operation_test');
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT ajust_operation_test');
                throw e;
              }
            },
          };
          const processes = new OperationalProcessesService(
            client as never,
            { executeForEvent: async () => undefined } as never,
          );
          const operations = new OrderOperationsService(
            client as never,
            new SlaEngineService(client as never),
            processes,
          );
          const def = ajustFlow('AJUST_EQUIPAMENTO');
          def.code = `TEST_${randomUUID().replace(/-/g, '').toUpperCase()}`;
          await tx.serviceProcessTemplate.create({
            data: {
              tenantId,
              code: def.code,
              version: 1,
              definition: def,
              publishedAt: new Date(),
            },
          });
          const occurrence = await tx.occurrence.create({
            data: {
              tenantId,
              number: `TEST-${randomUUID()}`,
              provider: 'Teste revertido',
              type: 'Configuração de equipamento',
              sector: 'NOC',
              origin: 'TEST',
              openedByName: 'Teste',
              analystResponsible: 'Teste',
              description: 'Teste transacional',
            },
          });
          let order = await tx.serviceOrder.create({
            data: {
              tenantId,
              occurrenceId: occurrence.id,
              protocol: `TEST-${randomUUID()}`,
              type: 'INFRAESTRUTURA',
              priority: 'CRITICA',
              title: 'Teste equipamento',
              description: 'Teste revertido',
              assigneeUserId: actor,
              analystName: member.user.name,
              deadlineAt: new Date('2030-03-01T09:00:00Z'),
            },
          });
          await processes.start(tenantId, actor, order.id, def.code);
          order = await tx.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
          const deadline = order.deadlineAt;
          const call = async (action: any, extra = {}) => {
            order = await operations.run(tenantId, actor, 'gerente', order.id, {
              action,
              expectedVersion: order.version,
              reason: 'Teste transacional revertido',
              ...extra,
            });
            return order;
          };
          await call('schedule', {
            scheduledAt: '2030-03-02T02:00:00-03:00',
            change: {
              impact: 'Interrupção prevista durante a troca',
              rollbackPlan: 'Retornar cabeamento e configuração anterior',
            },
          });
          expect(order.deadlineAt).toEqual(deadline);
          expect(order.changeRequestId).toBeTruthy();
          expect(await tx.calendarEvent.count({ where: { serviceOrderId: order.id } })).toBe(1);
          await call('pause');
          expect(order.pausedAt).not.toBeNull();
          await expect(call('finish')).rejects.toThrow('Retome');
          expect((await operations.alerts(tenantId)).some((x) => x.id === order.id)).toBe(true);
          await call('resume');
          expect(order.pausedAt).toBeNull();
          const resumedDeadline = order.deadlineAt;
          await call('assign', { assigneeUserId: analyst.userId });
          expect(order.assigneeUserId).toBe(analyst.userId);
          expect(order.deadlineAt).toEqual(resumedDeadline);
          const staleVersion = order.version;
          await call('start', { reason: '' });
          expect(order.status).toBe('EM_ANALISE');
          expect(order.scheduleStartedAt).not.toBeNull();
          expect(
            await tx.serviceOrderOccurrence.count({
              where: {
                serviceOrderId: order.id,
                actorUserId: actor,
                message: 'Execução iniciada.',
              },
            }),
          ).toBe(1);
          await expect(
            operations.run(tenantId, actor, 'gerente', order.id, {
              action: 'finish',
              expectedVersion: staleVersion,
              reason: 'Versão antiga',
            }),
          ).rejects.toThrow();
          await call('finish');
          expect(order.status).toBe('FECHADA');
          let children = await tx.serviceOrder.findMany({ where: { parentOrderId: order.id } });
          expect(children).toHaveLength(3);
          expect(children.every((c) => c.assigneeUserId === analyst.userId)).toBe(true);
          expect(
            (await tx.occurrence.findUniqueOrThrow({ where: { id: occurrence.id } })).status,
          ).not.toBe('ENCERRADA');
          await expect(
            operations.run(tenantId, actor, 'cliente', children[0].id, {
              action: 'finish',
              expectedVersion: children[0].version,
              reason: 'Acesso indevido',
            }),
          ).rejects.toThrow();
          await expect(
            operations.run(randomUUID(), actor, 'gerente', children[0].id, {
              action: 'finish',
              expectedVersion: children[0].version,
              reason: 'Outra empresa',
            }),
          ).rejects.toThrow();
          for (const child of children)
            await operations.run(tenantId, actor, 'gerente', child.id, {
              action: 'finish',
              expectedVersion: child.version,
              reason: 'Entrega de teste concluída',
            });
          expect(
            (await tx.occurrence.findUniqueOrThrow({ where: { id: occurrence.id } })).status,
          ).toBe('ENCERRADA');
          await call('reopen');
          expect(order.closedAt).toBeNull();
          await call('finish');
          children = await tx.serviceOrder.findMany({ where: { parentOrderId: order.id } });
          expect(children).toHaveLength(3);
          expect(
            (await tx.occurrence.findUniqueOrThrow({ where: { id: occurrence.id } })).status,
          ).toBe('ENCERRADA');
          expect(await tx.slaAuditEvent.count({ where: { orderId: order.id } })).toBe(2);
          const intake = new ServiceOrdersService(
            client as never,
            { emitTenantEvent: () => undefined } as never,
            new SlaEngineService(client as never),
            undefined,
            undefined,
            undefined,
            undefined,
            processes,
          );
          const customer = await tx.customer.findFirstOrThrow({
            where: { tenantId, deletedAt: null },
          });
          const input = {
            tenantId,
            customerId: customer.id,
            provider: customer.tradeName || customer.legalName,
            type: 'DNS',
            sector: 'NOC',
            origin: 'TEST',
            openedByName: member.user.name,
            analystResponsible: member.user.name,
            description: 'Teste de registro concluído',
            firstOrder: {
              type: 'DNS' as const,
              ownerUserId: actor,
              assigneeUserId: actor,
              description: 'Autorização realizada e resultado registrado',
              recordCompleted: true,
            },
          };
          const recorded = await intake.createOccurrenceWithFirstOrder(actor, 'gerente', input);
          expect(recorded.status).toBe('ENCERRADA');
          expect(recorded.serviceOrders[0].closedAt).not.toBeNull();
          expect(recorded.serviceOrders[0].processInstanceId).toBeTruthy();
          const opened = await intake.createOccurrenceWithFirstOrder(actor, 'gerente', {
            ...input,
            firstOrder: { ...input.firstOrder, recordCompleted: false },
          });
          expect(opened.serviceOrders[0].status).toBe('ABERTA');
          expect(opened.serviceOrders[0].processInstanceId).toBeTruthy();
          await intake.createOrderInOccurrence(tenantId, opened.id, actor, 'gerente', {
            type: 'DNS',
            description: 'Validação complementar da mesma demanda',
            assigneeUserId: actor,
          });
          const pending = await tx.serviceOrder.findMany({ where: { occurrenceId: opened.id } });
          expect(pending).toHaveLength(2);
          expect(pending.every((o) => !!o.processInstanceId)).toBe(true);
          const bulk = await operations.closeOccurrence(tenantId, actor, 'gerente', opened.id, {
            reason: 'Validações concluídas em teste revertido',
            orders: pending.map((o) => ({ id: o.id, version: o.version })),
          });
          expect(bulk.status).toBe('ENCERRADA');
          throw rollback;
        },
        { timeout: 60000 },
      );
    } catch (e) {
      if (e !== rollback) throw e;
    }
  }, 70000);
});
