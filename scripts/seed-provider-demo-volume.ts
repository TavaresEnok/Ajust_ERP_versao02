require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
/**
 * Adds 20 real provider/customer records from the SGP customer directory and
 * creates a 120-day SYNTHETIC operating scenario in the local ERP.
 *
 * Read-only by default. To write, pass --execute and a verified backup proof:
 * AJUST_PROVIDER_VOLUME_BACKUP_VERIFIED=pg_dump+uploads:<backup-directory>
 * SGP_TOKEN is read from the process environment only; it is never persisted.
 */
import {
  OccurrenceStatus,
  Priority,
  Prisma,
  PrismaClient,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@prisma/client';

const prisma = new PrismaClient();
const tenantSlug = 'ajust-demo';
const scenarioId = 'provider-volume-120d-v1';
const orderPrefix = 'DEMO-120D-';
const occurrencePrefix = 'DEMO-INC-120D-';
const domain = 'ajustconsulting.sgp.net.br';
const app = 'Sistema_de_O.S';
const backupProof = process.env.AJUST_PROVIDER_VOLUME_BACKUP_VERIFIED;
const execute = process.argv.includes('--execute');

const selectedProviders = [
  { id: 119, expected: 'NEW CONNECT', tradeName: 'NEW CONNECT' },
  { id: 66, expected: 'UM TELECOM', tradeName: 'UM TELECOM' },
  { id: 145, expected: 'GFIBRA', tradeName: 'GFIBRA' },
  { id: 125, expected: 'OGA FIBRA', tradeName: 'OGA FIBRA' },
  { id: 129, expected: 'RNET', tradeName: 'RNET' },
  { id: 92, expected: 'NETMANIA', tradeName: 'NETMANIA' },
  { id: 37, expected: 'BCA LINK', tradeName: 'BCA LINK' },
  { id: 35, expected: 'ALYSON NET', tradeName: 'ALYSON NET' },
  { id: 32, expected: 'TONYNET', tradeName: 'TONYNET' },
  { id: 2, expected: 'AQUI TELECOM', tradeName: 'AQUI TELECOM' },
  { id: 137, expected: 'BVNET', tradeName: 'BVNET' },
  { id: 54, expected: 'BWN COMUNICACAO', tradeName: 'BWN COMUNICACAO' },
  { id: 33, expected: 'ALPHANET', tradeName: 'ALPHANET' },
  { id: 4, expected: 'CELLNEET', tradeName: 'CELLNEET' },
  { id: 91, expected: 'CENTRALNET', tradeName: 'CENTRALNET' },
  { id: 57, expected: 'CIX TELECOM', tradeName: 'CIX TELECOM' },
  { id: 96, expected: 'ULTRAFIBRA', tradeName: 'ULTRAFIBRA' },
  { id: 144, expected: 'CN FIBRA', tradeName: 'CN FIBRA' },
  { id: 5, expected: 'CLICK NET', tradeName: 'CLICK NET' },
  { id: 114, expected: 'UP CONNECT FIBRA', tradeName: 'UP CONNECT FIBRA' },
] as const;

type Provider = {
  id: number;
  legalName: string;
  tradeName: string;
  taxId: string;
  personType: string;
  address: Record<string, string>;
  contacts: { emails: string[]; telefones: string[]; celulares: string[] };
};

type Analyst = { id: string; name: string };
type WorkTemplate = {
  type: ServiceOrderType;
  title: string;
  description: string;
  resolution: string;
};
type ScenarioOrder = {
  analyst: Analyst;
  status: ServiceOrderStatus;
  template: WorkTemplate;
  priority: Priority;
  providerIndex: number;
  groupIndex: number;
  orderIndex: number;
};

const workTemplates: WorkTemplate[] = [
  {
    type: 'BGP',
    title: 'Revisão de política BGP e anúncios',
    description:
      'Revisar sessão, prefixos anunciados, filtros de entrada e saída e consistência do caminho de retorno.',
    resolution: 'Cenário de validação de sessão, filtros e anúncios registrados.',
  },
  {
    type: 'DNS',
    title: 'Validação de DNS autoritativo e recursivo',
    description:
      'Conferir resolução dos domínios de referência, servidores autoritativos, recursão e registros publicados.',
    resolution: 'Cenário de validação de resolução e registros DNS registrado.',
  },
  {
    type: 'PROXMOX',
    title: 'Revisão de cluster e alta disponibilidade Proxmox',
    description:
      'Revisar estado dos nós, quorum, armazenamento, replicação e alertas de alta disponibilidade.',
    resolution: 'Cenário de revisão do cluster e das verificações de HA registrado.',
  },
  {
    type: 'FIREWALL',
    title: 'Revisão de regras e publicação de serviço',
    description:
      'Conferir objetos, regras, NAT, ordem de avaliação e acesso administrativo conforme o escopo da solicitação.',
    resolution: 'Cenário de revisão de regras e exposição de serviços registrado.',
  },
  {
    type: 'ROTEAMENTO_CGNAT',
    title: 'Análise de rota e capacidade CGNAT',
    description:
      'Analisar caminho de roteamento, distribuição de blocos, utilização e parâmetros de tradução CGNAT.',
    resolution: 'Cenário de análise de rotas e capacidade CGNAT registrado.',
  },
  {
    type: 'INFRAESTRUTURA',
    title: 'Conferência de VLANs e documentação de enlace',
    description:
      'Conferir VLANs, interfaces de uplink, identificação de enlaces e aderência ao diagrama de rede.',
    resolution: 'Cenário de conferência de VLAN e documentação registrado.',
  },
  {
    type: 'AUDITORIA',
    title: 'Auditoria de configuração de OLT',
    description:
      'Revisar perfis, uplinks, VLANs de serviço, níveis de sinal e consistência da configuração da OLT.',
    resolution: 'Cenário de auditoria de configuração e evidências registrado.',
  },
  {
    type: 'INSTALACAO',
    title: 'Planejamento de ativação de link dedicado',
    description:
      'Validar endereçamento, rota, parâmetros de borda, janela de mudança e dependências para ativação.',
    resolution: 'Cenário de planejamento e validação de ativação registrado.',
  },
  {
    type: 'LENTIDAO',
    title: 'Análise de latência, perda e desempenho',
    description:
      'Organizar evidências de latência, perda de pacotes, utilização de enlaces e horários de recorrência.',
    resolution: 'Cenário de análise de desempenho e evidências registrado.',
  },
  {
    type: 'CONFIGURACAO_ONU',
    title: 'Padronização de perfil e provisionamento ONU',
    description:
      'Revisar perfil de provisionamento, VLAN, autenticação e parâmetros de serviço da ONU.',
    resolution: 'Cenário de revisão do perfil e provisionamento registrado.',
  },
];

const sectors = ['NOC', 'Atendimento', 'CGR', 'Monitoramento'] as const;
const progressStatuses: ServiceOrderStatus[] = [
  'EM_ANALISE',
  'AG_CAMPO',
  'AG_TERCEIROS',
  'EM_ANALISE',
  'AG_CAMPO',
];
const priorityHours: Record<Priority, number> = {
  BAIXA: 48,
  NORMAL: 24,
  ALTA: 8,
  CRITICA: 4,
};
const priorities: Priority[] = ['CRITICA', 'ALTA', 'NORMAL', 'BAIXA', 'NORMAL'];
const groupSizes = [
  3,
  4,
  4,
  4, // 15 new orders: open
  3,
  4,
  4,
  4, // 15 new orders: in progress
  2,
  2,
  2,
  2,
  2,
  2, // 12 closed orders
  3,
  3,
  3,
  3,
  3,
  3, // 18 closed orders
] as const;

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return [...new Set(value.filter((item): item is string => typeof item === 'string'))]
      .map((item) => item.trim())
      .filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchProviderDirectory(): Promise<Provider[]> {
  const token = process.env.SGP_TOKEN;
  if (!token) throw new Error('Defina SGP_TOKEN somente no ambiente deste comando.');

  const records = await Promise.all(
    selectedProviders.map(async ({ id, expected, tradeName }) => {
      const body = new URLSearchParams({
        token,
        app,
        cliente_id: String(id),
        limit: '1',
        offset: '0',
        omitir_contratos: '1',
        omitir_titulos: '1',
      });
      const response = await fetch(`https://${domain}/api/ura/clientes/`, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok)
        throw new Error(`Falha na leitura cadastral de provedor (HTTP ${response.status}).`);
      const result: unknown = await response.json();
      const payload = object(result);
      const rows = Array.isArray(payload.clientes) ? payload.clientes : [];
      if (rows.length !== 1)
        throw new Error(`Registro cadastral ${id} não retornou um único resultado.`);
      const raw = object(rows[0]);
      const name = text(raw.nome);
      const digits = text(raw.cpfcnpj).replace(/\D/g, '');
      if (
        Number(raw.id) !== id ||
        text(raw.tipo) !== 'Pessoa Jurídica' ||
        digits.length !== 14 ||
        !normalize(name).includes(normalize(expected))
      )
        throw new Error(`Registro empresarial ${id} divergente; nenhuma importação foi feita.`);

      const address = object(raw.endereco);
      const contacts = object(raw.contatos);
      return {
        id,
        legalName: name,
        tradeName,
        taxId: digits,
        personType: text(raw.tipo),
        address: Object.fromEntries(
          ['logradouro', 'numero', 'bairro', 'cidade', 'uf', 'cep', 'complemento'].map((key) => [
            key,
            text(address[key]),
          ]),
        ),
        contacts: {
          emails: stringList(contacts.emails),
          telefones: stringList(contacts.telefones),
          celulares: stringList(contacts.celulares),
        },
      };
    }),
  );

  if (new Set(records.map((record) => record.id)).size !== 20)
    throw new Error('Lista de provedores duplicada; revisão necessária.');
  if (new Set(records.map((record) => record.taxId)).size !== 20)
    throw new Error('CNPJs duplicados no retorno do diretório; revisão necessária.');
  return records;
}

function assignmentsForGroup(groupIndex: number, size: number, analysts: Analyst[]): Analyst[] {
  if (groupIndex < 4 || (groupIndex >= 4 && groupIndex < 8)) {
    const local = groupIndex % 4;
    if (size === 3) return analysts.slice(0, 3);
    return [...analysts.slice(0, 3), analysts[local - 1]];
  }
  const closedGroupIndex = groupIndex - 8;
  if (size === 2) {
    const pairs = [
      [analysts[0], analysts[1]],
      [analysts[1], analysts[2]],
      [analysts[0], analysts[2]],
    ];
    return pairs[closedGroupIndex % pairs.length];
  }
  return analysts.slice(0, 3);
}

function occurrenceSplits(groupIndex: number, size: number): number[] {
  // A few historical incidents are deliberately one-order occurrences; the
  // rest demonstrate one-to-many occurrence/order relationships.
  if (size === 2 && groupIndex >= 8 && groupIndex < 12) return [1, 1];
  return [size];
}

function occurrenceAgeDays(groupIndex: number): number {
  if (groupIndex < 4) return [0.3, 1.1, 2.4, 5.2][groupIndex];
  if (groupIndex < 8) return [0.6, 2.2, 5.8, 10.5][groupIndex - 4];
  return [118, 106, 94, 82, 70, 58, 48, 38, 28, 18, 7, 3][groupIndex - 8];
}

function hoursBefore(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function hoursAfter(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function scenarioOrders(analysts: Analyst[]): ScenarioOrder[][] {
  const result: ScenarioOrder[][] = [];
  let templateIndex = 0;
  for (let groupIndex = 0; groupIndex < groupSizes.length; groupIndex++) {
    const size = groupSizes[groupIndex];
    const owners = assignmentsForGroup(groupIndex, size, analysts);
    const status = groupIndex < 4 ? 'ABERTA' : groupIndex < 8 ? 'EM_EXECUCAO' : 'FECHADA';
    const group: ScenarioOrder[] = owners.map((analyst, orderIndex) => {
      const template = workTemplates[(templateIndex * 7 + groupIndex * 3) % workTemplates.length];
      const priority = priorities[(templateIndex + groupIndex) % priorities.length];
      const plannedStatus: ServiceOrderStatus =
        status === 'ABERTA'
          ? 'ABERTA'
          : status === 'FECHADA'
            ? 'FECHADA'
            : progressStatuses[analysts.indexOf(analyst) + orderIndex] || 'EM_ANALISE';
      templateIndex++;
      return {
        analyst,
        status: plannedStatus,
        template,
        priority,
        providerIndex: groupIndex,
        groupIndex,
        orderIndex,
      };
    });
    result.push(group);
  }
  return result;
}

function validateDistribution(groups: ScenarioOrder[][], analysts: Analyst[]) {
  const counts = new Map<string, Record<string, number>>();
  for (const analyst of analysts)
    counts.set(analyst.id, { ABERTA: 0, EM_ANALISE: 0, AG_CAMPO: 0, AG_TERCEIROS: 0, FECHADA: 0 });
  for (const group of groups)
    for (const order of group) {
      const row = counts.get(order.analyst.id)!;
      row[order.status]++;
    }
  const rows = analysts.map((analyst) => ({
    name: analyst.name,
    open: counts.get(analyst.id)!.ABERTA,
    inProgress:
      counts.get(analyst.id)!.EM_ANALISE +
      counts.get(analyst.id)!.AG_CAMPO +
      counts.get(analyst.id)!.AG_TERCEIROS,
    closed: counts.get(analyst.id)!.FECHADA,
  }));
  if (rows.some((row) => row.open !== 5 || row.inProgress !== 5 || row.closed !== 10))
    throw new Error(`Distribuição de O.S. inválida: ${JSON.stringify(rows)}`);
  return rows;
}

async function main() {
  const providers = await fetchProviderDirectory();
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt)
    throw new Error('Workspace Ajust não está ativo.');

  const members = await prisma.userTenant.findMany({
    where: {
      tenantId: tenant.id,
      role: { code: 'analista' },
      user: { status: 'ACTIVE', deletedAt: null },
    },
    select: { user: { select: { id: true, name: true } } },
  });
  const analysts = members
    .map(({ user }) => user)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (analysts.length !== 3)
    throw new Error(`Esperava os 3 analistas ativos já verificados; encontrei ${analysts.length}.`);

  const existingCustomers = await prisma.customer.findMany({
    where: { tenantId: tenant.id, taxId: { in: providers.map((provider) => provider.taxId) } },
    select: { id: true, legalName: true, taxId: true, deletedAt: true },
  });
  if (existingCustomers.length)
    throw new Error(
      `Há conflito cadastral em ${existingCustomers.length} CNPJ(s); parei sem sobrescrever.`,
    );
  const existingOrder = await prisma.serviceOrder.findFirst({
    where: { tenantId: tenant.id, protocol: { startsWith: orderPrefix } },
    select: { id: true },
  });
  const existingOccurrence = await prisma.occurrence.findFirst({
    where: { tenantId: tenant.id, number: { startsWith: occurrencePrefix } },
    select: { id: true },
  });
  if (existingOrder || existingOccurrence)
    throw new Error('Este cenário já foi criado parcialmente ou por inteiro; não vou duplicá-lo.');

  const groups = scenarioOrders(analysts);
  const distribution = validateDistribution(groups, analysts);
  const splits = groups.flatMap((group, index) => occurrenceSplits(index, group.length));
  const extraOccurrences = splits.length - groups.length;
  const plan = {
    status: execute ? 'EXECUTION_READY' : 'DRY_RUN',
    customerCount: providers.length,
    customerNames: providers.map((provider) => provider.tradeName),
    occurrenceCount: groups.length + extraOccurrences,
    serviceOrderCount: groups.reduce((total, group) => total + group.length, 0),
    multiOrderOccurrences: groups.filter(
      (group, index) => occurrenceSplits(index, group.length).length === 1 && group.length > 1,
    ).length,
    oneOrderOccurrences:
      groups.filter((group, index) => occurrenceSplits(index, group.length).length === 2).length *
      2,
    plannedDays: 120,
    analysts: distribution,
    writesSgpProvenance: false,
    importsContractsOrFinancialTitles: false,
    createsOfficialSlaPolicies: false,
  };
  if (!execute) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  if (!backupProof?.startsWith('pg_dump+uploads:'))
    throw new Error('Execução exige backup validado de banco e uploads no ambiente.');

  const now = new Date();
  const result = await prisma.$transaction(
    async (tx) => {
      const importedCustomers: string[] = [];
      const customerIds: string[] = [];
      for (const provider of providers) {
        const row = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            legalName: provider.legalName,
            tradeName: provider.tradeName,
            taxId: provider.taxId,
            personType: provider.personType,
            address: asJson(provider.address),
            contacts: asJson(provider.contacts),
            sourceSystem: 'ERP',
            externalId: null,
            sourceMetadata: asJson({}),
          },
          select: { id: true, tradeName: true },
        });
        customerIds.push(row.id);
        importedCustomers.push(row.tradeName);
      }

      let occurrenceNumber = 1;
      let orderNumber = 1;
      let noteCount = 0;
      let occurrenceNoteCount = 0;
      let statusEventCount = 0;
      let timeEntryCount = 0;
      let slaEventCount = 0;
      let calendarCount = 0;
      const createdOrders: Array<{
        id: string;
        analystId: string;
        status: ServiceOrderStatus;
        priority: Priority;
        providerIndex: number;
      }> = [];

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const group = groups[groupIndex];
        const provider = providers[groupIndex];
        const customerId = customerIds[groupIndex];
        const splits = occurrenceSplits(groupIndex, group.length);
        let groupCursor = 0;

        for (const splitSize of splits) {
          const orders = group.slice(groupCursor, groupCursor + splitSize);
          groupCursor += splitSize;
          const baseCreatedAt = daysBefore(now, occurrenceAgeDays(groupIndex));
          const occurrenceCreatedAt = hoursBefore(baseCreatedAt, 1);
          const statusClass = groupIndex < 4 ? 'OPEN' : groupIndex < 8 ? 'IN_PROGRESS' : 'CLOSED';
          const createdOrderData: Array<{
            order: ScenarioOrder;
            id: string;
            createdAt: Date;
            deadlineAt: Date;
            resolvedAt: Date | null;
            closedAt: Date | null;
            durationHours: number;
          }> = [];

          for (let localIndex = 0; localIndex < orders.length; localIndex++) {
            const order = orders[localIndex];
            const createdAt = hoursAfter(baseCreatedAt, 0.5 + localIndex * 2.5);
            const slaHours = priorityHours[order.priority];
            const deadlineAt = hoursAfter(createdAt, slaHours);
            const isClosed = order.status === 'FECHADA';
            const isProgress = order.status !== 'ABERTA' && !isClosed;
            const durationHours = isClosed
              ? orderNumber % 4 === 0
                ? slaHours + 2.5
                : Math.max(0.75, Math.min(12, slaHours * 0.55))
              : 0;
            const resolvedAt = isClosed
              ? hoursAfter(createdAt, Math.max(0.5, durationHours - 0.25))
              : null;
            const closedAt = isClosed ? hoursAfter(createdAt, durationHours) : null;
            const protocol = `${orderPrefix}${String(orderNumber).padStart(4, '0')}`;
            const record = await tx.serviceOrder.create({
              data: {
                tenantId: tenant.id,
                occurrenceId: undefined,
                protocol,
                externalProtocol: null,
                sourceSystem: 'ERP',
                sourceMetadata: asJson({
                  demonstration: true,
                  scenarioId,
                  scenarioPeriodDays: 120,
                  demonstrationSlaHours: slaHours,
                }),
                type: order.template.type,
                priority: order.priority,
                status: order.status,
                title: `DEMO · ${order.template.title}`,
                description:
                  `CENÁRIO DE DEMONSTRAÇÃO — ${order.template.description} ` +
                  'Os dados e resultados são simulados para avaliação do ERP; não representam atividade executada.',
                ownerUserId: null,
                ownerName: 'Demonstração Ajust',
                assigneeUserId: order.analyst.id,
                analystName: order.analyst.name,
                requester: provider.tradeName,
                sector: sectors[(order.providerIndex + localIndex) % sectors.length],
                origin: 'DEMONSTRAÇÃO',
                deadlineAt,
                resolvedAt,
                closedAt,
                slaEligible: true,
                tags: [],
                internalNotes: null,
                isCustomerVisible: true,
                createdAt,
                updatedAt:
                  closedAt ||
                  new Date(
                    Math.min(
                      now.getTime(),
                      isProgress
                        ? hoursAfter(
                            createdAt,
                            Math.min(24, Math.max(1, occurrenceAgeDays(groupIndex))),
                          ).getTime()
                        : createdAt.getTime(),
                    ),
                  ),
              },
              select: { id: true },
            });
            createdOrderData.push({
              order,
              id: record.id,
              createdAt,
              deadlineAt,
              resolvedAt,
              closedAt,
              durationHours,
            });
            createdOrders.push({
              id: record.id,
              analystId: order.analyst.id,
              status: order.status,
              priority: order.priority,
              providerIndex: order.providerIndex,
            });
            orderNumber++;
          }

          const firstAnalyst = orders[0].analyst;
          const occurrenceStatus: OccurrenceStatus =
            statusClass === 'OPEN'
              ? 'ABERTA'
              : statusClass === 'IN_PROGRESS'
                ? 'EM_EXECUCAO'
                : 'ENCERRADA';
          const allClosedAt =
            createdOrderData
              .map((item) => item.closedAt)
              .filter((value): value is Date => value !== null)
              .sort((a, b) => b.getTime() - a.getTime())[0] || null;
          const occurrence = await tx.occurrence.create({
            data: {
              tenantId: tenant.id,
              customerId,
              number: `${occurrencePrefix}${String(occurrenceNumber).padStart(3, '0')}`,
              provider: provider.tradeName,
              type: orders.map((order) => order.template.type).join(' + '),
              status: occurrenceStatus,
              sector: sectors[groupIndex % sectors.length],
              origin: 'DEMONSTRAÇÃO',
              openedByName: 'Demonstração Ajust',
              analystResponsible: firstAnalyst.name,
              description:
                `DEMONSTRAÇÃO — atendimento sintético para ${provider.tradeName}. ` +
                `Este registro reúne ${orders.length} O.S. relacionadas; não é uma ocorrência real.`,
              sourceSystem: 'ERP',
              externalId: null,
              sourceMetadata: asJson({ demonstration: true, scenarioId, scenarioPeriodDays: 120 }),
              closedAt: allClosedAt,
              createdAt: occurrenceCreatedAt,
              updatedAt:
                allClosedAt ||
                hoursAfter(
                  occurrenceCreatedAt,
                  Math.min(24, Math.max(1, occurrenceAgeDays(groupIndex))),
                ),
            },
            select: { id: true, number: true },
          });
          occurrenceNumber++;

          // The first service order is created without an occurrence relation
          // because the occurrence ID is generated above; link all orders now.
          for (let localIndex = 0; localIndex < createdOrderData.length; localIndex++) {
            const data = createdOrderData[localIndex];
            const order = orders[localIndex];
            await tx.serviceOrder.update({
              where: { id: data.id },
              data: { occurrenceId: occurrence.id },
            });

            if (order.status !== 'ABERTA') {
              await tx.serviceOrderStatusEvent.create({
                data: {
                  tenantId: tenant.id,
                  serviceOrderId: data.id,
                  fromStatus: 'ABERTA',
                  toStatus: 'EM_ANALISE',
                  actorUserId: null,
                  reason: 'DEMONSTRAÇÃO: etapa de triagem simulada.',
                  metadata: asJson({ demonstration: true, scenarioId }),
                  createdAt: hoursAfter(data.createdAt, 0.5),
                },
              });
              statusEventCount++;
            }
            if (order.status === 'AG_CAMPO' || order.status === 'AG_TERCEIROS') {
              await tx.serviceOrderStatusEvent.create({
                data: {
                  tenantId: tenant.id,
                  serviceOrderId: data.id,
                  fromStatus: 'EM_ANALISE',
                  toStatus: order.status,
                  actorUserId: null,
                  reason: `DEMONSTRAÇÃO: encaminhamento simulado para ${order.status === 'AG_CAMPO' ? 'agenda técnica' : 'dependência externa'}.`,
                  metadata: asJson({ demonstration: true, scenarioId }),
                  createdAt: hoursAfter(data.createdAt, 1.25),
                },
              });
              statusEventCount++;
            }
            if (order.status === 'FECHADA') {
              await tx.serviceOrderStatusEvent.createMany({
                data: [
                  {
                    tenantId: tenant.id,
                    serviceOrderId: data.id,
                    fromStatus: 'EM_ANALISE',
                    toStatus: 'RESOLVIDA',
                    actorUserId: null,
                    reason: 'DEMONSTRAÇÃO: resultado técnico simulado registrado.',
                    metadata: asJson({ demonstration: true, scenarioId }),
                    createdAt: data.resolvedAt!,
                  },
                  {
                    tenantId: tenant.id,
                    serviceOrderId: data.id,
                    fromStatus: 'RESOLVIDA',
                    toStatus: 'FECHADA',
                    actorUserId: null,
                    reason: 'DEMONSTRAÇÃO: encerramento simulado para apresentação.',
                    metadata: asJson({ demonstration: true, scenarioId }),
                    createdAt: data.closedAt!,
                  },
                ],
              });
              statusEventCount += 2;
            }

            const noteMessages = [
              'DEMONSTRAÇÃO: triagem e escopo técnico registrados para apresentação.',
              ...(order.status === 'FECHADA'
                ? [`DEMONSTRAÇÃO: ${order.template.resolution} Encerramento simulado.`]
                : order.status === 'ABERTA'
                  ? ['DEMONSTRAÇÃO: aguardando início do atendimento no cenário.']
                  : ['DEMONSTRAÇÃO: análise em andamento; próxima atualização simulada.']),
            ];
            for (let noteIndex = 0; noteIndex < noteMessages.length; noteIndex++) {
              const noteAt =
                order.status === 'FECHADA' && noteIndex === 1
                  ? data.closedAt!
                  : hoursAfter(data.createdAt, noteIndex === 0 ? 0.2 : 1.5);
              await tx.serviceOrderOccurrence.create({
                data: {
                  serviceOrderId: data.id,
                  actorUserId: null,
                  sourceSystem: 'ERP',
                  externalId: null,
                  sourceAuthorName: 'Cenário de demonstração',
                  message: noteMessages[noteIndex],
                  isCustomerVisible: true,
                  createdAt: noteAt,
                },
              });
              noteCount++;
            }

            const durationEnd =
              data.closedAt ||
              (order.status === 'ABERTA'
                ? hoursAfter(data.createdAt, 0.75)
                : hoursAfter(data.createdAt, 2));
            const timeSlices =
              order.status === 'FECHADA'
                ? [45, 65, 35]
                : order.status === 'ABERTA'
                  ? [20]
                  : [35, 50];
            for (let sliceIndex = 0; sliceIndex < timeSlices.length; sliceIndex++) {
              const loggedAt =
                order.status === 'FECHADA'
                  ? hoursAfter(
                      data.createdAt,
                      Math.min(
                        (data.durationHours * (sliceIndex + 1)) / (timeSlices.length + 1),
                        Math.max(0.2, data.durationHours - 0.1),
                      ),
                    )
                  : new Date(
                      Math.min(
                        hoursAfter(data.createdAt, sliceIndex + 1).getTime(),
                        durationEnd.getTime(),
                      ),
                    );
              await tx.timeEntry.create({
                data: {
                  tenantId: tenant.id,
                  orderId: data.id,
                  userId: order.analyst.id,
                  minutes: timeSlices[sliceIndex],
                  description: `DEMONSTRAÇÃO: apontamento simulado (${sliceIndex + 1}/${timeSlices.length}).`,
                  billable: false,
                  loggedAt,
                  createdAt: loggedAt,
                },
              });
              timeEntryCount++;
            }

            const referenceEnd = data.closedAt || now;
            const breached = data.deadlineAt < referenceEnd;
            await tx.slaEvent.create({
              data: {
                tenantId: tenant.id,
                serviceOrderId: data.id,
                deadlineAt: data.deadlineAt,
                breachedAt: breached ? referenceEnd : null,
                delayMinutes: breached
                  ? Math.max(
                      1,
                      Math.floor((referenceEnd.getTime() - data.deadlineAt.getTime()) / 60000),
                    )
                  : 0,
                snapshotStatus: order.status,
                createdAt: data.createdAt,
              },
            });
            slaEventCount++;

            if (order.status === 'AG_CAMPO') {
              const startAt = hoursAfter(now, 24 + order.providerIndex * 2 + localIndex);
              await tx.calendarEvent.create({
                data: {
                  tenantId: tenant.id,
                  title: `DEMO · Atendimento técnico · ${provider.tradeName}`,
                  description:
                    'DEMONSTRAÇÃO: janela de agenda simulada; confirmar antes de tratar como compromisso real.',
                  type: 'OUTRO',
                  isGlobal: false,
                  startAt,
                  endAt: hoursAfter(startAt, 1),
                  allDay: false,
                  location:
                    [provider.address.cidade, provider.address.uf].filter(Boolean).join(' / ') ||
                    null,
                  color: '#3b82f6',
                  createdById: null,
                  assigneeId: order.analyst.id,
                  serviceOrderId: data.id,
                  occurrenceId: occurrence.id,
                  createdAt: now,
                  updatedAt: now,
                },
              });
              calendarCount++;
            }
          }

          const occurrenceMessages = [
            `DEMONSTRAÇÃO: atendimento criado para ${provider.tradeName}; ${orders.length} O.S. vinculada(s) neste grupo.`,
            statusClass === 'CLOSED'
              ? 'DEMONSTRAÇÃO: todas as O.S. desta ocorrência foram encerradas no cenário.'
              : statusClass === 'IN_PROGRESS'
                ? 'DEMONSTRAÇÃO: acompanhamento em curso; as ordens seguem independentes dentro da ocorrência.'
                : 'DEMONSTRAÇÃO: ocorrência aberta aguardando avanço das ordens vinculadas.',
          ];
          for (let noteIndex = 0; noteIndex < occurrenceMessages.length; noteIndex++) {
            await tx.occurrenceAnnotation.create({
              data: {
                tenantId: tenant.id,
                occurrenceId: occurrence.id,
                actorUserId: null,
                message: occurrenceMessages[noteIndex],
                isCustomerVisible: true,
                createdAt:
                  noteIndex === 1 && allClosedAt
                    ? allClosedAt
                    : hoursAfter(occurrenceCreatedAt, noteIndex + 1),
              },
            });
            occurrenceNoteCount++;
          }
        }
      }

      const insertedOrders = await tx.serviceOrder.findMany({
        where: { tenantId: tenant.id, protocol: { startsWith: orderPrefix } },
        select: { assigneeUserId: true, status: true },
      });
      const insertedOccurrences = await tx.occurrence.count({
        where: { tenantId: tenant.id, number: { startsWith: occurrencePrefix } },
      });
      const actualCounts = analysts.map((analyst) => {
        const assigned = insertedOrders.filter((order) => order.assigneeUserId === analyst.id);
        return {
          name: analyst.name,
          open: assigned.filter((order) => order.status === 'ABERTA').length,
          inProgress: assigned.filter((order) =>
            ['EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'].includes(order.status),
          ).length,
          closed: assigned.filter((order) => order.status === 'FECHADA').length,
        };
      });
      if (
        insertedOrders.length !== 60 ||
        insertedOccurrences !== plan.occurrenceCount ||
        actualCounts.some((row) => row.open !== 5 || row.inProgress !== 5 || row.closed !== 10)
      )
        throw new Error(
          `Conferência pós-carga falhou: ${JSON.stringify({ orders: insertedOrders.length, occurrences: insertedOccurrences, actualCounts })}`,
        );

      return {
        importedCustomers,
        orders: insertedOrders.length,
        occurrences: insertedOccurrences,
        orderNotes: noteCount,
        occurrenceNotes: occurrenceNoteCount,
        statusEvents: statusEventCount,
        timeEntries: timeEntryCount,
        slaSnapshots: slaEventCount,
        calendarEvents: calendarCount,
        analysts: actualCounts,
      };
    },
    { maxWait: 15000, timeout: 120000 },
  );

  console.log(JSON.stringify({ status: 'CREATED', scenarioId, ...result }, null, 2));
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
