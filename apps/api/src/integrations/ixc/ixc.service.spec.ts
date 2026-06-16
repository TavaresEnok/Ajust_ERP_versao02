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
