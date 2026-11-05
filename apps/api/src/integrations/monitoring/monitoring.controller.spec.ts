import { UnauthorizedException } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';

describe('MonitoringController (Zabbix, C-044)', () => {
  const token = 'monitoring-token-for-tests';
  let prisma: any;
  let orders: any;
  let apiKeys: any;
  let redis: any;
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
    prisma.occurrence.update = jest.fn();
    apiKeys = { validateKey: jest.fn().mockResolvedValue(null) };
    redis = { incrEx: jest.fn().mockResolvedValue(1) };
    controller = new MonitoringController(prisma, orders, apiKeys, redis);
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

  it('chave de API do tenant dispensa o cabeçalho x-tenant-slug', async () => {
    apiKeys.validateKey.mockResolvedValue({ tenantId: 'tenant-1', keyId: 'k1' });
    await controller.handleZabbixWebhook('Bearer ajust_chave', '', { eventName: 'Down' });
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'tenant-1' }),
    });
  });

  it('limite de alertas por minuto por tenant', async () => {
    redis.incrEx.mockResolvedValue(121);
    await expect(call({ eventName: 'Down' })).rejects.toMatchObject({ status: 429 });
    expect(orders.createOccurrenceWithFirstOrder).not.toHaveBeenCalled();
  });

  it('problema que volta depois de encerrado mantém a deduplicação', async () => {
    prisma.occurrence.findUnique.mockResolvedValue({ id: 'old', number: 'N', status: 'ENCERRADA' });
    await call({ eventId: 991, eventName: 'Link down' });
    expect(prisma.occurrence.update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: { externalId: expect.stringMatching(/^zabbix:991#encerrada-/) },
    });
    expect(orders.createOccurrenceWithFirstOrder.mock.calls[0][2]).toMatchObject({
      externalId: 'zabbix:991',
    });
  });
});
