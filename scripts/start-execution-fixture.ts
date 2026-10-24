import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const db = new PrismaClient();
const marker = 'start-execution-browser-check';
async function main() {
  const [action, argument] = process.argv.slice(2);
  if (action === 'create') {
    const member = await db.userTenant.findFirstOrThrow({
      where: { tenant: { slug: 'ajust-demo' }, role: { code: 'analista' }, user: { name: 'Anderson Alves', status: 'ACTIVE', deletedAt: null } },
      include: { user: true },
    });
    const result = await db.$transaction(async tx => {
      const occurrence = await tx.occurrence.create({ data: {
        tenantId: member.tenantId, number: `VERIFY-${randomUUID()}`, provider: 'Verificação temporária',
        type: 'DNS', sector: 'NOC', origin: 'Chat', openedByName: member.user.name,
        analystResponsible: member.user.name, description: marker, sourceMetadata: { verification: marker },
      } });
      return tx.serviceOrder.create({ data: {
        tenantId: member.tenantId, occurrenceId: occurrence.id, protocol: `VERIFY-${randomUUID()}`,
        title: 'VERIFICAÇÃO TEMPORÁRIA · início em um clique', description: marker,
        type: 'DNS', priority: 'NORMAL', assigneeUserId: member.userId, analystName: member.user.name,
        ownerUserId: member.userId, deadlineAt: new Date(Date.now() + 86400000),
        isCustomerVisible: false, sourceMetadata: { verification: marker },
      } });
    });
    console.log(JSON.stringify({ id: result.id }));
    return;
  }
  if (!['verify', 'cleanup'].includes(action)) throw new Error('Ação inválida.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(argument || ''))
    throw new Error('Informe o UUID exato da fixture.');
  const id = argument;
  await db.$transaction(async tx => {
    const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id }, include: { occurrence: true } });
    if ((order.sourceMetadata as any).verification !== marker || order.description !== marker || order.occurrence?.description !== marker)
      throw new Error('A operação só aceita a fixture criada por este teste.');
    if (action === 'verify') {
      const history = await tx.serviceOrderOccurrence.count({ where: { serviceOrderId: id, message: 'Execução iniciada.', actorUserId: order.assigneeUserId } });
      const events = await tx.serviceOrderStatusEvent.count({ where: { serviceOrderId: id, fromStatus: 'ABERTA', toStatus: 'EM_ANALISE', actorUserId: order.assigneeUserId } });
      if (order.status !== 'EM_ANALISE' || order.version !== 2 || history !== 1 || events !== 1) throw new Error('Persistência do início não corresponde ao esperado.');
      console.log(JSON.stringify({ status: order.status, version: order.version, history, events }));
    } else {
      if (await tx.serviceOrder.count({ where: { occurrenceId: order.occurrenceId } }) !== 1) throw new Error('Fixture recebeu outras ordens; limpeza cancelada.');
      await tx.serviceOrder.delete({ where: { id } });
      await tx.occurrence.delete({ where: { id: order.occurrenceId! } });
      console.log('Fixture temporária removida; auditoria preservada.');
    }
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
