import { IxcReconciliationService } from './ixc-reconciliation.service';

function makePrisma(): any {
  return {
    providerIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    syncEvent: { create: jest.fn().mockResolvedValue({}) },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    slaPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    businessCalendar: { findMany: jest.fn().mockResolvedValue([]) },
    businessCalendarException: { findUnique: jest.fn().mockResolvedValue(null) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    $queryRaw: jest.fn().mockResolvedValue([{ max: 100007 }]),
  };
}

describe('IxcReconciliationService', () => {
  afterEach(() => {
    delete process.env.IXC_MOCK_RECONCILE;
  });

  it('finishes cleanly when no active integrations exist', async () => {
    const service = new IxcReconciliationService(makePrisma());
    await service.runOnce();
    expect(service.getStatus()).toEqual(
      expect.objectContaining({ running: false, lastProcessed: 0, lastRunAt: expect.any(String) }),
    );
  });

  it('filters inactive integrations and processes active integration in mock mode', async () => {
    process.env.IXC_MOCK_RECONCILE = 'true';
    const prisma = makePrisma();
    prisma.providerIntegration.findMany.mockResolvedValue([
      {
        id: 'inactive',
        tenantId: 'tenant-1',
        status: 'INACTIVE',
        baseUrl: 'https://ixc.local',
        apiTokenEnc: null,
        lastSyncAt: null,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      {
        id: 'active',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        baseUrl: 'https://ixc.local',
        apiTokenEnc: null,
        lastSyncAt: null,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
    ]);
    const service = new IxcReconciliationService(prisma);

    await service.runOnce();

    expect(prisma.syncEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ integrationId: 'active', status: 'PROCESSED' }),
    });
    expect(prisma.providerIntegration.update).toHaveBeenCalledWith({
      where: { id: 'active' },
      data: { lastSyncAt: expect.any(Date) },
    });
    expect(service.getStatus()).toEqual(
      expect.objectContaining({ lastErrors: 0, lastProcessed: 0 }),
    );
  });

  it('delegates mutations to the internal API and refuses errors without local writes', async () => {
    const previous = process.env.WORKER_API_TOKEN;
    process.env.WORKER_API_TOKEN = 'test-only-worker-token';
    const originalFetch = global.fetch;
    try {
      const prisma = makePrisma();
      const service = new IxcReconciliationService(prisma) as any;
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ applied: true }) });
      const delta = { externalProtocol: 'EXT', type: 'DNS', status: 'closed' };
      await expect(service.applyDelta('tenant-1', delta)).resolves.toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/integrations/ixc/internal/delta'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tenantId: 'tenant-1', delta }),
          headers: expect.objectContaining({ Authorization: 'Bearer test-only-worker-token' }),
        }),
      );
      expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
      await expect(service.applyDelta('tenant-1', delta)).rejects.toThrow('503');
      await expect(service.applyDelta('tenant-1', {})).resolves.toBe(false);
      delete process.env.WORKER_API_TOKEN;
      await expect(service.applyDelta('tenant-1', delta)).rejects.toThrow('WORKER_API_TOKEN');
    } finally {
      global.fetch = originalFetch;
      if (previous === undefined) delete process.env.WORKER_API_TOKEN;
      else process.env.WORKER_API_TOKEN = previous;
    }
  });
});
