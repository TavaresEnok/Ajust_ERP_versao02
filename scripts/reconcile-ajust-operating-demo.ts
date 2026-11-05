require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
import { Prisma, ServiceOrderType } from '@prisma/client';
import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { ajustFlow } from '../apps/api/src/service-processes/ajust-default-flows';
import { SlaEngineService } from '../apps/api/src/sla/sla-engine.service';

const db = new PrismaService();
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const tenantId = tenant.id;
  const occurrences = await db.occurrence.findMany({
    where: { tenantId, number: { startsWith: 'DEMO-INC-120D-' } },
    include: { serviceOrders: { orderBy: { protocol: 'asc' } } },
    orderBy: { number: 'asc' },
  });
  if (
    occurrences.length !== 24 ||
    occurrences.reduce((n, o) => n + o.serviceOrders.length, 0) !== 60
  )
    throw new Error('A amostra mudou; revisar o escopo antes de executar.');
  if (!process.argv.includes('--execute')) {
    console.log(
      JSON.stringify({
        occurrences: 24,
        orders: 60,
        action: 'Revisar coerência da demonstração e configurar regras Ajust',
      }),
    );
    return;
  }
  if (!process.env.AJUST_OPERATIONS_BACKUP) throw new Error('Backup obrigatório.');
  await db.tenant.update({ where: { id: tenantId }, data: { timezone: 'America/Fortaleza' } });
  for (let d = 0; d < 7; d++)
    await db.businessCalendar.upsert({
      where: { tenantId_dayOfWeek: { tenantId, dayOfWeek: d } },
      create: {
        tenantId,
        dayOfWeek: d,
        isWorkDay: d > 0 && d < 6,
        startTime: '00:00',
        endTime: '24:00',
      },
      update: { isWorkDay: d > 0 && d < 6, startTime: '00:00', endTime: '24:00' },
    });
  if (!(await db.slaPolicy.findFirst({ where: { tenantId, serviceOrderType: 'DNS' } })))
    await db.slaPolicy.create({
      data: { tenantId, serviceOrderType: 'DNS', priority: 'NORMAL', hours: 48, isOverride: true },
    });
  for (const name of ['Atendimento', 'NOC', 'CGR', 'Monitoramento', 'Infra'])
    await db.tenantSector.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: { tenantId, name },
      update: {},
    });
  for (const code of ['AJUST_SIMPLES', 'AJUST_EQUIPAMENTO', 'AJUST_TOPOLOGIA', 'AJUST_MUDANCA']) {
    const definition = ajustFlow(code);
    await db.serviceProcessTemplate.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, version: 1, definition: json(definition), publishedAt: new Date() },
      update: { definition: json(definition), publishedAt: new Date() },
    });
  }
  const catalog: [string, ServiceOrderType, string][] = [
    ['Criação de DNS', 'DNS', 'AJUST_SIMPLES'],
    ['Autorização de ONU', 'CONFIGURACAO_ONU', 'AJUST_SIMPLES'],
    ['Configuração e ativação de equipamento', 'INFRAESTRUTURA', 'AJUST_EQUIPAMENTO'],
    ['Alteração de topologia de rede', 'INFRAESTRUTURA', 'AJUST_TOPOLOGIA'],
    ['Preparação e acompanhamento de manutenção noturna', 'INFRAESTRUTURA', 'AJUST_MUDANCA'],
    ['Configuração de Grafana e monitoramento', 'CONSULTORIA_GERAL', 'AJUST_SIMPLES'],
  ];
  for (const [name, category, workflowTemplateCode] of catalog) {
    const existing = await db.serviceCatalogItem.findFirst({ where: { tenantId, name } });
    const data = { name, category, workflowTemplateCode, description: name, active: true };
    if (existing) await db.serviceCatalogItem.update({ where: { id: existing.id }, data });
    else await db.serviceCatalogItem.create({ data: { tenantId, ...data } });
  }
  const themes: { title: string; type: ServiceOrderType; tasks: string[] }[] = [
    {
      title: 'Diagnóstico da resolução DNS',
      type: 'DNS',
      tasks: [
        'Validar recursão e cache',
        'Conferir registros autoritativos',
        'Analisar latência de resolução',
        'Revisar alertas do DNS',
      ],
    },
    {
      title: 'Revisão de disponibilidade Proxmox',
      type: 'PROXMOX',
      tasks: [
        'Analisar quorum do cluster',
        'Verificar armazenamento e replicação',
        'Validar backups das máquinas virtuais',
        'Revisar alertas de disponibilidade',
      ],
    },
    {
      title: 'Revisão das sessões BGP',
      type: 'BGP',
      tasks: [
        'Conferir filtros de prefixos',
        'Revisar validação RPKI',
        'Analisar anúncios IPv6',
        'Verificar redundância de trânsito',
      ],
    },
    {
      title: 'Diagnóstico de provisionamento ONU',
      type: 'CONFIGURACAO_ONU',
      tasks: [
        'Conferir perfis de provisionamento',
        'Validar cadastro dos números de série',
        'Analisar autenticação das ONUs',
        'Revisar alarmes ópticos',
      ],
    },
  ];
  const sla = new SlaEngineService(db);
  for (const [index, occurrence] of occurrences.entries()) {
    const theme = themes[index % themes.length];
    await db.$transaction(
      async (tx) => {
        await tx.occurrence.update({
          where: { id: occurrence.id },
          data: {
            type: theme.title,
            description: `DEMONSTRAÇÃO · ${theme.title} em ${occurrence.provider}. Cada O.S. verifica uma parte desta mesma demanda. Dados de trabalho simulados para avaliação do ERP.`,
          },
        });
        await tx.occurrenceAnnotation.updateMany({
          where: { occurrenceId: occurrence.id },
          data: {
            message: `DEMONSTRAÇÃO · Acompanhamento de ${theme.title.toLowerCase()}. Os resultados detalhados estão nas O.S. vinculadas.`,
          },
        });
        for (const [i, order] of occurrence.serviceOrders.entries()) {
          const task = theme.tasks[i];
          const finished = order.status === 'FECHADA';
          const deadline = await sla.calculateTargetDate(order.createdAt, 48, tenantId);
          let processId = order.processInstanceId;
          if (!processId) {
            const definition = ajustFlow('AJUST_SIMPLES');
            definition.nodes[0].name = task;
            definition.nodes[0].serviceType = theme.type;
            const instance = await tx.serviceProcessInstance.create({
              data: {
                tenantId,
                occurrenceId: occurrence.id,
                rootOrderId: order.id,
                engineVersion: 2,
                templateCode: definition.code,
                templateVersion: 1,
                definition: json(definition),
                state: { mode: 'DEMO', scenario: 'ajust-operating-review' },
                status: finished ? 'COMPLETED' : 'ACTIVE',
                createdAt: order.createdAt,
                completedAt: finished ? order.closedAt : null,
              },
            });
            processId = instance.id;
            await tx.serviceProcessOrderLink.create({
              data: { instanceId: processId, orderKey: 'root', orderId: order.id },
            });
            await tx.serviceProcessStep.create({
              data: {
                tenantId,
                instanceId: processId,
                nodeId: 'executar',
                orderId: order.id,
                status: finished ? 'COMPLETED' : 'ACTIVE',
                enteredAt: order.createdAt,
                dueAt: deadline,
                completedAt: finished ? order.closedAt : null,
                outcome: finished ? 'Concluído' : null,
                evidence: finished
                  ? { 'Resultado técnico': `DEMONSTRAÇÃO · ${task} concluído.` }
                  : {},
              },
            });
            if (finished)
              await tx.serviceProcessStep.create({
                data: {
                  tenantId,
                  instanceId: processId,
                  nodeId: 'fim',
                  status: 'COMPLETED',
                  enteredAt: order.closedAt!,
                  completedAt: order.closedAt,
                },
              });
          }
          await tx.serviceOrder.update({
            where: { id: order.id },
            data: {
              type: theme.type,
              title: `DEMO · ${task}`,
              description: `DEMONSTRAÇÃO · ${task}. Objetivo do atendimento: ${theme.title}. Registrar diagnóstico, verificações e resultado.`,
              processInstanceId: processId,
              processNodeId: 'executar',
              deadlineAt: deadline,
              originalDeadlineAt: deadline,
              slaEligible: true,
              sourceMetadata: {
                demonstration: true,
                scenarioId: 'provider-volume-120d-v1',
                slaBasis:
                  theme.type === 'DNS'
                    ? 'Prazo DNS confirmado: 48h úteis'
                    : 'Prazo de demonstração: 48h úteis; validar política com a gestão',
              },
            },
          });
          const notes = await tx.serviceOrderOccurrence.findMany({
            where: { serviceOrderId: order.id },
            orderBy: { createdAt: 'asc' },
          });
          for (const [n, note] of notes.entries())
            await tx.serviceOrderOccurrence.update({
              where: { id: note.id },
              data: {
                message: `DEMONSTRAÇÃO · ${n === notes.length - 1 && finished ? 'Resultado registrado' : 'Análise em acompanhamento'}: ${task}. Atendimento de ${theme.title.toLowerCase()}.`,
              },
            });
          await tx.timeEntry.updateMany({
            where: { orderId: order.id },
            data: { description: `DEMONSTRAÇÃO · Trabalho em ${task.toLowerCase()}.` },
          });
          await tx.serviceOrderStatusEvent.updateMany({
            where: { serviceOrderId: order.id },
            data: { reason: `DEMONSTRAÇÃO · Evolução do trabalho: ${task}.` },
          });
          await tx.calendarEvent.updateMany({
            where: { tenantId, serviceOrderId: order.id },
            data: { title: `Execução · ${order.protocol}`, description: `DEMONSTRAÇÃO · ${task}` },
          });
          await tx.slaEvent.updateMany({
            where: { serviceOrderId: order.id },
            data: {
              deadlineAt: deadline,
              breachedAt: order.closedAt && order.closedAt > deadline ? order.closedAt : null,
              delayMinutes: order.closedAt
                ? Math.max(0, Math.round((order.closedAt.getTime() - deadline.getTime()) / 60000))
                : 0,
            },
          });
        }
      },
      { timeout: 60000 },
    );
  }
  // Simplify the three explicitly synthetic pilot executions, preserving their order IDs and states.
  const pilots = await db.serviceProcessInstance.findMany({
    where: { tenantId, templateCode: { startsWith: 'ATEND_' }, rootOrderId: { not: null } },
    include: { links: { include: { order: true } } },
  });
  for (const pilot of pilots) {
    if ((pilot.state as Record<string, unknown>).mode !== 'DEMO') continue;
    const multi = pilot.links.length > 1;
    const root = pilot.links.find((l) => l.orderId === pilot.rootOrderId)!.order;
    const code = multi
      ? 'AJUST_EQUIPAMENTO'
      : root.type === 'BGP'
        ? 'AJUST_MUDANCA'
        : 'AJUST_SIMPLES';
    const definition = ajustFlow(code);
    await db.$transaction(async (tx) => {
      await tx.serviceProcessStep.deleteMany({ where: { instanceId: pilot.id } });
      await tx.serviceProcessInstance.update({
        where: { id: pilot.id },
        data: {
          templateCode: code,
          templateVersion: 1,
          definition: json(definition),
          version: { increment: 1 },
        },
      });
      for (const link of pilot.links) {
        const nodeId =
          link.orderId === pilot.rootOrderId
            ? code === 'AJUST_MUDANCA'
              ? 'preparar'
              : 'executar'
            : link.order.processNodeId === 'grafana'
              ? 'monitoramento'
              : link.order.processNodeId!;
        const finished = link.order.status === 'FECHADA';
        await tx.serviceProcessOrderLink.update({
          where: { id: link.id },
          data: { orderKey: link.orderId === pilot.rootOrderId ? 'root' : nodeId },
        });
        await tx.serviceOrder.update({
          where: { id: link.orderId },
          data: { processNodeId: nodeId, slaEligible: true },
        });
        await tx.serviceProcessStep.create({
          data: {
            tenantId,
            instanceId: pilot.id,
            nodeId,
            orderId: link.orderId,
            status: finished ? 'COMPLETED' : 'ACTIVE',
            enteredAt: link.order.createdAt,
            dueAt: link.order.deadlineAt,
            completedAt: finished ? link.order.closedAt : null,
            evidence: finished ? { 'Resultado técnico': 'DEMONSTRAÇÃO · Entrega concluída.' } : {},
          },
        });
      }
      if (multi)
        await tx.serviceProcessStep.create({
          data: {
            tenantId,
            instanceId: pilot.id,
            nodeId: 'distribuir',
            status: 'COMPLETED',
            enteredAt: root.closedAt!,
            completedAt: root.closedAt,
          },
        });
    });
  }
  console.log(
    JSON.stringify({
      revisedOccurrences: occurrences.length,
      revisedOrders: 60,
      publishedFlows: 4,
      dnsSlaHours: 48,
    }),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
