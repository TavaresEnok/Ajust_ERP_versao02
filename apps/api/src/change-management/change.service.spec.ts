import { ChangeService } from './change.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    changeRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'c1',
        tenantId: 't1',
        status: 'AGUARDANDO_APROVACAO',
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'c1', number: 'RFC-00001' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
  };
  for (const key of Object.keys(overrides)) base.changeRequest[key] = overrides[key];
  return base;
}

describe('ChangeService.list', () => {
  it('lista RFCs do tenant excluindo deletados', async () => {
    const prisma = makePrisma();
    const svc = new ChangeService(prisma);
    await svc.list('t1');
    expect(prisma.changeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', deletedAt: null } }),
    );
  });
});

describe('ChangeService.create', () => {
  it('numera sequencialmente com prefixo RFC-', async () => {
    const prisma = makePrisma();
    prisma.changeRequest.count.mockResolvedValueOnce(7);
    const svc = new ChangeService(prisma);
    await svc.create('t1', 'u1', { title: 'X', description: 'Y', justification: 'Z' });
    expect(prisma.changeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 'RFC-00008' }) }),
    );
  });

  it('converte plannedStart/End para Date', async () => {
    const prisma = makePrisma();
    const svc = new ChangeService(prisma);
    await svc.create('t1', 'u1', {
      title: 'X',
      description: 'Y',
      justification: 'Z',
      plannedStart: '2030-01-01T00:00:00Z',
      plannedEnd: '2030-01-02T00:00:00Z',
    });
    const data = prisma.changeRequest.create.mock.calls[0][0].data;
    expect(data.plannedStart).toBeInstanceOf(Date);
    expect(data.plannedEnd).toBeInstanceOf(Date);
  });
});

describe('ChangeService.transition', () => {
  it('lança NotFoundException se RFC não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new ChangeService(prisma);
    await expect(svc.transition('t1', 'c1', 'u1', 'APROVADO')).rejects.toThrow('RFC not found');
  });

  it('define approvedById/At ao aprovar', async () => {
    const prisma = makePrisma();
    const svc = new ChangeService(prisma);
    await svc.transition('t1', 'c1', 'u1', 'APROVADO');
    const data = prisma.changeRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('APROVADO');
    expect(data.approvedById).toBe('u1');
    expect(data.approvedAt).toBeInstanceOf(Date);
  });

  it('define executedById ao entrar em EM_EXECUCAO', async () => {
    const prisma = makePrisma();
    prisma.changeRequest.findFirst.mockResolvedValueOnce({
      id: 'c1',
      tenantId: 't1',
      status: 'APROVADO',
    });
    const svc = new ChangeService(prisma);
    await svc.transition('t1', 'c1', 'u1', 'EM_EXECUCAO');
    const data = prisma.changeRequest.update.mock.calls[0][0].data;
    expect(data.executedById).toBe('u1');
  });

  it('rejeita transição fora da sequência permitida', async () => {
    const prisma = makePrisma();
    prisma.changeRequest.findFirst.mockResolvedValueOnce({
      id: 'c1',
      tenantId: 't1',
      status: 'RASCUNHO',
    });
    const svc = new ChangeService(prisma);
    await expect(svc.transition('t1', 'c1', 'u1', 'CONCLUIDO')).rejects.toThrow('is not allowed');
  });
});

describe('ChangeService.remove', () => {
  it('soft-deleta via deletedAt', async () => {
    const prisma = makePrisma();
    const svc = new ChangeService(prisma);
    const result = await svc.remove('t1', 'c1');
    expect(prisma.changeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
    expect(result).toBeDefined();
  });
});
