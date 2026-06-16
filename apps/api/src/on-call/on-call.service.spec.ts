import { OnCallService } from './on-call.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    onCallSchedule: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 's1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      delete: jest.fn().mockResolvedValue({ id: 's1' }),
    },
    userTenant: {
      findFirst: jest.fn().mockResolvedValue({ userId: 'u1' }),
    },
  };
  for (const k of Object.keys(overrides)) base.onCallSchedule[k] = overrides[k];
  return base;
}

describe('OnCallService.list', () => {
  it('filtra por tenant + janela temporal', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    await svc.list('t1', '2025-01-01', '2025-01-31');
    const where = prisma.onCallSchedule.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      tenantId: 't1',
      startsAt: { lte: new Date('2025-01-31') },
      endsAt: { gte: new Date('2025-01-01') },
    });
  });

  it('apenas filtra por tenant quando sem janela', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    await svc.list('t1');
    const where = prisma.onCallSchedule.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.startsAt).toBeUndefined();
  });
});

describe('OnCallService.currentOnCall', () => {
  it('busca schedule ativo no momento atual', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    await svc.currentOnCall('t1');
    const where = prisma.onCallSchedule.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.startsAt).toBeDefined();
    expect(where.endsAt).toBeDefined();
  });
});

describe('OnCallService.create', () => {
  it('converte startsAt/endsAt para Date', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    await svc.create('t1', {
      userId: 'u1',
      startsAt: '2025-01-01T00:00:00Z',
      endsAt: '2025-01-02T00:00:00Z',
    });
    const data = prisma.onCallSchedule.create.mock.calls[0][0].data;
    expect(data.startsAt).toBeInstanceOf(Date);
    expect(data.endsAt).toBeInstanceOf(Date);
  });

  it('rejeita usuário que não pertence ao tenant', async () => {
    const prisma = makePrisma();
    prisma.userTenant.findFirst.mockResolvedValueOnce(null);
    const svc = new OnCallService(prisma);
    await expect(
      svc.create('t1', {
        userId: 'foreign-user',
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: '2025-01-02T00:00:00Z',
      }),
    ).rejects.toThrow('not a member');
  });

  it('exige usuário ativo no tenant', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    await svc.create('t1', {
      userId: 'u1',
      startsAt: '2025-01-01T00:00:00Z',
      endsAt: '2025-01-02T00:00:00Z',
    });
    expect(prisma.userTenant.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        tenantId: 't1',
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { userId: true },
    });
  });

  it('rejeita intervalo invertido', async () => {
    const svc = new OnCallService(makePrisma());
    await expect(
      svc.create('t1', {
        userId: 'u1',
        startsAt: '2025-01-02T00:00:00Z',
        endsAt: '2025-01-01T00:00:00Z',
      }),
    ).rejects.toThrow('término após o início');
  });
});

describe('OnCallService.remove', () => {
  it('lança NotFoundException se não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new OnCallService(prisma);
    await expect(svc.remove('t1', 's1')).rejects.toThrow('Schedule not found');
  });

  it('deleta e retorna success', async () => {
    const prisma = makePrisma();
    const svc = new OnCallService(prisma);
    const result = await svc.remove('t1', 's1');
    expect(result).toEqual({ success: true });
  });
});
