import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { decryptSecret, encryptSecret } from '../common/secrets.crypto';

jest.mock('../common/secrets.crypto', () => ({
  encryptSecret: jest.fn((value: string) => `encrypted:${value}`),
  decryptSecret: jest.fn((value: string) => value.replace('encrypted:', '')),
}));

const now = new Date('2026-06-05T12:00:00.000Z');

function article(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-1',
    title: 'Guia de Rede',
    slug: 'guia-de-rede',
    content: 'Conteúdo',
    isPublished: true,
    createdAt: now,
    updatedAt: now,
    author: { id: 'user-1', name: 'Analista' },
    tags: [{ tag: { name: 'rede' } }],
    ...overrides,
  };
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    id: 'credential-1',
    provider: 'IXC',
    equipmentType: 'OLT',
    equipmentName: 'OLT Principal',
    environment: 'PROD',
    host: '10.0.0.1',
    username: 'admin',
    notes: 'restrito',
    secretEnc: 'encrypted:strong-secret',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    authorUserId: 'user-1',
    title: 'Lembrete',
    content: 'Conteúdo',
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePrisma(): any {
  return {
    knowledgeArticle: {
      findMany: jest.fn().mockResolvedValue([article()]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(article()),
      update: jest.fn().mockResolvedValue(article()),
      delete: jest.fn().mockResolvedValue(article()),
    },
    knowledgeCredential: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([credential()]),
      findFirst: jest.fn().mockResolvedValue(credential()),
      create: jest.fn().mockResolvedValue(credential()),
      update: jest.fn().mockResolvedValue(credential()),
      delete: jest.fn().mockResolvedValue(credential()),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([note()]),
      findFirst: jest.fn().mockResolvedValue(note()),
      create: jest.fn().mockResolvedValue(note()),
      update: jest.fn().mockResolvedValue(note()),
      delete: jest.fn().mockResolvedValue(note()),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
}

describe('KnowledgeService', () => {
  let prisma: any;
  let audit: any;
  let service: KnowledgeService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new KnowledgeService(prisma, audit);
    jest.clearAllMocks();
  });

  it('lists only published articles for non-manager roles with tenant/search/tag filters', async () => {
    const result = await service.listArticles('analista', 'user-1', {
      tenantId: 'tenant-1',
      search: 'rede',
      tag: 'infra',
      includeDrafts: true,
    });

    expect(prisma.knowledgeArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          isPublished: true,
          OR: expect.any(Array),
          tags: expect.any(Object),
        }),
      }),
    );
    expect(result[0].tags).toEqual(['rede']);
  });

  it('allows managers to include drafts', async () => {
    await service.listArticles('gerente', 'user-1', {
      tenantId: 'tenant-1',
      includeDrafts: true,
    });

    expect(prisma.knowledgeArticle.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'isPublished',
    );
  });

  it('rejects roles without article read permission', async () => {
    await expect(
      service.listArticles('cliente', 'user-1', { tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates article with normalized unique tags and collision-free slug', async () => {
    prisma.knowledgeArticle.findFirst
      .mockResolvedValueOnce({ id: 'conflict' })
      .mockResolvedValueOnce(null);
    prisma.knowledgeArticle.create.mockImplementation(async ({ data }: any) =>
      article({ slug: data.slug }),
    );

    const result = await service.createArticle('analista', 'user-1', {
      tenantId: 'tenant-1',
      title: 'Guia de Réde',
      content: 'Conteúdo',
      tags: [' Rede ', 'rede', 'NOC N3'],
    });

    expect(result.slug).toBe('guia-de-rede-2');
    expect(prisma.knowledgeArticle.create.mock.calls[0][0].data.tags.create).toHaveLength(2);
    expect(audit.log).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'OS_UPDATE',
      'knowledge_article',
      'article-1',
      expect.objectContaining({ op: 'create' }),
    );
  });

  it('updates article title, slug, tags and publication status', async () => {
    prisma.knowledgeArticle.findFirst.mockResolvedValueOnce(article());
    prisma.knowledgeArticle.findFirst.mockResolvedValueOnce(null);
    prisma.knowledgeArticle.update.mockResolvedValue(
      article({ title: 'Novo Guia', slug: 'novo-guia', isPublished: false }),
    );

    const result = await service.updateArticle('gerente', 'user-1', 'tenant-1', 'article-1', {
      title: ' Novo Guia ',
      tags: ['Operação'],
      isPublished: false,
    });

    expect(result.slug).toBe('novo-guia');
    expect(prisma.knowledgeArticle.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        title: 'Novo Guia',
        slug: 'novo-guia',
        isPublished: false,
        tags: expect.any(Object),
      }),
    );
  });

  it('returns not found when updating or deleting an article outside tenant', async () => {
    prisma.knowledgeArticle.findFirst.mockResolvedValue(null);
    await expect(
      service.updateArticle('gerente', 'user-1', 'tenant-1', 'missing', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.deleteArticle('gerente', 'user-1', 'tenant-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists credentials without secret and audits access', async () => {
    const result = await service.listCredentials('tecnico', 'user-1', {
      tenantId: 'tenant-1',
      search: 'IXC',
      provider: 'IXC',
      equipmentType: 'OLT',
      environment: 'PROD',
      sortBy: 'provider',
      sortDir: 'asc',
      limit: 10,
      offset: 5,
    });

    expect(result).toEqual(expect.objectContaining({ total: 1, limit: 10, offset: 5 }));
    const query = prisma.knowledgeCredential.findMany.mock.calls[0][0];
    expect(query).toEqual(
      expect.objectContaining({ skip: 5, take: 10, where: expect.any(Object) }),
    );
    expect(query.select).not.toHaveProperty('secretEnc');
    expect(audit.log).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'CREDENTIAL_ACCESS',
      'knowledge_credential',
      null,
      expect.objectContaining({ op: 'list', total: 1 }),
    );
  });

  it('groups credential providers with pagination', async () => {
    prisma.knowledgeCredential.findMany.mockResolvedValue([
      { provider: 'IXC', equipmentType: 'OLT', environment: 'PROD' },
      { provider: 'IXC', equipmentType: 'ONU', environment: 'LAB' },
      { provider: 'Zabbix', equipmentType: 'OUTROS', environment: 'PROD' },
    ]);

    const result = await service.listCredentialProviders('analista', 'user-1', {
      tenantId: 'tenant-1',
      limit: 1,
      offset: 1,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({ provider: 'Zabbix', total: 1, equipmentTypeCount: 1 }),
    ]);
  });

  it('encrypts credential secrets and trims fields on create', async () => {
    await service.createCredential('gerente', 'user-1', {
      tenantId: 'tenant-1',
      provider: ' IXC ',
      equipmentType: ' ',
      equipmentName: ' OLT ',
      environment: ' PROD ',
      host: ' 10.0.0.1 ',
      username: ' admin ',
      secret: 'strong-secret',
      notes: ' restrito ',
    });

    expect(encryptSecret).toHaveBeenCalledWith('strong-secret');
    expect(prisma.knowledgeCredential.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        provider: 'IXC',
        equipmentType: 'OUTROS',
        equipmentName: 'OLT',
        secretEnc: 'encrypted:strong-secret',
      }),
    );
  });

  it('reveals and audits tenant-owned credential secrets', async () => {
    const result = await service.revealCredential('tecnico', 'user-1', 'tenant-1', 'credential-1');

    expect(decryptSecret).toHaveBeenCalledWith('encrypted:strong-secret');
    expect(result.secret).toBe('strong-secret');
    expect(result).not.toHaveProperty('secretEnc');
  });

  it('rejects missing credentials and unauthorized credential mutations', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(null);
    await expect(
      service.revealCredential('tecnico', 'user-1', 'tenant-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.createCredential('analista', 'user-1', {
        tenantId: 'tenant-1',
        provider: 'x',
        environment: 'x',
        host: 'x',
        username: 'x',
        secret: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates credential fields and ignores blank replacement secret', async () => {
    await service.updateCredential('analista', 'user-1', 'tenant-1', 'credential-1', {
      provider: ' Novo ',
      equipmentType: ' ',
      equipmentName: ' Equip ',
      environment: ' LAB ',
      host: ' host ',
      username: ' user ',
      secret: ' ',
      notes: null,
    });

    expect(prisma.knowledgeCredential.update.mock.calls[0][0].data).toEqual({
      provider: 'Novo',
      equipmentType: 'OUTROS',
      equipmentName: 'Equip',
      environment: 'LAB',
      host: 'host',
      username: 'user',
      notes: null,
    });
  });

  it('scopes notes to tenant and author and allows author mutations', async () => {
    const listed = await service.listNotes('cliente', 'user-1', {
      tenantId: 'tenant-1',
      search: 'lembrete',
      pinned: false,
    });
    const created = await service.createNote('cliente', 'user-1', {
      tenantId: 'tenant-1',
      title: ' Novo ',
      content: 'conteúdo',
    });
    await service.updateNote('cliente', 'user-1', 'tenant-1', 'note-1', {
      title: ' Atualizado ',
      pinned: true,
    });
    await service.deleteNote('cliente', 'user-1', 'tenant-1', 'note-1');

    expect(listed).toHaveLength(1);
    expect(created.id).toBe('note-1');
    expect(prisma.note.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', authorUserId: 'user-1', pinned: false }),
    );
    expect(prisma.note.update.mock.calls[0][0].data).toEqual({ title: 'Atualizado', pinned: true });
    expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: 'note-1' } });
  });

  it('prevents non-manager from mutating another author note', async () => {
    prisma.note.findFirst.mockResolvedValue(note({ authorUserId: 'other-user' }));

    await expect(
      service.updateNote('cliente', 'user-1', 'tenant-1', 'note-1', { title: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteNote('cliente', 'user-1', 'tenant-1', 'note-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
