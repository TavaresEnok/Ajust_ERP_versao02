import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { OperationalProcessesService } from '../apps/api/src/service-processes/operational-processes.service';
import {
  makeOperationalDefinition,
  OperationalDefinition,
} from '../apps/api/src/service-processes/operational-definition';
import { WorkflowsService } from '../apps/api/src/workflows/workflows.service';

const prisma = new PrismaService();
const service = new OperationalProcessesService(prisma, {
  executeForEvent: async () => {
    throw new Error('Demonstrações não enviam automações externas.');
  },
} as unknown as WorkflowsService);
async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const manager = await prisma.userTenant.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { code: 'gerente' }, user: { status: 'ACTIVE' } },
  });
  const result = [];
  for (const type of ['CONFIGURAÇÃO OLT', 'DNS']) {
    const definition = makeOperationalDefinition(type === 'DNS' ? 'VERIFICAÇÃO DE DNS' : type);
    const source = await prisma.serviceProcessInstance.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        engineVersion: 2,
        templateCode: definition.code,
        occurrence: { customer: { tradeName: 'MEGANET' } },
        status: 'HISTORICAL',
      },
    });
    const { id } = await service.demonstrate(tenant.id, manager.userId, source.id, source.version);
    if (type === 'CONFIGURAÇÃO OLT') {
      const outcomes: Record<string, string> = {
        triagem: 'Qualificado',
        diagnostico: 'Executar correção',
        aprovacao: 'Aprovado',
        execucao: 'Executado',
        validacao: 'Validado',
      };
      for (let i = 0; i < 10; i++) {
        const item = await service.find(tenant.id, id);
        const step = item.steps.find(
          (s) => s.status === 'ACTIVE' && s.orderId === item.rootOrderId,
        );
        if (!step) break;
        const node = (item.definition as unknown as OperationalDefinition).nodes.find(
          (n) => n.id === step.nodeId,
        )!;
        if (!outcomes[node.id]) throw new Error('Etapa não prevista na demonstração da OLT.');
        await service.act(tenant.id, manager.userId, 'gerente', id, {
          expectedVersion: item.version,
          action: 'advance',
          stepId: step.id,
          outcome: outcomes[node.id],
          reason: 'DEMONSTRAÇÃO: resultado simulado para apresentar a execução do fluxo.',
          evidence: Object.fromEntries(
            node.requiredFields.map((field) => [
              field,
              'DEMONSTRAÇÃO: evidência simulada; não representa atividade técnica executada no provedor.',
            ]),
          ),
        });
      }
      const item = await service.find(tenant.id, id);
      const step = item.steps.find((s) => s.nodeId === 'backup' && s.status === 'ACTIVE');
      if (step) {
        const node = (item.definition as unknown as OperationalDefinition).nodes.find(
          (n) => n.id === 'backup',
        )!;
        const input = {
          expectedVersion: item.version,
          action: 'advance' as const,
          stepId: step.id,
          outcome: 'Concluído',
          reason: 'DEMONSTRAÇÃO: backup simulado para exibir 1/3 de progresso.',
          evidence: Object.fromEntries(
            node.requiredFields.map((field) => [
              field,
              'DEMONSTRAÇÃO: registro simulado de backup validado.',
            ]),
          ),
        };
        const concurrent = await Promise.allSettled([
          service.act(tenant.id, manager.userId, 'gerente', id, input),
          service.act(tenant.id, manager.userId, 'gerente', id, input),
        ]);
        if (concurrent.filter((r) => r.status === 'fulfilled').length !== 1)
          throw new Error('Verificação de concorrência falhou.');
      }
      const final = await service.find(tenant.id, id);
      if (
        final.links.length !== 4 ||
        final.links.filter((l) => l.orderKey !== 'root' && l.order.status === 'FECHADA').length !==
          1
      )
        throw new Error('Estado da demonstração OLT divergente.');
      result.push({
        type,
        processId: id,
        path: `/gerencia/processos/${id}`,
        rootStatus: final.links.find((l) => l.orderKey === 'root')!.order.status,
        children: 3,
        completedChildren: 1,
      });
    } else {
      const item = await service.find(tenant.id, id);
      const step = item.steps.find((s) => s.nodeId === 'triagem' && s.status === 'ACTIVE');
      if (step) {
        const node = (item.definition as unknown as OperationalDefinition).nodes.find(
          (n) => n.id === 'triagem',
        )!;
        await service.act(tenant.id, manager.userId, 'gerente', id, {
          expectedVersion: item.version,
          action: 'advance',
          stepId: step.id,
          outcome: 'Qualificado',
          reason: 'DEMONSTRAÇÃO: DNS pronto para experimentar diagnóstico e decisões.',
          evidence: Object.fromEntries(
            node.requiredFields.map((field) => [field, 'DEMONSTRAÇÃO: escopo simulado.']),
          ),
        });
      }
      result.push({
        type,
        processId: id,
        path: `/gerencia/processos/${id}`,
        orders: (await service.find(tenant.id, id)).links.length,
      });
    }
  }
  const active = await prisma.serviceProcessInstance.findFirst({
    where: {
      tenantId: tenant.id,
      engineVersion: 2,
      status: 'HISTORICAL',
      rootOrderId: { not: null },
      occurrence: { customer: { tradeName: 'ULTRANET' } },
      links: {
        some: {
          order: { externalProtocol: 'ajustconsulting.sgp.net.br:os:11931', status: 'ABERTA' },
        },
      },
    },
  });
  if (active) await service.activateSource(tenant.id, manager.userId, active.id, active.version);
  console.log(
    JSON.stringify(
      { status: 'READY', demonstrations: result, liveUltranetActivated: !!active },
      null,
      2,
    ),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
