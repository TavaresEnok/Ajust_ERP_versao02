import { PrismaClient } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { PILOT_DEFINITIONS } from './pilot-definitions';
import { storedProcessDefinition } from './stored-process-roles';
import { nextVisit, ProcessState, validateDefinition } from './process-definition';

export function sgpDate(value: string, timezone: string): Date | null {
  if (!value) return null;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  const normalized = br ? `${br[3]}-${br[2]}-${br[1]}T${br[4]}` : value.replace(' ', 'T');
  const date = /Z$|[+-]\d{2}:\d{2}$/.test(normalized)
    ? new Date(normalized)
    : fromZonedTime(normalized, timezone);
  if (!Number.isFinite(date.getTime())) throw new Error('Data SGP inválida.');
  return date;
}

export function commentText(html: string) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(p|div|h[1-6]|li|pre)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function importSgpPilot(prisma: PrismaClient, apply = false) {
  const token = process.env.SGP_TOKEN;
  if (!token)
    throw new Error('Defina SGP_TOKEN no ambiente; o segredo não é gravado pelo importador.');
  const timezone = process.env.SGP_TIMEZONE || 'America/Fortaleza';
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.PILOT_TENANT_SLUG || 'ajust-demo' },
  });
  if (!tenant || tenant.status !== 'ACTIVE')
    throw new Error('Tenant alvo do piloto não encontrado ou inativo.');
  async function read(path: string, filters: Record<string, string>) {
    const r = await fetch(`https://ajustconsulting.sgp.net.br${path}`, {
      method: 'POST',
      body: new URLSearchParams({ token: token!, app: 'Sistema_de_O.S', ...filters }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`SGP recusou leitura: HTTP ${r.status}.`);
    const data = await r.json();
    if (data.detail) throw new Error('SGP não autorizou a leitura.');
    return data;
  }
  const [list, order, central] = await Promise.all([
    read('/api/ura/ocorrencia/list/', {
      contrato: '80',
      ocorrencia: '261019175100',
      limit: '20',
      offset: '0',
    }),
    read('/api/os/list/id/11926', {}),
    read('/api/central/chamado/list/', { cliente: '60' }),
  ]);
  const occurrence = list.ocorrencias?.find((o: { id: number }) => Number(o.id) === 11990);
  const centralOccurrence = Array.isArray(central)
    ? central.find((o: { oc_id: number }) => Number(o.oc_id) === 11990)
    : null;
  if (
    !occurrence ||
    Number(occurrence.contrato) !== 80 ||
    Number(order.cliente_id) !== 60 ||
    Number(order.contrato_id) !== 80 ||
    Number(order.os_id) !== 11926 ||
    order.os_protocolo !== occurrence.numero
  )
    throw new Error('Vínculo cliente/contrato/ocorrência/O.S. divergente. Importação cancelada.');
  if (Number(order.os_status) !== 0 || occurrence.status_id !== 0)
    throw new Error('O caso deixou de estar aberto no SGP; revise antes de migrar.');
  const key = 'ajustconsulting.sgp.net.br:os:11926';
  const existing = await prisma.occurrence.findUnique({
    where: {
      tenantId_sourceSystem_externalId: {
        tenantId: tenant.id,
        sourceSystem: 'SGP',
        externalId: '11990',
      },
    },
    include: { processes: true, serviceOrders: true },
  });
  if (existing) {
    if (
      existing.processes.length !== 1 ||
      !existing.serviceOrders.some((o) => o.externalProtocol === key)
    )
      throw new Error('Há importação anterior incompleta; nenhum dado foi sobrescrito.');
    return {
      status: 'ALREADY_IMPORTED',
      occurrenceId: existing.id,
      processId: existing.processes[0].id,
      writes: 0,
    };
  }
  const plan = {
    tenant: tenant.slug,
    clientId: 60,
    sourceOccurrenceId: 11990,
    sourceOrderId: 11926,
    occurrences: 1,
    orders: 1,
    comments: order.comentarios?.length || 0,
    workflowTemplates: 3,
    timezone,
    timezoneConfirmedAtSource: false,
  };
  if (!apply) return { status: 'DRY_RUN', plan };
  return prisma.$transaction(async (tx) => {
    for (const definition of PILOT_DEFINITIONS)
      await tx.serviceProcessTemplate.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: definition.code } },
        create: {
          tenantId: tenant.id,
          code: definition.code,
          version: definition.version,
          definition,
        },
        update: {},
      });
    const stored = await tx.serviceProcessTemplate.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: 'MEGANET_ZABBIX' } },
    });
    const definition = validateDefinition(storedProcessDefinition(stored.definition));
    const now = new Date();
    const state: ProcessState = {
      current: null,
      history: [],
      imported: true,
      events: [
        {
          type: 'MIGRATED',
          at: now.toISOString(),
          actorId: null,
          reason:
            'Uma ocorrência/O.S. real do SGP. Histórico preservado; fluxo nativo iniciado na triagem sem inventar etapas anteriores. Fuso assumido e datas originais preservadas. Metas propostas, fora do SLA contratual.',
        },
      ],
    };
    const ocCreatedRaw = centralOccurrence?.oc_data_cadastro;
    if (!ocCreatedRaw)
      throw new Error(
        'A origem não retornou horário exato de abertura; nenhum registro será gravado.',
      );
    const created = await tx.occurrence.create({
      data: {
        tenantId: tenant.id,
        number: occurrence.numero,
        provider: 'Meganet',
        type: occurrence.tipo,
        status: 'EM_EXECUCAO',
        sector: 'MONITORAMENTO',
        origin: 'SGP',
        openedByName: 'Não informado na API SGP',
        analystResponsible: order.os_tecnico_responsavel || 'Não informado na API SGP',
        description: occurrence.conteudo,
        sourceSystem: 'SGP',
        externalId: '11990',
        createdAt: sgpDate(ocCreatedRaw, timezone)!,
        sourceMetadata: {
          instance: 'ajustconsulting.sgp.net.br',
          clientId: 60,
          contractId: 80,
          originalStatus: occurrence.status,
          originalCreatedAt: ocCreatedRaw,
          originalType: occurrence.tipo,
          timezone,
          timezoneAssumed: true,
          historicalSla: 'UNKNOWN',
        },
      },
    });
    const process = await tx.serviceProcessInstance.create({
      data: {
        tenantId: tenant.id,
        occurrenceId: created.id,
        templateCode: definition.code,
        templateVersion: definition.version,
        definition,
        state: JSON.parse(JSON.stringify(state)),
      },
    });
    const visit = nextVisit(definition, state, definition.start, now);
    const imported = await tx.serviceOrder.create({
      data: {
        tenantId: tenant.id,
        occurrenceId: created.id,
        protocol: `SGP-${order.os_id}`,
        externalProtocol: key,
        sourceSystem: 'SGP',
        processInstanceId: process.id,
        processNodeId: definition.start,
        slaEligible: false,
        title: 'Meganet · Zabbix / Grafana',
        description: order.os_conteudo,
        type: 'INFRAESTRUTURA',
        priority: 'NORMAL',
        status: 'ABERTA',
        ownerName: order.os_tecnico_responsavel,
        analystName: order.os_tecnico_responsavel,
        sector: 'MONITORAMENTO',
        origin: 'SGP',
        isCustomerVisible: false,
        createdAt: sgpDate(order.os_data_cadastro, timezone)!,
        deadlineAt: new Date(visit.dueAt),
        tags: ['piloto-meganet', 'sgp:11926', 'sla-proposto'],
        sourceMetadata: {
          instance: 'ajustconsulting.sgp.net.br',
          orderId: 11926,
          occurrenceId: 11990,
          protocol: order.os_protocolo,
          originalStatus: order.os_status,
          originalPriority: order.os_prioridade,
          originalCreatedAt: order.os_data_cadastro,
          originalScheduledAt: order.os_data_agendamento,
          schedulingConfirmed: order.os_agendamento_confirmado,
          originalCompletedAt: order.os_data_finalizacao,
          originalServicePerformed: order.os_servicoprestado,
          originalObservation: order.os_observacao,
          originalAnnotation: order.os_anotacao,
          historicalSla: 'UNKNOWN',
          timezone,
          timezoneAssumed: true,
          stageSlaStartsAt: now.toISOString(),
        },
      },
    });
    for (const comment of order.comentarios || [])
      await tx.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: imported.id,
          sourceSystem: 'SGP',
          externalId: String(comment.comentario_id),
          sourceAuthorName: comment.usuario || 'Não informado',
          message: commentText(comment.comentario || ''),
          isCustomerVisible: false,
          createdAt: sgpDate(comment.data_cadastro, timezone)!,
        },
      });
    state.current = { ...visit, orderId: imported.id };
    await tx.serviceProcessInstance.update({
      where: { id: process.id },
      data: { state: JSON.parse(JSON.stringify(state)) },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: 'SYNC',
        resourceType: 'sgp_pilot_import',
        resourceId: process.id,
        metadata: {
          sourceOccurrence: 11990,
          sourceOrder: 11926,
          comments: order.comentarios?.length || 0,
          sourceDomain: 'ajustconsulting.sgp.net.br',
        },
      },
    });
    return {
      status: 'IMPORTED',
      plan,
      occurrenceId: created.id,
      orderId: imported.id,
      processId: process.id,
      path: `/gerencia/processos/${process.id}`,
    };
  });
}
