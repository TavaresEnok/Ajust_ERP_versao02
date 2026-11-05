import { UnauthorizedException } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';

describe('MonitoringController (Zabbix, C-044)', () => {
  const token = 'monitoring-token-for-tests';
  let prisma: any;
  let orders: any;
  let controller: MonitoringController;

  beforeEach(() => {
    process.env.MONITORING_WEBHOOK_TOKEN = token;
    prisma = {
      tenant: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'ajust-demo' }) },
      occurrence: { findUnique: jest.fn().mockResolvedValue(null) },
      knowledgeCredential: { findFirst: jest.fn().mockResolvedValue({ provider: 'Meganet' }) },
      customer: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'cust-1', tradeName: 'Meganet', legalName: 'Meganet Ltda' }),
      },
    };
    orders = {
      createOccurrenceWithFirstOrder: jest.fn().mockResolvedValue({ id: 'occ-1' }),
      resolveFromIntegration: jest.fn().mockResolvedValue(['2026100010']),
    };
    controller = new MonitoringController(prisma, orders);
  });

  afterEach(() => {
    delete process.env.MONITORING_WEBHOOK_TOKEN;
  });

  const call = (payload: Record<string, unknown>) =>
    controller.handleZabbixWebhook(`Bearer ${token}`, 'ajust-demo', payload);

  it('rejeita token inválido', async () => {
    await expect(
      controller.handleZabbixWebhook('Bearer invalid', 'ajust-demo', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('retorna "no tenant" para tenant desconhecido', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);
    await expect(call({ eventName: 'Down' })).resolves.toEqual({ status: 'no tenant' });
  });

  it('abre o atendimento pelo fluxo normal, com provedor achado pelo host', async () => {
    const result = await call({
      eventId: 991,
      eventName: 'Link down',
      host: 'bng-01.meganet',
      severity: 'Disaster',
    });
    expect(result).toMatchObject({ success: true, occurrenceId: 'occ-1', provider: 'Meganet' });
    expect(orders.createOccurrenceWithFirstOrder).toHaveBeenCalledWith(
      null,
      'gerente',
      expect.objectContaining({
        customerId: 'cust-1',
        sourceSystem: 'WEBHOOK',
        externalId: 'zabbix:991',
        firstOrder: expect.objectContaining({ priority: 'CRITICA' }),
      }),
    );
  });

  it('repetição do mesmo problema não abre outro chamado', async () => {
    prisma.occurrence.findUnique.mockResolvedValue({ id: 'occ-1', number: 'N', status: 'ABERTA' });
    await expect(call({ eventId: 991, eventName: 'Link down' })).resolves.toEqual({
      status: 'duplicate',
      occurrenceId: 'occ-1',
    });
    expect(orders.createOccurrenceWithFirstOrder).not.toHaveBeenCalled();
  });

  it('recuperação resolve a O.S. do problema', async () => {
    prisma.occurrence.findUnique.mockResolvedValue({ id: 'occ-1', number: 'N', status: 'ABERTA' });
    await expect(call({ eventId: 991, status: 'RESOLVED', host: 'bng-01' })).resolves.toMatchObject(
      {
        status: 'resolved',
        resolved: ['2026100010'],
      },
    );
    expect(orders.resolveFromIntegration).toHaveBeenCalledWith(
      'tenant-1',
      'occ-1',
      expect.stringContaining('recuperação'),
    );
  });

  it('sem host conhecido, abre sem provedor vinculado', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(null);
    const result = await call({ eventName: 'CPU alta', host: 'desconhecido' });
    expect(result).toMatchObject({ provider: 'NOC / ZABBIX' });
  });
});
