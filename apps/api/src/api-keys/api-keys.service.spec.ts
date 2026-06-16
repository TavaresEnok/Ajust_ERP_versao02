import * as crypto from 'crypto';
import { ApiKeysService } from './api-keys.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    apiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'k1', tenantId: 't1', keyHash: 'h', keyPrefix: 'ajust_abcdef' }),
      create: jest.fn().mockResolvedValue({ id: 'k1' }),
      update: jest.fn().mockResolvedValue({ id: 'k1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  for (const k of Object.keys(overrides)) base.apiKey[k] = overrides[k];
  return base;
}

describe('ApiKeysService.list', () => {
  it('omite keyHash no retorno', async () => {
    const prisma = makePrisma();
    prisma.apiKey.findMany.mockResolvedValueOnce([
      { id: 'k1', tenantId: 't1', name: 'X', keyHash: 'secret', keyPrefix: 'ajust_a' },
    ]);
    const svc = new ApiKeysService(prisma);
    const result = await svc.list('t1');
    expect(result[0]).not.toHaveProperty('keyHash');
    expect(result[0].name).toBe('X');
  });
});

describe('ApiKeysService.create', () => {
  it('gera chave raw com prefixo ajust_ e retorna só uma vez', async () => {
    const prisma = makePrisma();
    prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({ id: 'k1', ...data }));
    const svc = new ApiKeysService(prisma);
    const result = (await svc.create('t1', 'u1', 'My key')) as any;
    expect(result.key).toMatch(/^ajust_[a-f0-9]{48}$/);
    expect(result.keyPrefix).toBe(result.key.substring(0, 12));
    const created = prisma.apiKey.create.mock.calls[0][0].data;
    expect(created.keyHash).toBe(crypto.createHash('sha256').update(result.key).digest('hex'));
    expect(result).not.toHaveProperty('keyHash');
  });

  it('converte expiresAt para Date', async () => {
    const prisma = makePrisma();
    prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({ id: 'k1', ...data }));
    const svc = new ApiKeysService(prisma);
    await svc.create('t1', 'u1', 'X', '2030-01-01T00:00:00Z');
    const data = prisma.apiKey.create.mock.calls[0][0].data;
    expect(data.expiresAt).toBeInstanceOf(Date);
  });

  it('rejeita expiresAt no passado', async () => {
    const svc = new ApiKeysService(makePrisma());
    await expect(svc.create('t1', 'u1', 'X', '2020-01-01T00:00:00Z')).rejects.toThrow(
      'expiration must be in the future',
    );
  });
});

describe('ApiKeysService.revoke', () => {
  it('lança NotFoundException se não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new ApiKeysService(prisma);
    await expect(svc.revoke('t1', 'k1')).rejects.toThrow('API Key not found');
  });

  it('marca active=false', async () => {
    const prisma = makePrisma();
    prisma.apiKey.update.mockResolvedValueOnce({
      id: 'k1',
      tenantId: 't1',
      keyHash: 'secret',
      active: false,
    });
    const svc = new ApiKeysService(prisma);
    const result = await svc.revoke('t1', 'k1');
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
    expect(result).not.toHaveProperty('keyHash');
  });
});

describe('ApiKeysService.remove', () => {
  it('remove via deleteMany', async () => {
    const prisma = makePrisma();
    const svc = new ApiKeysService(prisma);
    const result = await svc.remove('t1', 'k1');
    expect(result).toEqual({ success: true });
    expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { id: 'k1', tenantId: 't1' } });
  });

  it('lança NotFoundException quando nada é removido', async () => {
    const prisma = makePrisma({ deleteMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const svc = new ApiKeysService(prisma);
    await expect(svc.remove('t1', 'missing')).rejects.toThrow('API Key not found');
  });
});

describe('ApiKeysService.validateKey', () => {
  it('retorna null se chave não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new ApiKeysService(prisma);
    expect(await svc.validateKey('ajust_xyz')).toBeNull();
  });

  it('retorna null se expirada', async () => {
    const prisma = makePrisma();
    prisma.apiKey.findFirst.mockResolvedValueOnce({
      id: 'k1',
      tenantId: 't1',
      keyHash: 'h',
      expiresAt: new Date('2020-01-01'),
    });
    const svc = new ApiKeysService(prisma);
    expect(await svc.validateKey('ajust_xyz')).toBeNull();
  });

  it('atualiza lastUsedAt e retorna tenantId/keyId quando válida', async () => {
    const prisma = makePrisma();
    prisma.apiKey.findFirst.mockResolvedValueOnce({
      id: 'k1',
      tenantId: 't1',
      keyHash: 'h',
      expiresAt: null,
    });
    const svc = new ApiKeysService(prisma);
    const result = await svc.validateKey('ajust_xyz');
    expect(result).toEqual({ tenantId: 't1', keyId: 'k1' });
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: {
        keyHash: expect.any(String),
        active: true,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
    });
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastUsedAt: expect.any(Date) } }),
    );
  });
});
