require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
import { PrismaClient } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { basename } from 'node:path';
const db = new PrismaClient();
async function main() {
  const [action, token] = process.argv.slice(2);
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) throw new Error('Token de teste inválido.');
  const marker = `analyst-review:${token}`;
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  if (action === 'prepare') {
    const customer = await db.customer.create({ data: {
      tenantId: tenant.id, taxId: `REVIEW-${token}`, tradeName: `CLIENTE DE VERIFICAÇÃO ${token.slice(0, 8)}`,
      legalName: 'Cliente temporário de verificação do analista', personType: 'JURIDICA',
      sourceMetadata: { reviewToken: token },
    } });
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit' }).format(new Date());
    await db.calendarEvent.create({ data: {
      tenantId: tenant.id, title: marker + ' compartilhado', isGlobal: true,
      startAt: new Date(month + '-25T12:13:00Z'), endAt: new Date(month + '-25T12:43:00Z'),
    } });
    console.log(JSON.stringify({ customerId: customer.id, name: customer.tradeName, marker }));
    return;
  }
  if (action !== 'cleanup') throw new Error('Ação inválida.');
  const files = await db.$transaction(async tx => {
    const customer = await tx.customer.findFirstOrThrow({ where: { tenantId: tenant.id, taxId: `REVIEW-${token}` } });
    if ((customer.sourceMetadata as any).reviewToken !== token) throw new Error('Não é uma fixture deste teste.');
    const occurrences = await tx.occurrence.findMany({ where: { customerId: customer.id }, include: { serviceOrders: { include: { attachments: true } } } });
    if (occurrences.some(o => !o.description.includes(marker) || o.serviceOrders.some(s => !s.description.includes(marker))))
      throw new Error('Fixture recebeu dados não reconhecidos; limpeza cancelada.');
    const occurrenceIds = occurrences.map(o => o.id), orderIds = occurrences.flatMap(o => o.serviceOrders.map(s => s.id));
    const processes = await tx.serviceProcessInstance.findMany({ where: { occurrenceId: { in: occurrenceIds } }, select: { id: true } });
    const processIds = processes.map(p => p.id);
    if (await tx.serviceOrder.count({ where: { processInstanceId: { in: processIds }, id: { notIn: orderIds } } }))
      throw new Error('Processo compartilhado com registros externos ao teste.');
    const attachments = occurrences.flatMap(o => o.serviceOrders.flatMap(s => s.attachments.map(a => ({ ...a, orderId: s.id }))));
    if (attachments.some(a => a.fileName !== `review-${token}.txt` || !a.storageKey.includes(`/service-orders/${a.orderId}/`) || !/^[0-9]+_[0-9a-f-]+\.txt$/i.test(basename(a.storageKey))))
      throw new Error('Anexo não reconhecido; limpeza cancelada.');
    await tx.calendarEvent.deleteMany({ where: { tenantId: tenant.id, OR: [{ serviceOrderId: { in: orderIds } }, { title: { startsWith: marker } }] } });
    await tx.shiftReport.deleteMany({ where: { tenantId: tenant.id, content: { contains: marker } } });
    await tx.note.deleteMany({ where: { tenantId: tenant.id, content: { contains: marker } } });
    await tx.serviceOrder.updateMany({ where: { id: { in: orderIds } }, data: { processInstanceId: null, rootOrderId: null, parentOrderId: null } });
    await tx.serviceProcessInstance.deleteMany({ where: { id: { in: processIds } } });
    await tx.serviceOrder.deleteMany({ where: { id: { in: orderIds } } });
    await tx.occurrence.deleteMany({ where: { id: { in: occurrenceIds } } });
    await tx.customer.delete({ where: { id: customer.id } });
    return attachments.map(a => a.storageKey);
  });
  for (const path of files) await unlink(path);
  console.log('Registros temporários desta verificação removidos; dados anteriores e auditoria preservados.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
