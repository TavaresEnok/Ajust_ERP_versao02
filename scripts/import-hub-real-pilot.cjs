#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SOURCE_BACKUP_PATH =
  process.env.SOURCE_BACKUP_PATH || '/home/app/projects/hub_ajust/backup.sql';
const TARGET_TENANT_SLUG = process.env.TENANT_SLUG || 'ajust-demo';
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 30);
const WINDOW_MODE = String(process.env.WINDOW_MODE || 'per-provider-latest').toLowerCase();
const RESET_SCOPE = String(process.env.RESET_SCOPE || 'all').toLowerCase();
const DRY_RUN =
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' || process.env.DRY_RUN === '1';

const PROVIDER_SPECS = [
  { label: 'Meganet', token: 'meganet' },
  { label: 'UltraFibra', token: 'ultrafibra' },
  { label: 'MaximaNet', token: 'maximanet' },
];

const DEFAULT_PASSWORD_HASH =
  process.env.MIGRATION_PASSWORD_HASH ||
  '$2b$12$JG2D4XySh45ABuSokxeb/upLPGXxRjnJtvI3ap/0Hp6pozrACmaGy';

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function decodeCopyValue(value) {
  if (value === '\\N') return null;

  let decoded = String(value);
  decoded = decoded.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  decoded = decoded.replace(/\\([\\btnrfv])/g, (_, c) => {
    if (c === '\\') return '\\';
    if (c === 'b') return '\b';
    if (c === 't') return '\t';
    if (c === 'n') return '\n';
    if (c === 'r') return '\r';
    if (c === 'f') return '\f';
    if (c === 'v') return '\v';
    return c;
  });
  return decoded;
}

function parseBackupSql(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let section = null;
  const tenants = [];
  const orders = [];
  const orderNotes = [];

  for (const line of lines) {
    if (!section) {
      if (line.startsWith('COPY public.tenants ')) {
        section = 'tenants';
      } else if (line.startsWith('COPY public.service_orders ')) {
        section = 'service_orders';
      } else if (line.startsWith('COPY public.service_occurrences ')) {
        section = 'service_occurrences';
      }
      continue;
    }

    if (line === '\\.') {
      section = null;
      continue;
    }

    if (!line) continue;

    const cols = line.split('\t').map(decodeCopyValue);

    if (section === 'tenants' && cols.length >= 3) {
      tenants.push({
        id: cols[0],
        name: cols[1],
        slug: cols[2],
      });
      continue;
    }

    if (section === 'service_orders' && cols.length >= 15) {
      orders.push({
        id: cols[0],
        tenantId: cols[1],
        protocol: cols[2],
        status: cols[3],
        deadline: parseDate(cols[4]),
        description: cols[5] || '',
        createdAt: parseDate(cols[6]),
        updatedAt: parseDate(cols[7]),
        trackingHash: cols[8],
        technicianName: cols[9],
        clientName: cols[10],
        serviceType: cols[11],
        sgpStatus: cols[12],
        startedAt: parseDate(cols[13]),
        closedAt: parseDate(cols[14]),
      });
      continue;
    }

    if (section === 'service_occurrences' && cols.length >= 6) {
      orderNotes.push({
        id: cols[0],
        orderId: cols[1],
        externalId: cols[2],
        content: cols[3] || '',
        userName: cols[4],
        createdAt: parseDate(cols[5]),
      });
    }
  }

  return { tenants, orders, orderNotes };
}

function pickBestSourceTenantId(provider, tenantRows, orderCountByTenantId) {
  const candidates = tenantRows.filter((tenant) => {
    const normalized = normalizeText(`${tenant.name} ${tenant.slug}`);
    return normalized.includes(provider.token);
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const countA = orderCountByTenantId.get(a.id) || 0;
    const countB = orderCountByTenantId.get(b.id) || 0;
    return countB - countA;
  });

  return candidates[0].id;
}

function ensureUnique(base, usedSet) {
  const trimmed = String(base || '').trim() || 'item';
  if (!usedSet.has(trimmed)) {
    usedSet.add(trimmed);
    return trimmed;
  }

  let i = 2;
  while (usedSet.has(`${trimmed}-${i}`)) i += 1;
  const finalValue = `${trimmed}-${i}`;
  usedSet.add(finalValue);
  return finalValue;
}

function normalizeAnalystName(value) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) return null;
  if (normalizeText(name) === 'chamados_em_espera') return null;
  return name;
}

function toOrderType(serviceType, description) {
  const value = normalizeText(`${serviceType || ''} ${description || ''}`);
  if (/romp/.test(value)) return 'ROMPIMENTO';
  if (/lent|latenc|intermit|instabil/.test(value)) return 'LENTIDAO';
  if (/onu|ont|olt/.test(value)) return 'CONFIGURACAO_ONU';
  if (/senha|password/.test(value)) return 'TROCA_SENHA';
  if (/cancel/.test(value)) return 'CANCELAMENTO';
  if (/ativ|instal/.test(value)) return 'INSTALACAO';
  if (/bgp|rota/.test(value)) return 'BGP';
  return 'AUDITORIA';
}

function toPriority(serviceType, description) {
  const value = normalizeText(`${serviceType || ''} ${description || ''}`);
  if (/romp|inoperant|indispon|fora|ddos|ataque/.test(value)) return 'CRITICA';
  if (/lent|latenc|intermit|instabil|perda/.test(value)) return 'ALTA';
  if (/informa|monitora|diagrama|auditoria/.test(value)) return 'BAIXA';
  return 'NORMAL';
}

function toOrderStatus(order) {
  const status = normalizeText(order.status);
  const sgpStatus = normalizeText(order.sgpStatus);

  if (
    order.closedAt ||
    status.includes('closed') ||
    sgpStatus.includes('encerrad') ||
    sgpStatus.includes('fechad')
  ) {
    return 'FECHADA';
  }
  if (status.includes('cancel') || sgpStatus.includes('cancel')) return 'CANCELADA';
  if (status.includes('open') || sgpStatus.includes('abert')) return 'ABERTA';
  if (sgpStatus.includes('pend')) return 'AG_TERCEIROS';
  if (sgpStatus.includes('exec')) return 'EM_ANALISE';
  return 'EM_ANALISE';
}

function toOccurrenceStatus(orderStatus) {
  if (orderStatus === 'FECHADA' || orderStatus === 'CANCELADA') return 'ENCERRADA';
  if (orderStatus === 'ABERTA') return 'ABERTA';
  if (orderStatus === 'AG_TERCEIROS') return 'PENDENTE';
  return 'EM_EXECUCAO';
}

function toAnalystEmail(name, usedEmails) {
  const base =
    normalizeText(name)
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 40) || 'analista';

  let candidate = `${base}@migracao.ajust.local`;
  let i = 2;
  while (usedEmails.has(candidate)) {
    candidate = `${base}.${i}@migracao.ajust.local`;
    i += 1;
  }
  usedEmails.add(candidate);
  return candidate;
}

function pickDate(order) {
  return order.createdAt || order.startedAt || order.updatedAt || order.closedAt || new Date();
}

async function main() {
  const absoluteBackupPath = path.resolve(SOURCE_BACKUP_PATH);
  if (!fs.existsSync(absoluteBackupPath)) {
    throw new Error(`Backup file not found: ${absoluteBackupPath}`);
  }
  if (!Number.isFinite(WINDOW_DAYS) || WINDOW_DAYS <= 0) {
    throw new Error(`Invalid WINDOW_DAYS: ${WINDOW_DAYS}`);
  }
  if (!['per-provider-latest', 'global-latest', 'now'].includes(WINDOW_MODE)) {
    throw new Error(`Invalid WINDOW_MODE: ${WINDOW_MODE}`);
  }
  if (!['all', 'providers'].includes(RESET_SCOPE)) {
    throw new Error(`Invalid RESET_SCOPE: ${RESET_SCOPE}`);
  }

  const { tenants, orders, orderNotes } = parseBackupSql(absoluteBackupPath);

  const orderCountByTenantId = new Map();
  for (const order of orders) {
    orderCountByTenantId.set(order.tenantId, (orderCountByTenantId.get(order.tenantId) || 0) + 1);
  }

  const sourceTenantByProvider = new Map();
  for (const provider of PROVIDER_SPECS) {
    const sourceTenantId = pickBestSourceTenantId(provider, tenants, orderCountByTenantId);
    if (!sourceTenantId) {
      throw new Error(`Source tenant not found in backup for provider token: ${provider.token}`);
    }
    sourceTenantByProvider.set(provider.label, sourceTenantId);
  }

  const providerBySourceTenantId = new Map();
  for (const [providerName, sourceTenantId] of sourceTenantByProvider.entries()) {
    providerBySourceTenantId.set(sourceTenantId, providerName);
  }

  const sourceOrders = orders
    .filter((order) => providerBySourceTenantId.has(order.tenantId))
    .map((order) => ({
      ...order,
      provider: providerBySourceTenantId.get(order.tenantId),
      effectiveCreatedAt: pickDate(order),
    }));

  if (!sourceOrders.length) {
    throw new Error('No source service orders found for selected providers.');
  }

  const providerWindows = new Map();
  if (WINDOW_MODE === 'global-latest') {
    const globalEnd = new Date(
      Math.max(...sourceOrders.map((order) => order.effectiveCreatedAt.getTime())),
    );
    const globalStart = new Date(globalEnd.getTime() - WINDOW_DAYS * DAY_MS);
    for (const provider of PROVIDER_SPECS) {
      providerWindows.set(provider.label, { start: globalStart, end: globalEnd });
    }
  } else if (WINDOW_MODE === 'now') {
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
    for (const provider of PROVIDER_SPECS) {
      providerWindows.set(provider.label, { start, end });
    }
  } else {
    for (const provider of PROVIDER_SPECS) {
      const providerOrders = sourceOrders.filter((order) => order.provider === provider.label);
      if (!providerOrders.length) continue;
      const end = new Date(
        Math.max(...providerOrders.map((order) => order.effectiveCreatedAt.getTime())),
      );
      const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
      providerWindows.set(provider.label, { start, end });
    }
  }

  const selectedOrders = sourceOrders
    .filter((order) => {
      const window = providerWindows.get(order.provider);
      if (!window) return false;
      const created = order.effectiveCreatedAt.getTime();
      return created >= window.start.getTime() && created <= window.end.getTime();
    })
    .sort((a, b) => a.effectiveCreatedAt.getTime() - b.effectiveCreatedAt.getTime());

  if (!selectedOrders.length) {
    throw new Error('No orders found after applying provider/date filters.');
  }

  const selectedOrderIds = new Set(selectedOrders.map((order) => order.id));
  const notesByOrderId = new Map();
  for (const note of orderNotes) {
    if (!selectedOrderIds.has(note.orderId)) continue;
    const list = notesByOrderId.get(note.orderId) || [];
    list.push(note);
    notesByOrderId.set(note.orderId, list);
  }
  for (const list of notesByOrderId.values()) {
    list.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  const targetTenant = await prisma.tenant.findUnique({
    where: { slug: TARGET_TENANT_SLUG },
    select: { id: true, slug: true },
  });
  if (!targetTenant) {
    throw new Error(`Target tenant not found: ${TARGET_TENANT_SLUG}`);
  }

  const analystRole = await prisma.role.findUnique({
    where: { code: 'analista' },
    select: { id: true },
  });
  if (!analystRole) {
    throw new Error('Role "analista" not found. Run role seed first.');
  }

  const analystNames = new Set();
  for (const order of selectedOrders) {
    const analyst = normalizeAnalystName(order.technicianName);
    if (analyst) analystNames.add(analyst);
    const notes = notesByOrderId.get(order.id) || [];
    for (const note of notes) {
      const actor = normalizeAnalystName(note.userName);
      if (actor) analystNames.add(actor);
    }
  }

  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((row) => row.email.toLowerCase()),
  );
  const userIdByAnalystKey = new Map();

  if (!DRY_RUN) {
    for (const analystName of [...analystNames].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      const email = toAnalystEmail(analystName, existingEmails);
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: analystName,
          status: 'ACTIVE',
          passwordHash: DEFAULT_PASSWORD_HASH,
        },
        create: {
          name: analystName,
          email,
          passwordHash: DEFAULT_PASSWORD_HASH,
          status: 'ACTIVE',
          twoFactorEnabled: false,
        },
        select: { id: true, name: true },
      });

      await prisma.userTenant.upsert({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: targetTenant.id,
          },
        },
        update: { roleId: analystRole.id },
        create: {
          userId: user.id,
          tenantId: targetTenant.id,
          roleId: analystRole.id,
        },
      });

      userIdByAnalystKey.set(normalizeText(analystName), user.id);
    }
  }

  if (!DRY_RUN) {
    if (RESET_SCOPE === 'all') {
      await prisma.serviceOrder.deleteMany({ where: { tenantId: targetTenant.id } });
      await prisma.occurrenceAnnotation.deleteMany({ where: { tenantId: targetTenant.id } });
      await prisma.occurrence.deleteMany({ where: { tenantId: targetTenant.id } });
    } else {
      const occurrenceIds = (
        await prisma.occurrence.findMany({
          where: {
            tenantId: targetTenant.id,
            provider: { in: PROVIDER_SPECS.map((provider) => provider.label) },
          },
          select: { id: true },
        })
      ).map((row) => row.id);

      if (occurrenceIds.length) {
        await prisma.serviceOrder.deleteMany({
          where: { tenantId: targetTenant.id, occurrenceId: { in: occurrenceIds } },
        });
        await prisma.occurrenceAnnotation.deleteMany({
          where: { tenantId: targetTenant.id, occurrenceId: { in: occurrenceIds } },
        });
        await prisma.occurrence.deleteMany({
          where: { tenantId: targetTenant.id, id: { in: occurrenceIds } },
        });
      }
    }
  }

  const existingOrderProtocols = new Set(
    (
      await prisma.serviceOrder.findMany({
        where: { tenantId: targetTenant.id },
        select: { protocol: true },
      })
    ).map((row) => row.protocol),
  );
  const existingOccurrenceNumbers = new Set(
    (
      await prisma.occurrence.findMany({
        where: { tenantId: targetTenant.id },
        select: { number: true },
      })
    ).map((row) => row.number),
  );

  const perProviderCounts = new Map(PROVIDER_SPECS.map((provider) => [provider.label, 0]));
  let createdOccurrences = 0;
  let createdOrders = 0;
  let createdOrderTimelineEvents = 0;
  let createdOccurrenceAnnotations = 0;

  for (const order of selectedOrders) {
    const orderStatus = toOrderStatus(order);
    const occurrenceStatus = toOccurrenceStatus(orderStatus);
    const orderType = toOrderType(order.serviceType, order.description);
    const priority = toPriority(order.serviceType, order.description);
    const createdAt = order.effectiveCreatedAt;
    const deadlineAt = order.deadline || new Date(createdAt.getTime() + DAY_MS);
    const closedAt = order.closedAt || (orderStatus === 'FECHADA' ? createdAt : null);

    const analystName = normalizeAnalystName(order.technicianName) || 'Analista';
    const analystKey = normalizeText(analystName);
    const analystUserId = userIdByAnalystKey.get(analystKey) || null;

    const occurrenceNumber = ensureUnique(`HUB-${order.protocol}`, existingOccurrenceNumbers);
    const serviceOrderProtocol = ensureUnique(
      String(order.protocol || occurrenceNumber),
      existingOrderProtocols,
    );

    const orderDescription = String(order.description || '').trim() || 'Sem descricao no Hub.';
    const orderTitle = `${order.provider} - ${String(order.serviceType || 'Chamado')}`.slice(
      0,
      190,
    );
    const occurrenceDescription =
      orderDescription.length > 400 ? `${orderDescription.slice(0, 397)}...` : orderDescription;

    if (DRY_RUN) {
      createdOccurrences += 1;
      createdOrders += 1;
      perProviderCounts.set(order.provider, (perProviderCounts.get(order.provider) || 0) + 1);
      const noteList = notesByOrderId.get(order.id) || [];
      createdOccurrenceAnnotations += noteList.length;
      createdOrderTimelineEvents += 1 + noteList.length;
      continue;
    }

    const createdOccurrence = await prisma.occurrence.create({
      data: {
        tenantId: targetTenant.id,
        number: occurrenceNumber,
        provider: order.provider,
        type: String(order.serviceType || 'Chamado Hub').slice(0, 190),
        status: occurrenceStatus,
        sector: 'NOC',
        origin: 'Hub SGP',
        openedByName: analystName,
        analystResponsible: analystName,
        description: occurrenceDescription,
        createdAt,
      },
      select: { id: true },
    });
    createdOccurrences += 1;

    const createdOrder = await prisma.serviceOrder.create({
      data: {
        tenantId: targetTenant.id,
        occurrenceId: createdOccurrence.id,
        protocol: serviceOrderProtocol,
        externalProtocol: String(order.protocol || ''),
        sourceSystem: 'SGP',
        type: orderType,
        priority,
        status: orderStatus,
        title: orderTitle,
        description: orderDescription,
        ownerUserId: analystUserId,
        ownerName: analystName,
        assigneeUserId: analystUserId,
        analystName: analystName,
        requester: order.clientName || order.provider,
        sector: 'NOC',
        origin: 'Hub SGP',
        deadlineAt,
        resolvedAt: orderStatus === 'FECHADA' ? closedAt : null,
        closedAt: orderStatus === 'FECHADA' ? closedAt : null,
        createdAt,
        internalNotes: `Migrado do Hub (tenant=${order.tenantId} sourceOrder=${order.id} trackingHash=${order.trackingHash || '-'})`,
      },
      select: { id: true },
    });
    createdOrders += 1;
    perProviderCounts.set(order.provider, (perProviderCounts.get(order.provider) || 0) + 1);

    await prisma.serviceOrderOccurrence.create({
      data: {
        serviceOrderId: createdOrder.id,
        actorUserId: analystUserId,
        sourceSystem: 'SGP',
        message: `O.S migrada do Hub (sourceOrder=${order.id}).`,
        createdAt,
      },
    });
    createdOrderTimelineEvents += 1;

    const noteList = notesByOrderId.get(order.id) || [];
    for (const note of noteList) {
      const actorName = normalizeAnalystName(note.userName);
      const actorUserId = actorName
        ? userIdByAnalystKey.get(normalizeText(actorName)) || null
        : null;
      const noteCreatedAt = note.createdAt || createdAt;
      const message = String(note.content || '').trim() || 'Atualizacao sem conteudo no Hub.';

      await prisma.occurrenceAnnotation.create({
        data: {
          tenantId: targetTenant.id,
          occurrenceId: createdOccurrence.id,
          actorUserId,
          message,
          createdAt: noteCreatedAt,
        },
      });
      createdOccurrenceAnnotations += 1;

      await prisma.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: createdOrder.id,
          actorUserId,
          sourceSystem: 'SGP',
          message,
          createdAt: noteCreatedAt,
        },
      });
      createdOrderTimelineEvents += 1;
    }
  }

  const providersWindowSummary = {};
  for (const provider of PROVIDER_SPECS) {
    const window = providerWindows.get(provider.label);
    providersWindowSummary[provider.label] = window
      ? {
          start: window.start.toISOString(),
          end: window.end.toISOString(),
          selectedOrders: perProviderCounts.get(provider.label) || 0,
          sourceTenantId: sourceTenantByProvider.get(provider.label),
        }
      : {
          start: null,
          end: null,
          selectedOrders: 0,
          sourceTenantId: sourceTenantByProvider.get(provider.label),
        };
  }

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        targetTenant: targetTenant.slug,
        backupPath: absoluteBackupPath,
        providers: PROVIDER_SPECS.map((provider) => provider.label),
        window: {
          mode: WINDOW_MODE,
          days: WINDOW_DAYS,
        },
        resetScope: RESET_SCOPE,
        source: {
          totalOrdersRead: orders.length,
          totalNotesRead: orderNotes.length,
          selectedOrders: selectedOrders.length,
          selectedAnalysts: analystNames.size,
        },
        created: {
          occurrences: createdOccurrences,
          serviceOrders: createdOrders,
          serviceOrderTimelineEvents: createdOrderTimelineEvents,
          occurrenceAnnotations: createdOccurrenceAnnotations,
        },
        providerWindows: providersWindowSummary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
