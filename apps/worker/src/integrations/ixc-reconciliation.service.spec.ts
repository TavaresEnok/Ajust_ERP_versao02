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
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ nextval: 7n }]),
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

  it('maps external values and ignores deltas without protocol', async () => {
    const service = new IxcReconciliationService(makePrisma()) as any;
    expect(service.mapStatus('closed')).toBe('FECHADA');
    expect(service.mapStatus('unknown')).toBeNull();
    expect(service.mapType('bgp')).toBe('BGP');
    expect(service.mapType('unknown')).toBe('AUDITORIA');
    expect(service.mapPriority('critica')).toBe('CRITICA');
    expect(service.mapPriority('unknown')).toBe('NORMAL');
    await expect(service.applyDelta('tenant-1', {})).resolves.toBe(false);
  });

  it('does not apply stale delta to an existing order', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      updatedAt: new Date('2026-06-05T12:00:00.000Z'),
    });
    const service = new IxcReconciliationService(prisma) as any;

    await expect(
      service.applyDelta('tenant-1', {
        externalProtocol: 'EXT-1',
        updatedAt: '2026-06-05T11:00:00.000Z',
      }),
    ).resolves.toBe(false);
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('updates an existing order from a recent delta', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      updatedAt: new Date('2026-06-05T11:00:00.000Z'),
    });
    const service = new IxcReconciliationService(prisma) as any;

    await expect(
      service.applyDelta('tenant-1', {
        externalProtocol: 'EXT-1',
        updatedAt: '2026-06-05T12:00:00.000Z',
        status: 'resolved',
        title: ' Atualizada ',
        description: ' Nova ',
      }),
    ).resolves.toBe(true);
    expect(prisma.serviceOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        sourceSystem: 'SGP',
        status: 'RESOLVIDA',
        title: 'Atualizada',
        description: 'Nova',
      }),
    });
  });

  it('creates a new order using protocol and SLA policy', async () => {
    const prisma = makePrisma();
    prisma.slaPolicy.findMany.mockResolvedValue([
      {
        isOverride: true,
        serviceOrderType: 'ROMPIMENTO',
        priority: 'NORMAL',
        hours: 2,
      },
    ]);
    const service = new IxcReconciliationService(prisma) as any;
    jest
      .spyOn(service, 'calculateTargetDate')
      .mockResolvedValue(new Date('2026-06-05T14:00:00.000Z'));

    await expect(
      service.applyDelta('tenant-1', {
        externalProtocol: 'EXT-2',
        type: 'ROMPIMENTO',
        priority: 'CRITICA',
      }),
    ).resolves.toBe(true);

    expect(prisma.serviceOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        protocol: '2026000007',
        externalProtocol: 'EXT-2',
        type: 'ROMPIMENTO',
        priority: 'CRITICA',
        deadlineAt: new Date('2026-06-05T14:00:00.000Z'),
      }),
    });
  });

  it('selects override, priority and fallback SLA hours', async () => {
    const prisma = makePrisma();
    const service = new IxcReconciliationService(prisma) as any;
    prisma.slaPolicy.findMany.mockResolvedValue([
      { isOverride: true, serviceOrderType: 'BGP', priority: 'BAIXA', hours: 3 },
      { isOverride: false, serviceOrderType: null, priority: 'ALTA', hours: 6 },
    ]);

    await expect(service.findApplicableSlaHours('tenant-1', 'CRITICA', 'BGP')).resolves.toBe(3);
    await expect(service.findApplicableSlaHours('tenant-1', 'ALTA', 'AUDITORIA')).resolves.toBe(6);
    await expect(service.findApplicableSlaHours('tenant-1', 'BAIXA', 'AUDITORIA')).resolves.toBe(
      48,
    );
  });

  it('calculates deadlines on default business calendar and tenant timezone', async () => {
    const prisma = makePrisma();
    const service = new IxcReconciliationService(prisma) as any;

    await expect(
      service.calculateTargetDate(new Date('2026-06-05T17:00:00.000Z'), 2, 'tenant-1'),
    ).resolves.toEqual(new Date('2026-06-08T09:00:00.000Z'));
  });
});
