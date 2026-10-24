import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceProcessesService } from './service-processes.service';
import { randomUUID } from 'node:crypto';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Human process execution (real database, rollback after each scenario)', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  async function scenario(
    run: (
      svc: ServiceProcessesService,
      tenantId: string,
      actorId: string,
      occurrenceId: string,
    ) => Promise<void>,
  ) {
    const marker = new Error('ROLLBACK_TEST');
    try {
      await prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findFirstOrThrow({ where: { status: 'ACTIVE' } });
          const actor = await tx.user.findFirstOrThrow();
          const occurrence = await tx.occurrence.create({
            data: {
              tenantId: tenant.id,
              number: `TEST-${randomUUID()}`,
              provider: 'Teste transacional',
              type: 'TEST',
              sector: 'NOC',
              origin: 'TEST',
              openedByName: 'Teste',
              analystResponsible: 'Teste',
              description: 'Teste não persistido',
            },
          });
          const service = new ServiceProcessesService({
            ...tx,
            $transaction: async (cb: (t: typeof tx) => unknown) => {
              await tx.$executeRawUnsafe('SAVEPOINT process_test_call');
              try {
                const result = await cb(tx);
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT process_test_call');
                return result;
              } catch (error) {
                await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT process_test_call');
                await tx.$executeRawUnsafe('RELEASE SAVEPOINT process_test_call');
                throw error;
              }
            },
          } as unknown as PrismaService);
          await run(service, tenant.id, actor.id, occurrence.id);
          throw marker;
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (error !== marker) throw error;
    }
  }

  it('persists transitions, enforces evidence, prevents replay and tenant crossing', async () => {
    await scenario(async (svc, tenant, actor, occurrence) => {
      const { id } = await svc.start(tenant, actor, 'gerente', {
        occurrenceId: occurrence,
        templateCode: 'MEGANET_ZABBIX',
      });
      let item = await svc.find(tenant, id);
      expect(item.orders).toHaveLength(1);
      await expect(svc.find(randomUUID(), id)).rejects.toThrow('não encontrado');
      const input = {
        expectedVersion: item.version,
        action: 'advance' as const,
        outcome: 'Qualificado',
        reason: 'Teste de conclusão',
      };
      await expect(svc.act(tenant, actor, 'analista', id, input)).rejects.toThrow('evidência');
      item = await svc.find(tenant, id);
      expect(item.version).toBe(1);
      await svc.act(tenant, actor, 'analista', id, {
        ...input,
        evidence: { Impacto: 'Teste', 'Ativo afetado': 'Teste', 'Resultado esperado': 'Teste' },
      });
      item = await svc.find(tenant, id);
      expect(item.version).toBe(2);
      expect(item.orders).toHaveLength(2);
      await expect(svc.act(tenant, actor, 'analista', id, input)).rejects.toThrow('Outra pessoa');
      const state = item.state as { current: { nodeId: string } };
      expect(state.current.nodeId).toBe('diagnostico');
      svc.assertRole('analista');
      expect(() => svc.assertRole('cliente')).toThrow();
    });
  });

  it('blocks unauthorized approval, supports rework, pause/resume and guarded cancel/reopen', async () => {
    await scenario(async (svc, tenant, actor, occurrence) => {
      const { id } = await svc.start(tenant, actor, 'gerente', {
        occurrenceId: occurrence,
        templateCode: 'MEGANET_BGP',
      });
      async function act(
        action: 'advance' | 'pause' | 'resume' | 'cancel' | 'reopen',
        outcome?: string,
        role = 'gerente',
      ) {
        const item = await svc.find(tenant, id);
        const def = item.definition as unknown as {
          nodes: { id: string; requiredFields: string[] }[];
        };
        const state = item.state as { current?: { nodeId: string } };
        const fields = def.nodes.find((n) => n.id === state.current?.nodeId)?.requiredFields || [];
        return svc.act(tenant, actor, role, id, {
          expectedVersion: item.version,
          action,
          outcome,
          reason: 'Justificativa de teste',
          evidence: Object.fromEntries(fields.map((f) => [f, 'Evidência de teste'])),
        });
      }
      await act('advance', 'Qualificado');
      await act('advance', 'Planejado');
      await expect(act('advance', 'Aprovado', 'analista')).rejects.toThrow('perfil responsável');
      await act('advance', 'Revisão necessária');
      await act('pause');
      await expect(act('advance', 'Planejado')).rejects.toThrow('etapa ativa');
      await act('resume');
      await expect(act('cancel', undefined, 'analista')).rejects.toThrow('sem permissão');
      await act('cancel');
      await act('reopen');
      const item = await svc.find(tenant, id);
      expect(item.status).toBe('ACTIVE');
      expect((item.state as { current: { attempt: number } }).current.attempt).toBe(2);
    });
  });

  it('keeps running snapshots immutable when a template is revised', async () => {
    await scenario(async (svc, tenant, actor, occurrence) => {
      const { id } = await svc.start(tenant, actor, 'gerente', {
        occurrenceId: occurrence,
        templateCode: 'MEGANET_MIGRACAO',
      });
      const def = (await svc.templates(tenant)).find((d) => d.code === 'MEGANET_MIGRACAO')!;
      const original = def.nodes[0].name;
      def.nodes[0].name = 'Nova triagem';
      await svc.saveTemplate(tenant, actor, 'gerente', def, def.version);
      const instance = await svc.find(tenant, id);
      expect((instance.definition as unknown as { nodes: { name: string }[] }).nodes[0].name).toBe(
        original,
      );
    });
  });

  it.each(['MEGANET_ZABBIX', 'MEGANET_BGP', 'MEGANET_MIGRACAO'])(
    'completes %s through required stages and closes its occurrence',
    async (code) => {
      await scenario(async (svc, tenant, actor, occurrence) => {
        const { id } = await svc.start(tenant, actor, 'gerente', {
          occurrenceId: occurrence,
          templateCode: code,
        });
        for (let step = 0; step < 20; step++) {
          const item = await svc.find(tenant, id);
          if (item.status === 'COMPLETED') {
            expect(item.occurrence.status).toBe('ENCERRADA');
            expect(item.orders.every((order) => order.status === 'FECHADA')).toBe(true);
            expect(item.orders.every((order) => !order.slaEligible)).toBe(true);
            return;
          }
          const state = item.state as { current: { nodeId: string } };
          const def = item.definition as unknown as {
            nodes: { id: string; requiredFields: string[]; routes: Record<string, string> }[];
          };
          const node = def.nodes.find((n) => n.id === state.current.nodeId)!;
          await svc.act(tenant, actor, 'gerente', id, {
            expectedVersion: item.version,
            action: 'advance',
            outcome: ['Qualificado', 'Planejado', 'Preparado', 'Aprovado', 'Autorizado', 'Janela iniciada', 'Executado', 'Validado', 'Documentado', 'Comunicado', 'Ajuste local'].find(outcome => Object.prototype.hasOwnProperty.call(node.routes, outcome)),
            reason: 'Caminho principal em teste transacional',
            evidence: Object.fromEntries(
              node.requiredFields.map((f) => [f, 'Evidência validada no teste']),
            ),
          });
        }
        throw new Error('O caminho principal não terminou');
      });
    },
  );
});
