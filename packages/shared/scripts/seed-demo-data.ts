import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Popula dados de demonstração (assets, change requests, calendar events,
 * time entries, on-call) no tenant `ajust-demo`. Idempotente — usa `upsert`
 * com chaves determinísticas onde possível.
 *
 * Pré-requisito: rodar `pnpm db:seed:dev-admin` e `pnpm db:seed:demo-users`.
 *
 * Variáveis de ambiente opcionais:
 *   SEED_DEMO_DRY_RUN=1 — apenas imprime o que seria criado
 */
async function main() {
  const dryRun = process.env.SEED_DEMO_DRY_RUN === '1';
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'ajust-demo' } });
  if (!tenant) {
    throw new Error('Tenant ajust-demo não encontrado. Rode db:seed:dev-admin antes.');
  }

  const analyst = await prisma.user.findFirst({
    where: { email: 'analista@ajust.local' },
  });
  if (!analyst) {
    throw new Error('Usuário analista@ajust.local não encontrado.');
  }

  console.log(`[seed-demo-data] tenant=${tenant.id} dryRun=${dryRun}`);

  // 1) Assets (CMDB) — 4 itens com mix de categoria/status
  const assetsData = [
    {
      name: 'Switch Core 01',
      category: 'SWITCH',
      status: 'ATIVO',
      vendor: 'Cisco',
      tags: ['core', 'datacenter'],
    },
    {
      name: 'Roteador Borda 01',
      category: 'ROTEADOR',
      status: 'ATIVO',
      vendor: 'Mikrotik',
      tags: ['edge', 'pop-sp'],
    },
    {
      name: 'Servidor Auth',
      category: 'SERVIDOR',
      status: 'MANUTENCAO',
      vendor: 'Dell',
      tags: ['auth', 'linux'],
    },
    {
      name: 'Link Transit SP→RJ',
      category: 'LINK_TRANSIT',
      status: 'ATIVO',
      vendor: 'Telecom-X',
      tags: ['transit', 'sp-rj'],
    },
  ] as const;

  for (const a of assetsData) {
    if (dryRun) {
      console.log(`  [skip] asset: ${a.name}`);
      continue;
    }
    const existing = await prisma.asset.findFirst({
      where: { tenantId: tenant.id, name: a.name, deletedAt: null },
    });
    if (existing) {
      console.log(`  [exists] asset: ${a.name}`);
      continue;
    }
    await prisma.asset.create({
      data: { tenantId: tenant.id, ...a, createdById: analyst.id, tags: [...a.tags] },
    });
    console.log(`  [created] asset: ${a.name}`);
  }

  // 2) Change Requests — 3 com estados diferentes
  const changes = [
    {
      number: 'RFC-DEMO-0001',
      title: 'Atualização firmware switch core',
      risk: 'ALTO',
      status: 'RASCUNHO',
    },
    {
      number: 'RFC-DEMO-0002',
      title: 'Substituição roteador borda',
      risk: 'CRITICO',
      status: 'APROVADO',
    },
    {
      number: 'RFC-DEMO-0003',
      title: 'Renovação link transit',
      risk: 'MEDIO',
      status: 'CONCLUIDO',
    },
  ] as const;

  for (const c of changes) {
    if (dryRun) {
      console.log(`  [skip] change: ${c.number}`);
      continue;
    }
    const existing = await prisma.changeRequest.findFirst({
      where: { tenantId: tenant.id, number: c.number },
    });
    if (existing) {
      console.log(`  [exists] change: ${c.number}`);
      continue;
    }
    await prisma.changeRequest.create({
      data: {
        tenantId: tenant.id,
        number: c.number,
        title: c.title,
        description: `Change request de demonstração: ${c.title}`,
        justification: 'Manutenção programada',
        risk: c.risk,
        status: c.status,
        affectedSystems: ['network'],
        tags: ['demo'],
        requestedById: analyst.id,
      },
    });
    console.log(`  [created] change: ${c.number}`);
  }

  // 3) Calendar events — 2 próximos
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = [
    { title: 'Reunião de planning', startAt: tomorrow, type: 'REUNIAO' as const, allDay: false },
    { title: 'Plantão programado', startAt: nextWeek, type: 'PLANTAO' as const, allDay: true },
  ];

  for (const e of events) {
    if (dryRun) {
      console.log(`  [skip] event: ${e.title}`);
      continue;
    }
    const existing = await prisma.calendarEvent.findFirst({
      where: { tenantId: tenant.id, title: e.title, startAt: e.startAt },
    });
    if (existing) {
      console.log(`  [exists] event: ${e.title}`);
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        title: e.title,
        type: e.type,
        isGlobal: true,
        startAt: e.startAt,
        allDay: e.allDay,
        color: '#3b82f6',
        createdById: analyst.id,
      },
    });
    console.log(`  [created] event: ${e.title}`);
  }

  // 4) On-call schedule — uma janela de 24h
  if (dryRun) {
    console.log('  [skip] oncall');
  } else {
    const oncallStart = new Date(now.getTime() + 60 * 60 * 1000);
    const oncallEnd = new Date(oncallStart.getTime() + 24 * 60 * 60 * 1000);
    const existing = await prisma.onCallSchedule.findFirst({
      where: { tenantId: tenant.id, userId: analyst.id, startsAt: oncallStart },
    });
    if (existing) {
      console.log('  [exists] oncall');
    } else {
      await prisma.onCallSchedule.create({
        data: {
          tenantId: tenant.id,
          userId: analyst.id,
          startsAt: oncallStart,
          endsAt: oncallEnd,
          notes: 'Plantão de demonstração',
        },
      });
      console.log('  [created] oncall');
    }
  }

  console.log('[seed-demo-data] done');
}

main()
  .catch((err) => {
    console.error('[seed-demo-data] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
