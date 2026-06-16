import { CalendarService } from './calendar.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    calendarEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'e1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn().mockResolvedValue({ id: 'e1' }),
      delete: jest.fn().mockResolvedValue({ id: 'e1' }),
    },
    userTenant: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ userId: 'u1' }),
    },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1' }),
    },
    occurrence: {
      findFirst: jest.fn().mockResolvedValue({ id: 'oc1' }),
    },
    changeRequest: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
  };
  for (const k of Object.keys(overrides)) {
    if (typeof overrides[k] === 'object' && !('mockReturnValue' in overrides[k])) {
      base.calendarEvent[k] = { ...base.calendarEvent[k], ...overrides[k] };
    } else {
      base.calendarEvent[k] = overrides[k];
    }
  }
  return base;
}

describe('CalendarService.listEvents', () => {
  it('filtra por tenant + janela temporal', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.listEvents({ tenantId: 't1', from: '2025-01-01', to: '2025-01-31' });
    const where = prisma.calendarEvent.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.startAt).toBeDefined();
  });

  it('adiciona OR (global OR assignee=user) quando userId é fornecido', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.listEvents({ tenantId: 't1', userId: 'u1' });
    const where = prisma.calendarEvent.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
  });
});

describe('CalendarService.listAllEvents', () => {
  it('filtra por assigneeId quando fornecido', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.listAllEvents({ tenantId: 't1', assigneeId: 'u1' });
    const where = prisma.calendarEvent.findMany.mock.calls[0][0].where;
    expect(where.assigneeId).toBe('u1');
  });

  it('filtra por isGlobal quando assigneeId=global', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.listAllEvents({ tenantId: 't1', assigneeId: 'global' });
    const where = prisma.calendarEvent.findMany.mock.calls[0][0].where;
    expect(where.isGlobal).toBe(true);
  });
});

describe('CalendarService.listTenantUsers', () => {
  it('retorna usuários do tenant com role', async () => {
    const prisma = makePrisma();
    prisma.userTenant.findMany.mockResolvedValueOnce([
      {
        user: { id: 'u1', name: 'Ana', email: 'a@x', status: 'ACTIVE' },
        role: { code: 'ADMIN', name: 'Admin' },
      },
    ]);
    const svc = new CalendarService(prisma);
    const users = await svc.listTenantUsers('t1');
    expect(users[0]).toMatchObject({ id: 'u1', role: 'ADMIN' });
  });

  it('default role para ANALYST quando sem role', async () => {
    const prisma = makePrisma();
    prisma.userTenant.findMany.mockResolvedValueOnce([
      {
        user: { id: 'u1', name: 'Ana', email: 'a@x', status: 'ACTIVE' },
        role: null,
      },
    ]);
    const svc = new CalendarService(prisma);
    const users = await svc.listTenantUsers('t1');
    expect(users[0].role).toBe('ANALYST');
  });
});

describe('CalendarService.checkConflict', () => {
  it('retorna hasConflict=true quando há eventos conflitantes', async () => {
    const prisma = makePrisma();
    prisma.calendarEvent.findMany.mockResolvedValueOnce([{ id: 'e1' }]);
    const svc = new CalendarService(prisma);
    const result = await svc.checkConflict(
      't1',
      'u1',
      new Date('2025-01-01T10:00:00Z'),
      new Date('2025-01-01T11:00:00Z'),
    );
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingEvents).toHaveLength(1);
  });

  it('retorna hasConflict=false quando não há eventos', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    const result = await svc.checkConflict('t1', 'u1', new Date(), new Date());
    expect(result.hasConflict).toBe(false);
  });
});

describe('CalendarService.create', () => {
  it('cria evento com type=OUTRO por default', async () => {
    const prisma = makePrisma();
    prisma.calendarEvent.findMany.mockResolvedValueOnce([]);
    const svc = new CalendarService(prisma);
    await svc.create('t1', 'u1', { title: 'Reunião', startAt: '2025-01-01T10:00:00Z' });
    const data = prisma.calendarEvent.create.mock.calls[0][0].data;
    expect(data.type).toBe('OUTRO');
    expect(data.color).toBe('#3b82f6');
    expect(data.assigneeId).toBe('u1');
  });

  it('lança ConflictException quando há conflito (não-skip)', async () => {
    const prisma = makePrisma();
    prisma.calendarEvent.findMany.mockResolvedValueOnce([{ id: 'e1' }]);
    const svc = new CalendarService(prisma);
    await expect(
      svc.create('t1', 'u1', { title: 'X', startAt: '2025-01-01T10:00:00Z', assigneeId: 'u2' }),
    ).rejects.toThrow(/Conflict/);
  });

  it('pula checagem de conflito quando skipConflictCheck=true', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.create(
      't1',
      'u1',
      { title: 'X', startAt: '2025-01-01T10:00:00Z', assigneeId: 'u2' },
      true,
    );
    expect(prisma.calendarEvent.create).toHaveBeenCalled();
  });

  it('rejeita referência de ordem pertencente a outro tenant', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null);
    const svc = new CalendarService(prisma);
    await expect(
      svc.create(
        't1',
        'u1',
        { title: 'X', startAt: '2025-01-01T10:00:00Z', serviceOrderId: 'foreign' },
        true,
      ),
    ).rejects.toThrow('não pertence a este tenant');
  });
});

describe('CalendarService.update', () => {
  it('lança NotFoundException se evento não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new CalendarService(prisma);
    await expect(svc.update('e1', 't1', 'u1', 'gerente', { title: 'X' })).rejects.toThrow(
      'Evento não encontrado',
    );
  });

  it('atualiza apenas campos fornecidos', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    await svc.update('e1', 't1', 'u1', 'gerente', { title: 'Novo' });
    const data = prisma.calendarEvent.update.mock.calls[0][0].data;
    expect(data).toEqual({ title: 'Novo' });
  });
});

describe('CalendarService.remove', () => {
  it('deleta e retorna { deleted: true }', async () => {
    const prisma = makePrisma();
    const svc = new CalendarService(prisma);
    const result = await svc.remove('e1', 't1', 'u1', 'gerente');
    expect(result).toEqual({ deleted: true });
  });

  it('impede usuário comum de remover evento de outra pessoa', async () => {
    const prisma = makePrisma();
    prisma.calendarEvent.findFirst.mockResolvedValueOnce({
      id: 'e1',
      tenantId: 't1',
      createdById: 'u2',
      isGlobal: false,
    });
    const svc = new CalendarService(prisma);
    await expect(svc.remove('e1', 't1', 'u1', 'analista')).rejects.toThrow('seus próprios eventos');
  });
});
