require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { SlaEngineService } from '../apps/api/src/sla/sla-engine.service';
import { OperationalProcessesService } from '../apps/api/src/service-processes/operational-processes.service';
import { OrderOperationsService } from '../apps/api/src/service-orders/order-operations.service';
const db = new PrismaService();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const tenantId = tenant.id;
  const manager = await db.userTenant.findFirstOrThrow({ where: { tenantId, role: { code: 'gerente' }, user: { status: 'ACTIVE' } } });
  const processes = new OperationalProcessesService(db, { executeForEvent: async () => undefined } as never);
  const service = new OrderOperationsService(db, new SlaEngineService(db), processes);
  const paused = await db.serviceOrder.findFirstOrThrow({ where: { tenantId, protocol: { startsWith: 'DEMO-120D-' }, status: 'EM_ANALISE' } });
  const night = await db.serviceOrder.findFirstOrThrow({ where: { tenantId, protocol: 'DEMO-20261023-BGP-001' } });
  if (!process.argv.includes('--execute')) { console.log(JSON.stringify({ pauseExample: paused.protocol, nightExample: night.protocol })); return; }
  if (!process.env.AJUST_OPERATIONS_BACKUP) throw new Error('Backup obrigatório.');
  if (!paused.pausedAt) await service.run(tenantId, manager.userId, 'gerente', paused.id, { action: 'pause', expectedVersion: paused.version, reason: 'DEMONSTRAÇÃO · Aguardando o provedor disponibilizar acesso ao equipamento. Retomar após recebimento.' });
  const local = new Date(Date.now()-3*3600000);
  local.setUTCDate(local.getUTCDate() + ((6-local.getUTCDay()+7)%7 || 7));
  local.setUTCHours(2,0,0,0);
  if (!night.scheduledAt) await service.run(tenantId, manager.userId, 'gerente', night.id, { action: 'schedule', expectedVersion: night.version, scheduledAt: new Date(local.getTime()+3*3600000).toISOString(), reason: 'DEMONSTRAÇÃO · Janela do plantão noturno: acompanhar a alteração, validar sessões e conectividade.', change: { impact: 'DEMONSTRAÇÃO · Interrupção temporária durante alteração do trânsito.', rollbackPlan: 'DEMONSTRAÇÃO · Restaurar configuração anterior e validar anúncios e conectividade.' } });
  const scheduled = await db.serviceOrder.findFirst({ where: { tenantId, protocol: { startsWith: 'DEMO-120D-' }, status: 'AG_CAMPO' } });
  if (scheduled && !scheduled.scheduledAt) {
    const time = new Date(Date.now()-3600000);
    await db.serviceOrder.update({ where: { id: scheduled.id }, data: { scheduledAt: time, handoffNotes: 'DEMONSTRAÇÃO · Configuração preparada; conferir os testes e registrar o início da execução combinada.' } });
    await db.calendarEvent.updateMany({ where: { tenantId, serviceOrderId: scheduled.id }, data: { startAt: time, endAt: null } });
  }
  const oldTemplates = await db.serviceProcessTemplate.findMany({ where: { tenantId, code: { in: ['ATEND_6BE2A3A112','ATEND_6CDCD6F25B','ATEND_C29DBB5214'] } } });
  for (const old of oldTemplates) if (!(await db.serviceProcessInstance.count({ where: { tenantId, templateCode: old.code } }))) await db.serviceProcessTemplate.delete({ where: { id: old.id } });
  await db.serviceCatalogItem.deleteMany({ where: { tenantId, name: { in: ['DEMONSTRAÇÃO · Verificação de DNS','DEMONSTRAÇÃO · Configuração OLT','DEMONSTRAÇÃO · Mudança BGP / Trânsito'] } } });
  console.log(JSON.stringify({ pauseExample: paused.protocol, nightExample: night.protocol, scheduledSaturday: new Date(local.getTime()+3*3600000).toISOString(), retiredPrototypeTemplates: oldTemplates.length }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
