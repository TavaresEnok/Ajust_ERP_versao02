import { IxcService } from './ixc.service';

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'integration-1',
    tenantId: 'tenant-1',
    provider: 'IXC',
    baseUrl: 'https://ixc.example.com',
    webhookSecretEnc: 'encrypted-webhook-secret',
    apiTokenEnc: 'encrypted-api-token',
    status: 'ACTIVE',
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('IxcService.upsertIntegration', () => {
  const slaEngine = {
    findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 8 }),
    calculateTargetDate: jest.fn().mockResolvedValue(new Date('2026-06-05T12:00:00.000Z')),
  };

  it('não expõe segredos criptografados ao criar configuração', async () => {
    const prisma = {
      providerIntegration: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(integration()),
      },
    };
    const service = new IxcService(prisma as any, {} as any, slaEngine as any);

    const result = await service.upsertIntegration({
      tenantId: 'tenant-1',
      baseUrl: 'https://ixc.example.com',
      webhookSecret: 'webhook-secret',
      apiToken: 'api-token',
    });

    expect(result).not.toHaveProperty('webhookSecretEnc');
    expect(result).not.toHaveProperty('apiTokenEnc');
    expect(result).toEqual(
      expect.objectContaining({
        webhookSecretConfigured: true,
        apiTokenConfigured: true,
      }),
    );
  });

  it('não expõe segredos criptografados ao atualizar configuração', async () => {
    const prisma = {
      providerIntegration: {
        findFirst: jest.fn().mockResolvedValue(integration()),
        update: jest
          .fn()
          .mockResolvedValue(integration({ webhookSecretEnc: null, apiTokenEnc: null })),
      },
    };
    const service = new IxcService(prisma as any, {} as any, slaEngine as any);

    const result = await service.upsertIntegration({
      tenantId: 'tenant-1',
      baseUrl: 'https://ixc.example.com',
      status: 'INACTIVE',
    });

    expect(result).not.toHaveProperty('webhookSecretEnc');
    expect(result).not.toHaveProperty('apiTokenEnc');
    expect(result).toEqual(
      expect.objectContaining({
        webhookSecretConfigured: false,
        apiTokenConfigured: false,
      }),
    );
  });
});

describe('IxcService.receiveWebhook — regras do ERP (C-045)', () => {
  const sla = {
    findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 8 }),
    calculateTargetDate: jest.fn().mockResolvedValue(new Date(Date.now() + 86400000)),
  };
  function setup(order: Record<string, unknown>, replay: unknown = null) {
    const prisma: any = {
      providerIntegration: { findFirst: jest.fn().mockResolvedValue(integration()) },
      syncEvent: {
        findFirst: jest.fn().mockResolvedValue(replay),
        create: jest.fn().mockResolvedValue({ id: 'sync-1' }),
        update: jest.fn(),
      },
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
      },
      serviceOrderApproval: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceOrderOccurrence: { create: jest.fn() },
      serviceOrderStatusEvent: { create: jest.fn() },
    };
    const lifecycle = { afterStatusChange: jest.fn() };
    const service = new IxcService(
      prisma,
      { emitTenantEvent: jest.fn() } as any,
      sla as any,
      undefined,
      lifecycle as any,
    );
    jest.spyOn(service as any, 'assertWebhookSignature').mockResolvedValue(undefined);
    return { prisma, lifecycle, service };
  }
  const base = {
    id: 'o1',
    tenantId: 'tenant-1',
    version: 3,
    status: 'EM_ANALISE',
    priority: 'NORMAL',
    requiresApproval: false,
    deadlineAt: new Date(Date.now() + 86400000),
    resolvedAt: null,
    closedAt: null,
    canceledAt: null,
    title: 'T',
    description: 'D',
  };
  const input = (status: string) => ({
    tenantId: 'tenant-1',
    eventType: 'ticket.updated',
    externalProtocol: 'IXC-1',
    status,
    payload: {},
    rawBody: `{"status":"${status}"}`,
  });

  it('reenvio do mesmo corpo é ignorado (replay)', async () => {
    const { service, prisma } = setup(base, { id: 'sync-old' });
    await expect(service.receiveWebhook(input('fechada'))).resolves.toMatchObject({
      duplicate: true,
      processed: false,
    });
    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('fechar pelo IXC grava datas, versão e dispara os efeitos', async () => {
    const { service, prisma, lifecycle } = setup(base);
    await service.receiveWebhook(input('fechada'));
    expect(prisma.serviceOrder.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'o1', version: 3 },
      data: { status: 'FECHADA', closedAt: expect.any(Date), version: { increment: 1 } },
    });
    expect(lifecycle.afterStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'EM_ANALISE', to: 'FECHADA', source: 'integration' }),
    );
  });

  it('reabrir O.S. fechada pelo IXC não é aceito', async () => {
    const { service, prisma, lifecycle } = setup({ ...base, status: 'FECHADA' });
    const result = await service.receiveWebhook(input('aberta'));
    expect((result as any).note).toContain('não é permitido');
    expect(prisma.serviceOrder.updateMany.mock.calls[0][0].data.status).toBeUndefined();
    expect(lifecycle.afterStatusChange).not.toHaveBeenCalled();
  });

  it('crítica atrasada que exige aprovação fica resolvida', async () => {
    const { service, prisma } = setup({
      ...base,
      priority: 'CRITICA',
      requiresApproval: true,
      deadlineAt: new Date(Date.now() - 3600000),
    });
    await service.receiveWebhook(input('fechada'));
    expect(prisma.serviceOrder.updateMany.mock.calls[0][0].data.status).toBe('RESOLVIDA');
  });
});
