/** Remove only the audited E2E/homologation fixtures left beside the demo data. */
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tenantSlug = 'ajust-demo';
const demoPrefix = `DEMO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-`;
const testProtocols = [
  '2026100044',
  '2026100042',
  '2026100041',
  '2026100040',
  '2026100039',
  '2026100038',
  '2026100037',
  '2026100036',
  '2026100034',
  '2026100033',
  '2026100032',
  '2026100030',
  '2026100029',
  '2026100028',
  '2026100026',
  '2026100025',
  '2026100024',
  '2026100022',
  '2026100021',
  '2026100020',
  '2026100018',
  '2026100017',
  '2026100016',
  '2026100014',
  '2026100013',
  '2026100012',
  '2026100010',
  '2026100009',
  '2026100008',
  '2026100006',
  '2026100005',
  '2026100004',
  '2026100003',
  '2026100002',
  '2026100001',
];

async function main() {
  if (!process.argv.includes('--execute'))
    throw new Error('Informe --execute após conferir o backup.');
  if (!process.env.AJUST_SGP_PURGE_BACKUP_VERIFIED?.startsWith('pg_dump+uploads:'))
    throw new Error('Backup integral validado é obrigatório antes da limpeza.');

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });
  const testOrders = await prisma.serviceOrder.findMany({
    where: { tenantId: tenant.id, sourceSystem: 'ERP', protocol: { in: testProtocols } },
    select: {
      id: true,
      protocol: true,
      title: true,
      occurrenceId: true,
      processInstanceId: true,
      parentOrderId: true,
      rootOrderId: true,
    },
  });
  if (testOrders.length !== testProtocols.length)
    throw new Error(
      `Escopo de fixtures mudou: esperava ${testProtocols.length}, encontrei ${testOrders.length}.`,
    );
  if (testOrders.some((order) => order.protocol.startsWith(demoPrefix)))
    throw new Error('O protocolo de uma demonstração apareceu no conjunto de exclusão.');

  const occurrenceNumbers = Array.from(
    { length: 10 },
    (_, index) => `20262600${String(10 - index).padStart(2, '0')}`,
  );
  const testOccurrences = await prisma.occurrence.findMany({
    where: { tenantId: tenant.id, number: { in: occurrenceNumbers }, customerId: null },
    select: { id: true, number: true },
  });
  if (testOccurrences.length !== occurrenceNumbers.length)
    throw new Error(
      `Escopo de ocorrências mudou: esperava ${occurrenceNumbers.length}, encontrei ${testOccurrences.length}.`,
    );

  const orderIds = testOrders.map((order) => order.id);
  const occurrenceIds = testOccurrences.map((occurrence) => occurrence.id);
  const storageKeys = (
    await prisma.serviceOrderAttachment.findMany({
      where: { serviceOrderId: { in: orderIds } },
      select: { storageKey: true },
    })
  ).map((attachment) => attachment.storageKey);
  const processRows = await prisma.serviceProcessInstance.findMany({
    where: {
      tenantId: tenant.id,
      OR: [{ rootOrderId: { in: orderIds } }, { occurrenceId: { in: occurrenceIds } }],
    },
    select: { id: true },
  });
  const processIds = processRows.map((process) => process.id);
  const childIds = (
    await prisma.serviceOrder.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { processInstanceId: { in: processIds } },
          { parentOrderId: { in: orderIds } },
          { rootOrderId: { in: orderIds } },
        ],
      },
      select: { id: true },
    })
  ).map((order) => order.id);
  const allOrderIds = [...new Set([...orderIds, ...childIds])];

  await prisma.$transaction(
    async (tx) => {
      for (const report of await tx.shiftReport.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, orderIds: true },
      })) {
        const current = Array.isArray(report.orderIds) ? report.orderIds : [];
        const remaining = current.filter(
          (value) => typeof value !== 'string' || !allOrderIds.includes(value),
        );
        if (remaining.length !== current.length)
          await tx.shiftReport.update({ where: { id: report.id }, data: { orderIds: remaining } });
      }
      await tx.auditLog.deleteMany({
        where: {
          tenantId: tenant.id,
          resourceId: { in: [...allOrderIds, ...occurrenceIds, ...processIds] },
        },
      });
      await tx.calendarEvent.deleteMany({
        where: {
          tenantId: tenant.id,
          OR: [{ serviceOrderId: { in: allOrderIds } }, { occurrenceId: { in: occurrenceIds } }],
        },
      });
      if (allOrderIds.length)
        await tx.serviceOrder.updateMany({
          where: {
            OR: [
              { id: { in: allOrderIds } },
              { parentOrderId: { in: allOrderIds } },
              { rootOrderId: { in: allOrderIds } },
              { processInstanceId: { in: processIds } },
            ],
          },
          data: {
            processInstanceId: null,
            processNodeId: null,
            parentOrderId: null,
            rootOrderId: null,
          },
        });
      if (processIds.length)
        await tx.serviceProcessInstance.deleteMany({ where: { id: { in: processIds } } });
      await tx.serviceOrder.deleteMany({ where: { id: { in: allOrderIds } } });
      await tx.occurrence.deleteMany({ where: { id: { in: occurrenceIds } } });
    },
    { timeout: 60000 },
  );

  const uploadsRoot = resolve(process.cwd(), 'uploads');
  let attachmentsDeleted = 0;
  for (const storageKey of storageKeys) {
    const prefix = '/tmp/ajust_uploads/';
    if (!storageKey.startsWith(prefix)) throw new Error(`Anexo fora da raiz: ${storageKey}`);
    const target = resolve(uploadsRoot, storageKey.slice(prefix.length));
    if (!target.startsWith(`${uploadsRoot}${sep}`))
      throw new Error(`Caminho inválido: ${storageKey}`);
    if (existsSync(target)) {
      unlinkSync(target);
      attachmentsDeleted++;
    }
  }

  const remainingFixtures = await prisma.serviceOrder.count({
    where: { tenantId: tenant.id, protocol: { in: testProtocols } },
  });
  const demoProcessIds = (
    await prisma.serviceProcessInstance.findMany({
      where: { tenantId: tenant.id, engineVersion: 2, state: { path: ['mode'], equals: 'DEMO' } },
      select: { id: true },
    })
  ).map((process) => process.id);
  const remainingDemoOrders = await prisma.serviceOrder.count({
    where: {
      tenantId: tenant.id,
      OR: [{ protocol: { startsWith: demoPrefix } }, { processInstanceId: { in: demoProcessIds } }],
    },
  });
  if (remainingFixtures || remainingDemoOrders !== 6)
    throw new Error('Validação final dos exemplos falhou.');

  console.log(
    JSON.stringify(
      {
        status: 'READY',
        testOrdersDeleted: allOrderIds.length,
        testOccurrencesDeleted: occurrenceIds.length,
        processesDeleted: processIds.length,
        attachmentFilesDeleted: attachmentsDeleted,
        demoOrdersPreserved: remainingDemoOrders,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
