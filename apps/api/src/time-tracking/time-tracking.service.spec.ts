import { TimeTrackingService } from './time-tracking.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    timeEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'te1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'te1' }),
      delete: jest.fn().mockResolvedValue({ id: 'te1' }),
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
    prisma.timeEntry.findMany.mockResolvedValueOnce([
      { id: 'e1', userId: 'u1', minutes: 30, billable: true, user: { name: 'Ana' } },
      { id: 'e2', userId: 'u1', minutes: 60, billable: true, user: { name: 'Ana' } },
      { id: 'e3', userId: 'u2', minutes: 45, billable: false, user: { name: 'Bob' } },
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
