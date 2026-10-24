import { Prisma, PrismaClient, ServiceOrderStatus } from '@prisma/client';
import { collectSgpSample } from './sgp-sample-source';
import { makeOperationalDefinition, validateOperational } from './operational-definition';
import { commentText, sgpDate } from './import-sgp-pilot';
import { classifySample } from './sample-classification';

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function safeSgpText(value: unknown) {
  return commentText(String(value || ''))
    .split('\n')
    .map((line) =>
      /senha|password|passwd|secret|token|private.?key|credencia|anydesk|admin\/admin|community\s*[:=]|(?:login|username|usuario)\s*[:=]/i.test(
        line,
      )
        ? '[Linha de credencial removida na migração]'
        : line.replace(/(https?:\/\/)[^\s/:]+:[^\s@]+@/gi, '$1[credencial removida]@'),
    )
    .join('\n')
    .slice(0, 100000);
}

export async function importSgpSample(prisma: PrismaClient, apply: boolean) {
  const source = await collectSgpSample();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: process.env.SAMPLE_TENANT_SLUG || 'ajust-demo' },
  });
  const people = await prisma.user.findMany({
    where: { tenants: { some: { tenantId: tenant.id } }, sourceSystem: 'SGP', deletedAt: null },
    select: { id: true, name: true },
  });
  const results: Record<string, unknown>[] = [];
  for (const sample of source) {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { tenantId_taxId: { tenantId: tenant.id, taxId: sample.customer.taxId } },
    });
    for (const item of sample.selected) {
      const classification = classifySample(Number(item.order.id), String(item.occurrence.tipo));
      const proposed = makeOperationalDefinition(classification.name);
      proposed.sourceTypes = [String(item.occurrence.tipo)];
      const key = `ajustconsulting.sgp.net.br:os:${item.order.id}`;
      const plan = {
        provider: sample.customer.tradeName,
        sourceOrderId: Number(item.order.id),
        sourceOccurrenceId: Number(item.occurrence.id),
        sourceType: String(item.occurrence.tipo),
        sourceStatus: item.order.status,
        workflowCode: proposed.code,
        normalizedDemand: classification.name,
        classificationReason: classification.reason,
      };
      if (!apply) {
        results.push({ ...plan, status: 'PLANNED' });
        continue;
      }
      const result = await prisma.$transaction(
        async (tx) => {
          const template = await tx.serviceProcessTemplate.upsert({
            where: { tenantId_code: { tenantId: tenant.id, code: proposed.code } },
            create: {
              tenantId: tenant.id,
              code: proposed.code,
              version: 1,
              definition: json(proposed),
              publishedAt: new Date(),
            },
            update: {},
          });
          const definition = validateOperational(template.definition);
          let occurrence = await tx.occurrence.findUnique({
            where: {
              tenantId_sourceSystem_externalId: {
                tenantId: tenant.id,
                sourceSystem: 'SGP',
                externalId: String(item.occurrence.id),
              },
            },
          });
          const d = item.detail;
          const createdAt = sgpDate(String(d.os_data_cadastro || ''), 'America/Fortaleza');
          if (!createdAt) throw new Error(`Sem data exata da O.S. ${item.order.id}.`);
          const completedAt = sgpDate(String(d.os_data_finalizacao || ''), 'America/Fortaleza');
          const sourceStatus = Number(d.os_status);
          const statuses: Record<number, ServiceOrderStatus> = {
            0: 'ABERTA',
            1: 'FECHADA',
            2: 'EM_ANALISE',
            3: 'AG_TERCEIROS',
          };
          if (!(sourceStatus in statuses))
            throw new Error(`Estado desconhecido da O.S. ${item.order.id}.`);
          if (!occurrence) {
            const occurrenceCreated =
              `${item.occurrence.data_cadastro || ''} ${item.occurrence.hora_cadastro || ''}`.trim();
            let exactOccurrenceDate: Date | null = null;
            try {
              exactOccurrenceDate = sgpDate(occurrenceCreated, 'America/Fortaleza');
            } catch {
              /* preserve original raw below, use order timestamp explicitly */
            }
            occurrence = await tx.occurrence.create({
              data: {
                tenantId: tenant.id,
                customerId: customer.id,
                number: String(item.occurrence.numero),
                provider: customer.tradeName,
                type: String(item.occurrence.tipo),
                status: Number(item.occurrence.status_id) === 1 ? 'ENCERRADA' : 'ABERTA',
                sector: String(d.os_setor || 'NOC'),
                origin: 'SGP',
                openedByName: String(item.occurrence.usuario || 'Não informado pela origem'),
                analystResponsible: String(d.os_tecnico_responsavel || 'Não informado'),
                description:
                  safeSgpText(item.occurrence.conteudo) || 'Descrição não informada na origem.',
                sourceSystem: 'SGP',
                externalId: String(item.occurrence.id),
                createdAt: exactOccurrenceDate || createdAt,
                closedAt: Number(item.occurrence.status_id) === 1 ? completedAt : null,
                sourceMetadata: json({
                  instance: 'ajustconsulting.sgp.net.br',
                  sourceCustomerId: sample.customer.id,
                  contractId: item.order.contrato,
                  originalType: item.occurrence.tipo,
                  originalStatus: item.occurrence.status,
                  originalCreatedAt: occurrenceCreated,
                  createdAtBasis: exactOccurrenceDate
                    ? 'SOURCE_OCCURRENCE'
                    : 'SOURCE_ORDER_FALLBACK',
                  timezone: 'America/Fortaleza',
                  timezoneAssumed: true,
                  sample: `${sample.selected.length}_distinct_types`,
                }),
              },
            });
          } else if (!occurrence.customerId) {
            await tx.occurrence.update({
              where: { id: occurrence.id },
              data: { customerId: customer.id },
            });
          } else if (occurrence.customerId !== customer.id)
            throw new Error('Cliente vinculado divergente.');
          if (occurrence.provider !== customer.tradeName)
            await tx.occurrence.update({
              where: { id: occurrence.id },
              data: {
                provider: customer.tradeName,
                sourceMetadata: json({
                  ...(occurrence.sourceMetadata as object),
                  previousErpProviderLabel: occurrence.provider,
                }),
              },
            });
          let order = await tx.serviceOrder.findUnique({
            where: { tenantId_externalProtocol: { tenantId: tenant.id, externalProtocol: key } },
          });
          const already = !!order;
          if (!order) {
            const matches = people.filter(
              (p) =>
                p.name.trim().toLocaleLowerCase() ===
                String(d.os_tecnico_responsavel || '')
                  .trim()
                  .toLocaleLowerCase(),
            );
            order = await tx.serviceOrder.create({
              data: {
                tenantId: tenant.id,
                occurrenceId: occurrence.id,
                protocol: `SGP-${d.os_id}`,
                externalProtocol: key,
                sourceSystem: 'SGP',
                title: `${customer.tradeName} · ${definition.name}`,
                type: definition.nodes.find((n) => n.kind === 'task')!.serviceType,
                description:
                  safeSgpText(d.os_conteudo) ||
                  safeSgpText(item.occurrence.conteudo) ||
                  'Descrição não informada.',
                status: statuses[sourceStatus],
                priority: 'NORMAL',
                analystName: String(d.os_tecnico_responsavel || ''),
                ownerName: String(d.os_tecnico_responsavel || ''),
                ...(matches.length === 1 ? { assigneeUserId: matches[0].id } : {}),
                sector: String(d.os_setor || 'NOC'),
                origin: 'SGP',
                slaEligible: false,
                isCustomerVisible: false,
                createdAt,
                deadlineAt: completedAt || createdAt,
                ...(sourceStatus === 1 ? { closedAt: completedAt, resolvedAt: completedAt } : {}),
                tags: ['amostra-sgp', 'historico-sla-desconhecido'],
                sourceMetadata: json({
                  instance: 'ajustconsulting.sgp.net.br',
                  sourceCustomerId: sample.customer.id,
                  orderId: d.os_id,
                  occurrenceId: item.occurrence.id,
                  contractId: d.contrato_id,
                  protocol: d.os_protocolo,
                  originalType: item.occurrence.tipo,
                  originalStatus: d.os_status,
                  originalPriority: d.os_prioridade,
                  priorityRequiresReview: true,
                  originalCreatedAt: d.os_data_cadastro,
                  originalCompletedAt: d.os_data_finalizacao,
                  originalScheduledAt: d.os_data_agendamento,
                  originalServicePerformed: safeSgpText(d.os_servicoprestado),
                  originalObservation: safeSgpText(d.os_observacao),
                  originalAnnotation: safeSgpText(d.os_anotacao),
                  historicalSla: 'UNKNOWN',
                  timezone: 'America/Fortaleza',
                  timezoneAssumed: true,
                  credentialsExcluded: true,
                }),
              },
            });
          }
          if (order.tags.includes('amostra-sgp')) {
            order = await tx.serviceOrder.update({
              where: { id: order.id },
              data: {
                ...(order.version === 1
                  ? {
                      description: safeSgpText(d.os_conteudo) || order.description,
                      title: `${customer.tradeName} · ${definition.name}`,
                      type: definition.nodes.find((n) => n.kind === 'task')!.serviceType,
                    }
                  : {}),
                sourceMetadata: json({
                  ...(order.sourceMetadata as object),
                  normalizedDemand: classification.name,
                  classificationReason: classification.reason,
                  classificationReviewed: classification.reviewed,
                }),
              },
            });
          }
          for (const comment of d.comentarios || []) {
            const message = safeSgpText(comment.comentario);
            if (!message || !comment.data_cadastro || !comment.comentario_id) continue;
            await tx.serviceOrderOccurrence.upsert({
              where: {
                serviceOrderId_sourceSystem_externalId: {
                  serviceOrderId: order.id,
                  sourceSystem: 'SGP',
                  externalId: String(comment.comentario_id),
                },
              },
              create: {
                serviceOrderId: order.id,
                sourceSystem: 'SGP',
                externalId: String(comment.comentario_id),
                sourceAuthorName: String(comment.usuario || 'Não informado'),
                message,
                isCustomerVisible: false,
                createdAt: sgpDate(String(comment.data_cadastro), 'America/Fortaleza')!,
              },
              update: order.tags.includes('amostra-sgp') ? { message } : {},
            });
          }
          let instance = await tx.serviceProcessInstance.findUnique({
            where: { tenantId_rootOrderId: { tenantId: tenant.id, rootOrderId: order.id } },
          });
          let predecessor: typeof instance = null;
          if (instance && instance.templateCode !== definition.code) {
            const steps = await tx.serviceProcessStep.findMany({
              where: { instanceId: instance.id },
            });
            const notExecuted =
              instance.status === 'HISTORICAL' ||
              (instance.status === 'ACTIVE' &&
                steps.length === 1 &&
                steps[0].nodeId === 'triagem' &&
                steps[0].status === 'ACTIVE');
            if (!notExecuted)
              return {
                ...plan,
                status: 'REVIEW_REQUIRED_ACTIVE_EXECUTION',
                processId: instance.id,
                orderId: order.id,
              };
            predecessor = instance;
            await tx.serviceProcessInstance.update({
              where: { id: instance.id, version: instance.version },
              data: {
                rootOrderId: null,
                status: 'SUPERSEDED',
                completedAt: new Date(),
                version: { increment: 1 },
                state: json({
                  ...(instance.state as object),
                  supersededReason: classification.reason,
                  previousRootOrderId: order.id,
                }),
              },
            });
            await tx.serviceProcessStep.updateMany({
              where: { instanceId: instance.id, status: { in: ['ACTIVE', 'WAITING'] } },
              data: { status: 'SUPERSEDED' },
            });
            if (order.processInstanceId === instance.id)
              order = await tx.serviceOrder.update({
                where: { id: order.id },
                data: { processInstanceId: null },
              });
            instance = null;
          }
          if (!instance) {
            instance = await tx.serviceProcessInstance.create({
              data: {
                tenantId: tenant.id,
                occurrenceId: occurrence.id,
                rootOrderId: order.id,
                engineVersion: 2,
                templateCode: definition.code,
                templateVersion: definition.version,
                definition: json(definition),
                state: {
                  mode: order.processInstanceId ? 'REFERENCE' : 'HISTORICAL',
                  sourceStatus: item.order.status,
                  classificationBasis: classification.reason,
                  classificationReviewed: classification.reviewed,
                  originalSourceType: String(item.occurrence.tipo),
                  ...(predecessor
                    ? {
                        previousProposalId: predecessor.id,
                        ...((predecessor.state as Record<string, unknown>).demoId
                          ? {
                              demoId: String((predecessor.state as Record<string, unknown>).demoId),
                            }
                          : {}),
                      }
                    : {}),
                },
                status: 'HISTORICAL',
                completedAt: completedAt,
              },
            });
            await tx.serviceProcessOrderLink.create({
              data: { instanceId: instance.id, orderKey: 'root', orderId: order.id },
            });
            if (!order.processInstanceId)
              await tx.serviceOrder.update({
                where: { id: order.id },
                data: { processInstanceId: instance.id },
              });
            if (predecessor)
              await tx.serviceProcessInstance.update({
                where: { id: predecessor.id },
                data: {
                  state: json({
                    ...(predecessor.state as object),
                    successorId: instance.id,
                    previousRootOrderId: order.id,
                    supersededReason: classification.reason,
                  }),
                },
              });
            await tx.auditLog.create({
              data: {
                tenantId: tenant.id,
                action: 'SYNC',
                resourceType: 'sgp_sample_import',
                resourceId: instance.id,
                metadata: json(plan),
              },
            });
          }
          return {
            ...plan,
            status: already ? 'EXISTING_LINKED' : 'IMPORTED',
            orderId: order.id,
            occurrenceId: occurrence.id,
            processId: instance.id,
            comments: d.comentarios?.length || 0,
          };
        },
        { timeout: 30000 },
      );
      results.push(result);
    }
  }
  if (apply) {
    const selectedCodes = [...new Set(results.map((r) => String(r.workflowCode)))];
    const originalGeneratedCodes = [
      'CONFIGURAÇÃO OLT',
      'DNS',
      'CONFIGURAÇÃO BGP',
      'CONFIGURAÇÃO ZABBIX/GRAFANA',
      'MIGRAÇÃO DE EQUIPAMENTO',
      'MONITORAMENTO',
      'INFORMAÇÕES',
      'PROBLEMA EM SITES',
    ].map((name) => makeOperationalDefinition(name).code);
    await prisma.serviceProcessTemplate.updateMany({
      where: {
        tenantId: tenant.id,
        code: { in: originalGeneratedCodes.filter((code) => !selectedCodes.includes(code)) },
        version: 1,
      },
      data: { publishedAt: null },
    });
  }
  return {
    status: apply ? 'APPLIED' : 'DRY_RUN',
    maxOrdersPerProvider: Number(process.env.SGP_SAMPLE_SIZE || 20),
    results,
    totalSelected: results.length,
    sourceCoverage: source.map((s) => ({
      provider: s.customer.tradeName,
      inspectedRecentRows: s.inspected,
      selected: s.selected.length,
      distinctTypesSeen: s.availableTypes.length,
    })),
  };
}
