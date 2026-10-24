import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { OperationalProcessesService } from './operational-processes.service';
import { makeOperationalDefinition } from './operational-definition';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Operational workflows: durable execution, database rollback fixtures', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  async function scenario(
    type: string,
    run: (
      svc: OperationalProcessesService,
      tenant: string,
      actor: string,
      processId: string,
      db: any,
    ) => Promise<void>,
  ) {
    const rollback = new Error('ROLLBACK_OPERATIONAL_TEST');
    try {
      await prisma.$transaction(
        async (tx) => {
          const member = await tx.userTenant.findFirstOrThrow({
            where: { role: { code: 'gerente' } },
            include: { user: true },
          });
          const tenant = member.tenantId,
            actor = member.user.id;
          const def = makeOperationalDefinition(type);
          def.code = `TEST_${randomUUID().replace(/-/g, '').toUpperCase()}`;
          await tx.serviceProcessTemplate.create({
            data: {
              tenantId: tenant,
              code: def.code,
              version: 1,
              definition: def,
              publishedAt: new Date(),
            },
          });
          const occurrence = await tx.occurrence.create({
            data: {
              tenantId: tenant,
              number: `TEST-${randomUUID()}`,
              provider: 'Teste transacional',
              type,
              sector: 'NOC',
              origin: 'TEST',
              openedByName: 'Teste',
              analystResponsible: 'Teste',
              description: 'Teste revertido ao final',
            },
          });
          const order = await tx.serviceOrder.create({
            data: {
              tenantId: tenant,
              occurrenceId: occurrence.id,
              protocol: `TEST-${randomUUID()}`,
              type: 'INFRAESTRUTURA',
              priority: 'NORMAL',
              title: 'Teste',
              description: 'Teste revertido',
              deadlineAt: new Date(),
              slaEligible: false,
            },
          });
          const client = {
            ...tx,
            $transaction: async (cb: (db: typeof tx) => unknown) => {
              await tx.$executeRawUnsafe('SAVEPOINT operational_call');
              try {
                const result = await cb(tx);
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT operational_call');
                return result;
              } catch (error) {
                await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT operational_call');
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT operational_call');
                throw error;
              }
            },
          } as unknown as PrismaService;
          const svc = new OperationalProcessesService(client, {
            executeForEvent: jest.fn(),
          } as unknown as WorkflowsService);
          const process = await svc.start(tenant, actor, order.id, def.code);
          await run(svc, tenant, actor, process.id, tx);
          throw rollback;
        },
        { timeout: 60000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function advance(
    svc: OperationalProcessesService,
    tenant: string,
    actor: string,
    id: string,
    nodeId: string,
    outcome: string,
  ) {
    const item = await svc.find(tenant, id);
    const step = item.steps.find((s) => s.nodeId === nodeId && s.status === 'ACTIVE')!;
    const def = item.definition as ReturnType<typeof makeOperationalDefinition>;
    const node = def.nodes.find((n) => n.id === nodeId)!;
    await svc.act(tenant, actor, 'gerente', id, {
      action: 'advance',
      stepId: step.id,
      expectedVersion: item.version,
      outcome,
      reason: 'Verificação transacional',
      evidence: Object.fromEntries(node.requiredFields.map((k) => [k, 'Evidência de teste'])),
    });
  }
  it('keeps DNS stages in one O.S., enforces evidence, versions and tenant scope', async () => {
    await scenario('DNS', async (svc, t, a, id, db) => {
      const first = await svc.find(t, id);
      await expect(svc.find(randomUUID(), id)).rejects.toThrow('não encontrada');
      await expect(
        svc.act(t, a, 'gerente', id, {
          action: 'advance',
          expectedVersion: first.version,
          stepId: first.steps[0].id,
          outcome: 'Qualificado',
          reason: 'Sem evidências',
        }),
      ).rejects.toThrow('Evidência');
      expect((await svc.find(t, id)).version).toBe(first.version);
      await advance(svc, t, a, id, 'triagem', 'Qualificado');
      await expect(
        svc.act(t, a, 'gerente', id, {
          action: 'pause',
          expectedVersion: first.version,
          reason: 'Repetição antiga',
        }),
      ).rejects.toThrow('Outra pessoa');
      await advance(svc, t, a, id, 'diagnostico', 'Sem alteração necessária');
      await advance(svc, t, a, id, 'validacao', 'Validado');
      const item = await svc.find(t, id);
      expect(item.status).toBe('COMPLETED');
      expect(item.links).toHaveLength(1);
      expect(item.links[0].order.status).toBe('FECHADA');
      expect(await db.serviceOrder.count({ where: { processInstanceId: id } })).toBe(1);
    });
  });
  it('closes the OLT root, persists three branches, deduplicates concurrent commands and reopens without generating more orders', async () => {
    await scenario('CONFIGURAÇÃO OLT', async (svc, t, a, id, db) => {
      await advance(svc, t, a, id, 'triagem', 'Qualificado');
      await advance(svc, t, a, id, 'diagnostico', 'Executar correção');
      await advance(svc, t, a, id, 'aprovacao', 'Aprovado');
      await advance(svc, t, a, id, 'execucao', 'Executado');
      await advance(svc, t, a, id, 'validacao', 'Validado');
      let item = await svc.find(t, id);
      expect(item.links).toHaveLength(4);
      expect(item.links.find((l) => l.orderKey === 'root')!.order.status).toBe('FECHADA');
      expect(item.status).toBe('ACTIVE');
      const version = item.version;
      await advance(svc, t, a, id, 'backup', 'Concluído');
      item = await svc.find(t, id);
      expect(
        item.links.filter((l) => l.orderKey !== 'root' && l.order.status === 'FECHADA'),
      ).toHaveLength(1);
      await expect(
        svc.act(t, a, 'gerente', id, {
          action: 'pause',
          expectedVersion: version,
          reason: 'Repetição do evento',
        }),
      ).rejects.toThrow('Outra pessoa');
      expect(await db.serviceOrder.count({ where: { processInstanceId: id } })).toBe(4);
      await advance(svc, t, a, id, 'grafana', 'Concluído');
      await advance(svc, t, a, id, 'diagrama', 'Concluído');
      item = await svc.find(t, id);
      expect(item.status).toBe('COMPLETED');
      await svc.act(t, a, 'gerente', id, {
        action: 'reopen',
        expectedVersion: item.version,
        reason: 'Revisão gerencial solicitada',
      });
      expect(await db.serviceOrder.count({ where: { processInstanceId: id } })).toBe(4);
      item = await svc.find(t, id);
      expect(item.steps.filter((s) => s.status === 'ACTIVE')).toHaveLength(4);
    });
  });
  it('cancellation is distinct from success and drafts never rewrite running definitions', async () => {
    await scenario('DNS', async (svc, t, a, id) => {
      let item = await svc.find(t, id);
      const definition = item.definition as ReturnType<typeof makeOperationalDefinition>;
      await svc.save(t, a, {
        definition: { ...definition, name: 'Novo nome publicado' },
        expectedVersion: 1,
        publish: true,
      });
      expect((await svc.find(t, id)).definition).toEqual(item.definition);
      await svc.act(t, a, 'gerente', id, {
        action: 'cancel',
        expectedVersion: item.version,
        reason: 'Atendimento cancelado em teste',
      });
      item = await svc.find(t, id);
      expect(item.status).toBe('CANCELED');
      expect(item.links[0].order.status).toBe('CANCELADA');
      expect(item.steps.some((s) => s.status === 'ACTIVE')).toBe(false);
    });
  });
  it('rolls back a failed command, exposes durable failure, and resumes without duplicating work', async () => {
    await scenario('DNS', async (svc, t, a, id, db) => {
      const before = await svc.find(t, id);
      const step = before.steps.find((s) => s.status === 'ACTIVE')!;
      const definition = before.definition as ReturnType<typeof makeOperationalDefinition>;
      const node = definition.nodes.find((n) => n.id === step.nodeId)!;
      const pump = jest
        .spyOn(svc as any, 'pump')
        .mockRejectedValueOnce(new Error('Injected transient failure'));
      await expect(
        svc.act(t, a, 'gerente', id, {
          action: 'advance',
          expectedVersion: before.version,
          stepId: step.id,
          outcome: 'Qualificado',
          reason: 'Teste de recuperação',
          evidence: Object.fromEntries(node.requiredFields.map((k) => [k, 'Evidência de teste'])),
        }),
      ).rejects.toThrow('Injected');
      pump.mockRestore();
      const failed = await svc.find(t, id);
      expect(failed.status).toBe('FAILED');
      expect(failed.steps.find((s) => s.id === step.id)!.status).toBe('ACTIVE');
      await expect(
        svc.act(t, a, 'analista', id, {
          action: 'retry',
          expectedVersion: failed.version,
          reason: 'Retomar falha',
        }),
      ).rejects.toThrow('gestor');
      await svc.act(t, a, 'gerente', id, {
        action: 'retry',
        expectedVersion: failed.version,
        reason: 'Retomar após verificação',
      });
      const resumed = await svc.find(t, id);
      expect(resumed.status).toBe('ACTIVE');
      expect(
        resumed.steps.filter((s) => s.nodeId === 'diagnostico' && s.status === 'ACTIVE'),
      ).toHaveLength(1);
      expect(await db.serviceOrder.count({ where: { processInstanceId: id } })).toBe(1);
    });
  });
});
