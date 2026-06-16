import { CmdbService } from './cmdb.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    asset: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'a1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      update: jest.fn().mockResolvedValue({ id: 'a1' }),
    },
    assetServiceOrder: {
      upsert: jest.fn().mockResolvedValue({ assetId: 'a1', orderId: 'o1' }),
    },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1' }),
    },
  };
  for (const key of Object.keys(overrides)) base.asset[key] = overrides[key];
  return base;
}

describe('CmdbService.list', () => {
  it('retorna assets do tenant com createdBy selecionado', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    await svc.list('t1');
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});

describe('CmdbService.create', () => {
  it('cria asset com defaults OUTRO/ATIVO', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    await svc.create('t1', 'u1', { name: 'Switch A' });
    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          name: 'Switch A',
          category: 'OUTRO',
          status: 'ATIVO',
          createdById: 'u1',
        }),
      }),
    );
  });

  it('converte contractEnd para Date', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    await svc.create('t1', 'u1', { name: 'X', contractEnd: '2030-01-01T00:00:00Z' });
    const call = prisma.asset.create.mock.calls[0][0];
    expect(call.data.contractEnd).toBeInstanceOf(Date);
  });
});

describe('CmdbService.update', () => {
  it('lança NotFoundException se asset não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new CmdbService(prisma);
    await expect(svc.update('t1', 'a1', { name: 'X' })).rejects.toThrow('Asset not found');
  });

  it('atualiza apenas campos definidos', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    await svc.update('t1', 'a1', { name: 'Novo nome' });
    const call = prisma.asset.update.mock.calls[0][0];
    expect(call.data).toEqual({ name: 'Novo nome' });
  });
});

describe('CmdbService.remove', () => {
  it('soft-deleta via deletedAt', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    const result = await svc.remove('t1', 'a1');
    expect(result).toEqual({ success: true });
    expect(prisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });
});

describe('CmdbService.linkOrder', () => {
  it('lança NotFoundException se asset não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new CmdbService(prisma);
    await expect(svc.linkOrder('t1', 'a1', 'o1')).rejects.toThrow('Asset not found');
  });

  it('faz upsert da relação asset-order', async () => {
    const prisma = makePrisma();
    const svc = new CmdbService(prisma);
    await svc.linkOrder('t1', 'a1', 'o1');
    expect(prisma.assetServiceOrder.upsert).toHaveBeenCalled();
  });

  it('rejeita vínculo com ordem fora do tenant', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null);
    const svc = new CmdbService(prisma);
    await expect(svc.linkOrder('t1', 'a1', 'foreign-order')).rejects.toThrow('Order not found');
    expect(prisma.assetServiceOrder.upsert).not.toHaveBeenCalled();
  });
});
