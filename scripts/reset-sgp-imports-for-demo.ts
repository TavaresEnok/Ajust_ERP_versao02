/**
 * One-time, destructive reset of the pre-production SGP import in the Ajust ERP,
 * followed by clean, native demonstration records. Requires --execute and an
 * externally verified database + uploads backup.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { OperationalProcessesService } from '../apps/api/src/service-processes/operational-processes.service';
import {
  makeOperationalDefinition,
  type OperationalDefinition,
} from '../apps/api/src/service-processes/operational-definition';
import type { WorkflowsService } from '../apps/api/src/workflows/workflows.service';

const prisma = new PrismaClient();
const tenantSlug = 'ajust-demo';
const demoPrefix = `DEMO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
const backupProof = process.env.AJUST_SGP_PURGE_BACKUP_VERIFIED;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sourceIsSgp(value: unknown) {
  return object(value).sourceSystem === 'SGP';
}

function sourceOrder(value: unknown) {
  const sourceOrderId = object(value).sourceOrderId;
  return typeof sourceOrderId === 'string' ? sourceOrderId : undefined;
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function backupIsVerified() {
  return Boolean(backupProof && backupProof.startsWith('pg_dump+uploads:'));
}

async function cleanImportedData(tenantId: string) {
  const deletedStorageKeys: string[] = [];

  const cleanup = await prisma.$transaction(
    async (tx) => {
      const allOrders = await tx.serviceOrder.findMany({
        where: { tenantId },
        select: {
          id: true,
          sourceSystem: true,
          sourceMetadata: true,
          externalProtocol: true,
          protocol: true,
          occurrenceId: true,
          processInstanceId: true,
          parentOrderId: true,
          rootOrderId: true,
        },
      });
      const allOccurrences = await tx.occurrence.findMany({
        where: { tenantId },
        select: { id: true, sourceSystem: true, sourceMetadata: true, externalId: true },
      });
      const allProcesses = await tx.serviceProcessInstance.findMany({
        where: { tenantId },
        select: { id: true, occurrenceId: true, rootOrderId: true, state: true },
      });
      const importLinks = await tx.externalImportLink.findMany({
        where: { tenantId },
        select: { id: true, kind: true, localId: true },
      });
      const importedCatalog = await tx.serviceCatalogItem.findMany({
        where: { tenantId, description: { contains: 'SGP', mode: 'insensitive' } },
        select: { id: true },
      });
      const importedTemplates = await tx.serviceProcessTemplate.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const orderIds = new Set(
        allOrders
          .filter(
            (order) =>
              order.sourceSystem === 'SGP' ||
              order.protocol.startsWith('SGP-') ||
              Boolean(order.externalProtocol?.includes('sgp.net.br:os:')) ||
              sourceIsSgp(order.sourceMetadata),
          )
          .map((order) => order.id),
      );
      const occurrenceIds = new Set(
        allOccurrences
          .filter(
            (occurrence) =>
              occurrence.sourceSystem === 'SGP' ||
              (object(occurrence.sourceMetadata).demonstration === true &&
                orderIds.has(sourceOrder(occurrence.sourceMetadata) || '')),
          )
          .map((occurrence) => occurrence.id),
      );
      const processIds = new Set<string>();

      let changed = true;
      while (changed) {
        const before = orderIds.size + occurrenceIds.size + processIds.size;
        for (const occurrence of allOccurrences) {
          if (occurrence.sourceSystem === 'SGP') occurrenceIds.add(occurrence.id);
        }
        for (const process of allProcesses) {
          const state = object(process.state);
          if (
            occurrenceIds.has(process.occurrenceId) ||
            Boolean(process.rootOrderId && orderIds.has(process.rootOrderId)) ||
            (typeof state.sourceInstanceId === 'string' && processIds.has(state.sourceInstanceId))
          ) {
            processIds.add(process.id);
            occurrenceIds.add(process.occurrenceId);
            if (process.rootOrderId) orderIds.add(process.rootOrderId);
          }
        }
        for (const order of allOrders) {
          if (
            occurrenceIds.has(order.occurrenceId || '') ||
            processIds.has(order.processInstanceId || '') ||
            orderIds.has(order.parentOrderId || '') ||
            orderIds.has(order.rootOrderId || '') ||
            (object(order.sourceMetadata).demonstration === true &&
              orderIds.has(sourceOrder(order.sourceMetadata) || ''))
          ) {
            orderIds.add(order.id);
          }
        }
        changed = before !== orderIds.size + occurrenceIds.size + processIds.size;
      }

      const processList = [...processIds];
      const orderList = [...orderIds];
      const occurrenceList = [...occurrenceIds];
      const catalogIds = importedCatalog.map((row) => row.id);
      const templateIds = importedTemplates.map((row) => row.id);
      const attachments = await tx.serviceOrderAttachment.findMany({
        where: { serviceOrderId: { in: orderList } },
        select: { storageKey: true },
      });
      deletedStorageKeys.push(...attachments.map((file) => file.storageKey));

      for (const report of await tx.shiftReport.findMany({
        where: { tenantId },
        select: { id: true, orderIds: true },
      })) {
        const current = Array.isArray(report.orderIds) ? report.orderIds : [];
        const remaining = current.filter(
          (id): id is string => typeof id === 'string' && !orderIds.has(id),
        );
        if (remaining.length !== current.length)
          await tx.shiftReport.update({ where: { id: report.id }, data: { orderIds: remaining } });
      }

      await tx.auditLog.deleteMany({
        where: {
          tenantId,
          OR: [
            {
              resourceId: {
                in: [
                  ...orderList,
                  ...occurrenceList,
                  ...processList,
                  ...catalogIds,
                  ...templateIds,
                ],
              },
            },
            {
              resourceType: {
                in: [
                  'sgp_pilot_import',
                  'sgp_real_enrichment',
                  'sgp_registry_import',
                  'sgp_sample_import',
                ],
              },
            },
          ],
        },
      });

      const calendarIds = importLinks
        .filter((row) => row.kind === 'CALENDAR')
        .map((row) => row.localId);
      await tx.calendarEvent.deleteMany({
        where: {
          tenantId,
          OR: [
            ...(calendarIds.length ? [{ id: { in: calendarIds } }] : []),
            ...(orderList.length ? [{ serviceOrderId: { in: orderList } }] : []),
            ...(occurrenceList.length ? [{ occurrenceId: { in: occurrenceList } }] : []),
          ],
        },
      });

      // Clear restrictive relations first; process steps/links and OS details then cascade.
      if (orderList.length)
        await tx.serviceOrder.updateMany({
          where: {
            OR: [
              { id: { in: orderList } },
              { parentOrderId: { in: orderList } },
              { rootOrderId: { in: orderList } },
              { processInstanceId: { in: processList } },
            ],
          },
          data: {
            processInstanceId: null,
            processNodeId: null,
            parentOrderId: null,
            rootOrderId: null,
          },
        });
      if (processList.length)
        await tx.serviceProcessInstance.deleteMany({ where: { id: { in: processList } } });
      if (orderList.length) await tx.serviceOrder.deleteMany({ where: { id: { in: orderList } } });
      if (occurrenceList.length)
        await tx.occurrence.deleteMany({ where: { id: { in: occurrenceList } } });

      const credentials = await tx.knowledgeCredential.deleteMany({
        where: { tenantId, sourceSystem: 'SGP' },
      });
      await tx.syncEvent.deleteMany({ where: { tenantId, source: 'SGP' } });
      await tx.externalImportLink.deleteMany({ where: { tenantId } });
      await tx.serviceCatalogItem.deleteMany({ where: { id: { in: catalogIds } } });
      await tx.serviceProcessTemplate.deleteMany({ where: { id: { in: templateIds } } });

      const sourceUsers = await tx.user.findMany({
        where: { sourceSystem: 'SGP' },
        select: { id: true, name: true },
      });
      for (const user of sourceUsers) {
        const slug = user.name
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.|\.$/g, '');
        const email =
          user.name === 'Anderson Alves'
            ? 'anderson.alves@ajust.invalid'
            : `analista.${slug}.${user.id.slice(0, 8)}@acesso.ajust.invalid`;
        await tx.user.update({
          where: { id: user.id },
          data: { email, sourceSystem: 'ERP', externalId: null, sourceMetadata: {} },
        });
      }
      const customers = await tx.customer.updateMany({
        where: { tenantId, sourceSystem: 'SGP' },
        data: { sourceSystem: 'ERP', externalId: null, sourceMetadata: {} },
      });

      return {
        orders: orderList.length,
        occurrences: occurrenceList.length,
        processes: processList.length,
        credentials: credentials.count,
        calendarEvents: calendarIds.length,
        catalogItems: catalogIds.length,
        workflowTemplates: templateIds.length,
        importLinks: importLinks.length,
        analystsAndUsersNormalized: sourceUsers.length,
        providersNormalized: customers.count,
      };
    },
    { timeout: 120000 },
  );

  const uploadsRoot = resolve(process.cwd(), 'uploads');
  const deletedFiles: string[] = [];
  const missingFiles: string[] = [];
  for (const storageKey of deletedStorageKeys) {
    const prefix = '/tmp/ajust_uploads/';
    if (!storageKey.startsWith(prefix))
      throw new Error(`Anexo fora da raiz de uploads; remoção interrompida: ${storageKey}`);
    const target = resolve(uploadsRoot, storageKey.slice(prefix.length));
    if (!target.startsWith(`${uploadsRoot}${sep}`))
      throw new Error(`Caminho de anexo inválido; remoção interrompida: ${storageKey}`);
    if (existsSync(target)) {
      unlinkSync(target);
      deletedFiles.push(storageKey);
    } else missingFiles.push(storageKey);
  }

  return {
    ...cleanup,
    attachmentsDeleted: deletedFiles.length,
    attachmentFilesAlreadyMissing: missingFiles.length,
  };
}

async function makeDemoDefinition(sourceType: string, analystId: string, managerId: string) {
  const definition = makeOperationalDefinition(sourceType);
  definition.name = `DEMONSTRAÇÃO · ${sourceType}`;
  definition.description =
    'Modelo independente para apresentação. Os dados, responsáveis e evidências desta demonstração não representam execução real.';
  definition.sourceTypes = [];
  for (const node of definition.nodes) {
    if (node.sector === 'MONITORAMENTO') node.sector = 'Monitoramento';
    if (node.sector === 'DOCUMENTACAO' || node.sector === 'BACKUP') node.sector = 'CGR';
    if (node.sector === 'GESTAO') node.sector = 'CGR';
    if (node.kind === 'task')
      node.assigneeUserId = node.roles.includes('analista') ? analystId : managerId;
  }
  return definition;
}

async function moveTo(
  service: OperationalProcessesService,
  tenantId: string,
  actorId: string,
  instanceId: string,
  nodeId: string,
  outcome: string,
) {
  const item = await service.find(tenantId, instanceId);
  const step = item.steps.find(
    (candidate) => candidate.nodeId === nodeId && candidate.status === 'ACTIVE',
  );
  const definition = item.definition as OperationalDefinition;
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!step || !node) throw new Error(`Etapa demonstrativa não encontrada: ${nodeId}`);
  await service.act(tenantId, actorId, 'gerente', instanceId, {
    expectedVersion: item.version,
    action: 'advance',
    stepId: step.id,
    outcome,
    reason:
      'DEMONSTRAÇÃO: avanço simulado para apresentação do Ajust ERP; não representa trabalho executado.',
    evidence: Object.fromEntries(
      node.requiredFields.map((field) => [
        field,
        `DEMONSTRAÇÃO: evidência ilustrativa — ${field}.`,
      ]),
    ),
  });
}

async function createDemo(
  service: OperationalProcessesService,
  tenantId: string,
  managerId: string,
  analyst: { id: string; name: string },
  customer: { id: string; tradeName: string },
  sourceType: string,
  key: string,
  orderDescription: string,
) {
  const definition = await makeDemoDefinition(sourceType, analyst.id, managerId);
  const code = definition.code;
  const template = await prisma.serviceProcessTemplate.create({
    data: {
      tenantId,
      code,
      version: 1,
      definition: asJson(definition),
      draft: Prisma.DbNull,
      publishedAt: new Date(),
    },
  });
  const protocol = `${demoPrefix}-${key}-001`;
  const description = `DEMONSTRAÇÃO — ${orderDescription} Este registro é fictício, foi criado apenas para apresentação e não representa uma solicitação real do provedor.`;
  const occurrence = await prisma.occurrence.create({
    data: {
      tenantId,
      customerId: customer.id,
      number: `${demoPrefix}-${key}`,
      provider: customer.tradeName,
      type: sourceType,
      status: 'ABERTA',
      sector: 'NOC',
      origin: 'DEMONSTRACAO',
      openedByName: 'Demonstração Ajust',
      analystResponsible: analyst.name,
      description,
      sourceSystem: 'ERP',
      sourceMetadata: { demonstration: true },
    },
  });
  const order = await prisma.serviceOrder.create({
    data: {
      tenantId,
      occurrenceId: occurrence.id,
      protocol,
      sourceSystem: 'ERP',
      sourceMetadata: { demonstration: true },
      type: definition.nodes.find((node) => node.id === 'triagem')!.serviceType,
      priority: 'NORMAL',
      status: 'ABERTA',
      title: `DEMONSTRAÇÃO · ${sourceType}`,
      description,
      ownerUserId: managerId,
      ownerName: 'Demonstração Ajust',
      assigneeUserId: analyst.id,
      analystName: analyst.name,
      requester: customer.tradeName,
      sector: 'NOC',
      origin: 'DEMONSTRACAO',
      deadlineAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      slaEligible: false,
      isCustomerVisible: false,
      tags: ['demonstracao'],
      internalNotes:
        'Dados inteiramente ilustrativos. Não usar como evidência de trabalho real ou SLA contratual.',
    },
  });
  const { id } = await service.start(tenantId, managerId, order.id, template.code);
  await prisma.serviceProcessInstance.update({
    where: { id },
    data: { state: { mode: 'DEMO', demonstrationOnly: true } },
  });
  return { id, orderId: order.id, protocol, customer: customer.tradeName, type: sourceType };
}

async function seedDemonstrations(tenantId: string) {
  const [managerMember, analystMember, customers] = await Promise.all([
    prisma.userTenant.findFirstOrThrow({
      where: {
        tenantId,
        role: { code: 'gerente' },
        user: { status: 'ACTIVE', name: 'Ajust Gerente' },
      },
      include: { user: true },
    }),
    prisma.userTenant.findFirstOrThrow({
      where: {
        tenantId,
        role: { code: 'analista' },
        user: { status: 'ACTIVE', name: 'Anderson Alves' },
      },
      include: { user: true },
    }),
    prisma.customer.findMany({ where: { tenantId, deletedAt: null } }),
  ]);
  const customerByTrade = new Map(
    customers.map((customer) => [customer.tradeName.toUpperCase(), customer]),
  );
  const managerId = managerMember.userId;
  const analyst = { id: analystMember.userId, name: analystMember.user.name };
  const service = new OperationalProcessesService(
    prisma as never,
    { executeForEvent: async () => undefined } as unknown as WorkflowsService,
  );

  const catalog = [
    { name: 'DEMONSTRAÇÃO · Verificação de DNS', category: 'DNS' as const },
    { name: 'DEMONSTRAÇÃO · Configuração OLT', category: 'INFRAESTRUTURA' as const },
    { name: 'DEMONSTRAÇÃO · Mudança BGP / Trânsito', category: 'BGP' as const },
  ];
  for (const item of catalog) {
    await prisma.serviceCatalogItem.create({
      data: {
        tenantId,
        name: item.name,
        category: item.category,
        description: 'Tipo de serviço criado para cenários demonstrativos no Ajust ERP.',
        estimatedMinutes: 120,
        defaultPriority: 'NORMAL',
        checklist: [],
        active: true,
      },
    });
  }

  const created = [];
  const dns = await createDemo(
    service,
    tenantId,
    managerId,
    analyst,
    customerByTrade.get('MEGANET')!,
    'VERIFICAÇÃO DE DNS',
    'DNS',
    'Verificação de resolução DNS, disponibilidade e latência.',
  );
  await moveTo(service, tenantId, managerId, dns.id, 'triagem', 'Qualificado');
  created.push(dns);

  const bgp = await createDemo(
    service,
    tenantId,
    managerId,
    analyst,
    customerByTrade.get('INFOTEL')!,
    'MUDANÇA BGP / TRÂNSITO',
    'BGP',
    'Avaliação de mudança de trânsito BGP aguardando aprovação de plano e reversão.',
  );
  await moveTo(service, tenantId, managerId, bgp.id, 'triagem', 'Qualificado');
  await moveTo(service, tenantId, managerId, bgp.id, 'diagnostico', 'Executar correção');
  created.push(bgp);

  const olt = await createDemo(
    service,
    tenantId,
    managerId,
    analyst,
    customerByTrade.get('G5 JABOATÃO')!,
    'CONFIGURAÇÃO OLT',
    'OLT',
    'Configuração coordenada de OLT com monitoramento, documentação e backup em paralelo.',
  );
  for (const [node, outcome] of [
    ['triagem', 'Qualificado'],
    ['diagnostico', 'Executar correção'],
    ['aprovacao', 'Aprovado'],
    ['execucao', 'Executado'],
    ['validacao', 'Validado'],
  ])
    await moveTo(service, tenantId, managerId, olt.id, node, outcome);
  let current = await service.find(tenantId, olt.id);
  const backupStep = current.steps.find(
    (step) => step.nodeId === 'backup' && step.status === 'ACTIVE',
  );
  if (!backupStep) throw new Error('Etapa de backup da demonstração OLT não foi aberta.');
  const backupNode = (current.definition as OperationalDefinition).nodes.find(
    (node) => node.id === 'backup',
  )!;
  await service.act(tenantId, managerId, 'gerente', olt.id, {
    expectedVersion: current.version,
    action: 'advance',
    stepId: backupStep.id,
    outcome: 'Concluído',
    reason: 'DEMONSTRAÇÃO: tarefa de backup concluída para ilustrar 1 de 3 O.S. derivadas.',
    evidence: Object.fromEntries(
      backupNode.requiredFields.map((field) => [field, 'DEMONSTRAÇÃO: resultado simulado.']),
    ),
  });
  current = await service.find(tenantId, olt.id);
  const children = current.links.filter((link) => link.orderKey !== 'root');
  for (const child of children) {
    await prisma.serviceOrder.update({
      where: { id: child.orderId },
      data: { assigneeUserId: analyst.id, analystName: analyst.name },
    });
  }
  created.push(olt);
  service.onModuleDestroy();
  return created.map((item) => ({
    ...item,
    route: `/gerencia/processos/${item.id}`,
  }));
}

async function main() {
  if (!process.argv.includes('--execute'))
    throw new Error('Operação destrutiva bloqueada. Informe --execute após verificar os backups.');
  if (!backupIsVerified())
    throw new Error('Informe AJUST_SGP_PURGE_BACKUP_VERIFIED=pg_dump+uploads:<backup-validado>.');

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });
  const before = {
    orders: await prisma.serviceOrder.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    occurrences: await prisma.occurrence.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    credentials: await prisma.knowledgeCredential.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
  };
  const remainingDemos = await prisma.serviceOrder.count({
    where: { tenantId: tenant.id, protocol: { startsWith: demoPrefix } },
  });
  if (remainingDemos)
    throw new Error('Já existem dados demonstrativos desta data; parei para evitar duplicação.');

  const cleanup = await cleanImportedData(tenant.id);
  const demos = await seedDemonstrations(tenant.id);
  const after = {
    importedOrders: await prisma.serviceOrder.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    importedOccurrences: await prisma.occurrence.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    importedCredentials: await prisma.knowledgeCredential.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    usersFromSgp: await prisma.user.count({ where: { sourceSystem: 'SGP' } }),
    customersFromSgp: await prisma.customer.count({
      where: { tenantId: tenant.id, sourceSystem: 'SGP' },
    }),
    activeDemoProcesses: await prisma.serviceProcessInstance.count({
      where: { tenantId: tenant.id, engineVersion: 2, state: { path: ['mode'], equals: 'DEMO' } },
    }),
  };
  if (
    after.importedOrders ||
    after.importedOccurrences ||
    after.importedCredentials ||
    after.usersFromSgp ||
    after.customersFromSgp ||
    after.activeDemoProcesses !== 3
  )
    throw new Error(
      'A validação pós-limpeza não passou; confira os resultados e restaure o backup se necessário.',
    );

  console.log(
    JSON.stringify({ status: 'READY', before, cleanup, after, demonstrations: demos }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
