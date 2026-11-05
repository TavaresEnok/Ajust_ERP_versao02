import { PrismaClient } from '@prisma/client';
import { WebhookController } from './webhook.controller';
import { ServiceOrdersService } from '../service-orders/service-orders.service';
import { SlaEngineService } from '../sla/sla-engine.service';

/**
 * Integração de chat com o serviço REAL de O.S. (auditoria C-043/C-082). Só roda no banco
 * descartável de scripts/test-db.sh (PROCESS_DB_TESTS=1); grava uma ocorrência de teste.
 */
const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Webhook de chat abre atendimento de verdade', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it('cria ocorrência e primeira O.S. para o provedor informado', async () => {
    const customer = await prisma.customer.findFirstOrThrow({ where: { deletedAt: null } });
    const service = new ServiceOrdersService(
      prisma as never,
      { emitTenantEvent: () => undefined } as never,
      new SlaEngineService(prisma as never),
    );
    const controller = new WebhookController(
      service,
      prisma as never,
      {
        validateKey: async () => ({ tenantId: customer.tenantId, keyId: 'k' }),
      } as never,
    );
    const occurrence: any = await controller.handleIncomingChat('Bearer ajust_teste', {
      title: 'Cliente sem navegação (teste de integração)',
      description: 'Aberto pelo teste do webhook de chat.',
      requester: 'ignorado',
      customerId: customer.id,
    });
    expect(occurrence.customerId).toBe(customer.id);
    expect(occurrence.serviceOrders).toHaveLength(1);
    expect(occurrence.serviceOrders[0]).toMatchObject({ status: 'ABERTA', origin: 'CHAT_BOT' });
    expect(occurrence.serviceOrders[0].protocol).toMatch(/^\d{10}$/);
  });
});
