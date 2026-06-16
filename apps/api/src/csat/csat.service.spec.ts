import { CsatService } from './csat.service';
import { EmailService } from '../common/email.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
    satisfactionResponse: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'r1', orderId: 'o1', token: 'tok', answered: false }),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'r1', token: 'tok', tenant: null, order: { protocol: 'OS-001' } }),
      update: jest.fn().mockResolvedValue({ id: 'r1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  for (const k of Object.keys(overrides)) base.satisfactionResponse[k] = overrides[k];
  return base;
}

function makeEmail(): EmailService {
  return { sendEmail: jest.fn() } as any;
}

describe('CsatService.createForOrder', () => {
  it('rejeita ordem que não pertence ao tenant', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null);
    const svc = new CsatService(prisma, makeEmail());
    await expect(svc.createForOrder('t1', 'foreign-order')).rejects.toThrow('Order not found');
    expect(prisma.satisfactionResponse.create).not.toHaveBeenCalled();
  });

  it('retorna pesquisa existente sem duplicar', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce({ id: 'r1' });
    const svc = new CsatService(prisma, makeEmail());
    const result = await svc.createForOrder('t1', 'o1');
    expect(result).toEqual({ id: 'r1' });
    expect(prisma.satisfactionResponse.create).not.toHaveBeenCalled();
  });

  it('envia email se tenant tem techContactEmail', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce(null);
    prisma.satisfactionResponse.create.mockResolvedValueOnce({
      id: 'r1',
      token: 'abc',
      tenant: { techContactEmail: 'tech@acme.com' },
      order: { protocol: 'OS-001' },
    });
    const email = makeEmail();
    const svc = new CsatService(prisma, email);
    const result = await svc.createForOrder('t1', 'o1');
    expect(result.id).toBe('r1');
    expect(email.sendEmail).toHaveBeenCalledWith(
      'tech@acme.com',
      expect.stringContaining('OS-001'),
      expect.any(String),
      expect.stringContaining('Avaliar'),
    );
  });

  it('não envia email se tenant sem techContactEmail', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce(null);
    prisma.satisfactionResponse.create.mockResolvedValueOnce({
      id: 'r1',
      token: 'abc',
      tenant: { techContactEmail: null },
      order: { protocol: 'OS-001' },
    });
    const email = makeEmail();
    const svc = new CsatService(prisma, email);
    await svc.createForOrder('t1', 'o1');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});

describe('CsatService.answer', () => {
  it('lança NotFoundException se token não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    prisma.satisfactionResponse.updateMany.mockResolvedValueOnce({ count: 0 });
    const svc = new CsatService(prisma, makeEmail());
    await expect(svc.answer('tok', 5)).rejects.toThrow('Survey not found');
  });

  it('lança BadRequestException se já respondida', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce({ id: 'r1', answered: true });
    const svc = new CsatService(prisma, makeEmail());
    await expect(svc.answer('tok', 5)).rejects.toThrow('already answered');
  });

  it('lança BadRequestException se score fora de 1-5', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce({ id: 'r1', answered: false });
    const svc = new CsatService(prisma, makeEmail());
    await expect(svc.answer('tok', 0)).rejects.toThrow('between 1 and 5');
    await expect(svc.answer('tok', 6)).rejects.toThrow('between 1 and 5');
  });

  it('atualiza score, comment, answered=true e answeredAt', async () => {
    const prisma = makePrisma();
    const svc = new CsatService(prisma, makeEmail());
    await expect(svc.answer('tok', 4, 'Bom')).resolves.toEqual({ success: true });
    expect(prisma.satisfactionResponse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'tok', answered: false },
        data: expect.objectContaining({
          score: 4,
          comment: 'Bom',
          answered: true,
          answeredAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('CsatService.getByToken', () => {
  it('retorna apenas estado e dados públicos da ordem', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findFirst.mockResolvedValueOnce({
      answered: false,
      order: { protocol: 'OS-001', type: 'AUDITORIA' },
    });
    const svc = new CsatService(prisma, makeEmail());

    await expect(svc.getByToken('tok')).resolves.toEqual({
      answered: false,
      order: { protocol: 'OS-001', type: 'AUDITORIA' },
    });
    expect(prisma.satisfactionResponse.findFirst).toHaveBeenCalledWith({
      where: { token: 'tok' },
      select: {
        answered: true,
        order: { select: { protocol: true, type: true } },
      },
    });
  });
});

describe('CsatService.summary', () => {
  it('retorna zeros para tenant sem respostas', async () => {
    const prisma = makePrisma();
    const svc = new CsatService(prisma, makeEmail());
    const summary = await svc.summary('t1');
    expect(summary).toEqual({ avg: 0, total: 0, distribution: {} });
  });

  it('calcula avg e distribuição por score', async () => {
    const prisma = makePrisma();
    prisma.satisfactionResponse.findMany.mockResolvedValueOnce([
      { score: 5 },
      { score: 5 },
      { score: 4 },
      { score: 3 },
    ]);
    const svc = new CsatService(prisma, makeEmail());
    const summary = await svc.summary('t1');
    expect(summary.avg).toBe(4.3);
    expect(summary.total).toBe(4);
    expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 });
  });
});

describe('CsatService.listByTenant', () => {
  it('filtra apenas responded=true, ordenado por answeredAt desc', async () => {
    const prisma = makePrisma();
    const svc = new CsatService(prisma, makeEmail());
    await svc.listByTenant('t1');
    const where = prisma.satisfactionResponse.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ tenantId: 't1', answered: true });
  });
});
