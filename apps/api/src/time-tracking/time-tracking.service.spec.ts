import { TimeTrackingService } from './time-tracking.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    timeEntry: {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { minutes: 135 } }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'te1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'te1' }),
      delete: jest.fn().mockResolvedValue({ id: 'te1' }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'u1', name: 'Ana' },
        { id: 'u2', name: 'Bob' },
      ]),
    },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1', tenantId: 't1' }),
    },
  };
  for (const k of Object.keys(overrides)) base.timeEntry[k] = overrides[k];
  return base;
}

describe('TimeTrackingService.listByOrder', () => {
  it('lista entries por tenant + orderId', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.listByOrder('t1', 'o1');
    const where = prisma.timeEntry.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ tenantId: 't1', orderId: 'o1' });
  });
});

describe('TimeTrackingService.listByTenant', () => {
  it('filtra por janela temporal quando fornecida', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.listByTenant('t1', '2025-01-01', '2025-01-31');
    const where = prisma.timeEntry.findMany.mock.calls[0][0].where;
    expect(where.loggedAt).toBeDefined();
  });
});

describe('TimeTrackingService.create', () => {
  it('lança NotFoundException se OS não existe', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null);
    const svc = new TimeTrackingService(prisma);
    await expect(svc.create('t1', 'u1', { orderId: 'o1', minutes: 30 })).rejects.toThrow(
      'Order not found',
    );
  });

  it('arredonda minutos para inteiro >= 1', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.create('t1', 'u1', { orderId: 'o1', minutes: 30.7 });
    const data = prisma.timeEntry.create.mock.calls[0][0].data;
    expect(data.minutes).toBe(31);
    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith({
      where: { id: 'o1', tenantId: 't1', deletedAt: null },
    });
  });

  it('força minutes mínimo de 1', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.create('t1', 'u1', { orderId: 'o1', minutes: 0 });
    const data = prisma.timeEntry.create.mock.calls[0][0].data;
    expect(data.minutes).toBe(1);
  });

  it('billable default = true', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.create('t1', 'u1', { orderId: 'o1', minutes: 30 });
    const data = prisma.timeEntry.create.mock.calls[0][0].data;
    expect(data.billable).toBe(true);
  });
});

describe('TimeTrackingService.remove', () => {
  it('lança NotFoundException se entry não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new TimeTrackingService(prisma);
    await expect(svc.remove('t1', 'te1', 'u1', 'analista')).rejects.toThrow('Time entry not found');
  });
});

describe('TimeTrackingService.summary', () => {
  it('agrega minutos por usuário', async () => {
    const prisma = makePrisma();
    prisma.timeEntry.groupBy.mockResolvedValueOnce([
      { userId: 'u1', billable: true, _sum: { minutes: 90 } },
      { userId: 'u2', billable: false, _sum: { minutes: 45 } },
    ]);
    const svc = new TimeTrackingService(prisma);
    const summary = await svc.summary('t1');
    expect(summary.totalMinutes).toBe(135);
    expect(summary.billableMinutes).toBe(90);
    const u1 = summary.byUser.find((u: any) => u.id === 'u1')!;
    expect(u1.minutes).toBe(90);
    expect(u1.billable).toBe(90);
    const u2 = summary.byUser.find((u: any) => u.id === 'u2')!;
    expect(u2.minutes).toBe(45);
    expect(u2.billable).toBe(0);
  });

  it('retorna zeros quando não há entries', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    const summary = await svc.summary('t1');
    expect(summary.totalMinutes).toBe(0);
    expect(summary.billableMinutes).toBe(0);
    expect(summary.byUser).toEqual([]);
  });
});

describe('Time entry constraints', () => {
  it('refuses future dates, old analyst entries and closed orders', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await expect(
      svc.create(
        't1',
        'u1',
        { orderId: 'o1', minutes: 30, loggedAt: new Date(Date.now() + 60000).toISOString() },
        'gerente',
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc.create(
        't1',
        'u1',
        { orderId: 'o1', minutes: 30, loggedAt: '2000-01-01T00:00:00Z' },
        'analista',
      ),
    ).rejects.toMatchObject({ status: 403 });
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'FECHADA' });
    await expect(
      svc.create('t1', 'u1', { orderId: 'o1', minutes: 30 }, 'analista'),
    ).rejects.toMatchObject({ status: 403 });
    await svc.create('t1', 'u1', { orderId: 'o1', minutes: 30 }, 'gerente');
    expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
  });
  it('restricts analyst listings and limits every page', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    await svc.listByTenant('t1', undefined, undefined, 'u1', 500, 10);
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', userId: 'u1' }, take: 200, skip: 10 }),
    );
    await svc.summary('t1', 'u1');
    expect(prisma.timeEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', userId: 'u1' } }),
    );
  });
});

describe('Time entry totals', () => {
  it('returns only aggregate minutes, with tenant and live-order scope', async () => {
    const prisma = makePrisma();
    const svc = new TimeTrackingService(prisma);
    expect(await svc.orderTotal('t1', 'o1')).toEqual({ orderId: 'o1', totalMinutes: 135 });
    expect(prisma.timeEntry.aggregate).toHaveBeenCalledWith({
      where: { tenantId: 't1', orderId: 'o1' },
      _sum: { minutes: true },
    });
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(svc.orderTotal('t1', 'other')).rejects.toThrow('O.S. não encontrada');
    expect(prisma.timeEntry.aggregate).toHaveBeenCalledTimes(1);
  });
  it('aggregates only the authenticated analyst in the summary', async () => {
    const prisma = makePrisma();
    await new TimeTrackingService(prisma).summary('t1', 'u1');
    expect(prisma.timeEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', userId: 'u1' } }),
    );
  });
});
