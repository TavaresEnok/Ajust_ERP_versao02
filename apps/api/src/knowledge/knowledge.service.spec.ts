import { hashSync } from 'bcryptjs';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { packVaultContent, unpackVaultContent } from '../common/vault-content';
import {
  decryptVaultSecret as decryptSecret,
  encryptVaultSecret as encryptSecret,
} from '../common/vault.crypto';

jest.mock('../common/vault.crypto', () => ({
  encryptVaultSecret: jest.fn((value: string) => `encrypted:${value}`),
  decryptVaultSecret: jest.fn((value: string) => value.replace('encrypted:', '')),
  vaultSourceNoteText: jest.fn((value: string) => value.replace('encrypted:', '')),
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
    user: {
      findUnique: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        deletedAt: null,
        passwordHash: hashSync('confirm-test', 4),
      }),
    },
    auditLog: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([]),
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
    prisma.$transaction.mockImplementation((operation: any) =>
      typeof operation === 'function' ? operation(prisma) : Promise.all(operation),
    );
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new KnowledgeService(prisma, audit);
    jest.clearAllMocks();
  });

  it('rejects a stale vault editor without overwriting another edit', async () => {
    await expect(
      service.updateCredential('analista', 'user-1', 'tenant-1', 'credential-1', {
        notes: 'draft',
        expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.knowledgeCredential.update).not.toHaveBeenCalled();
    prisma.knowledgeCredential.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(
      service.updateCredential('analista', 'user-1', 'tenant-1', 'credential-1', {
        notes: 'draft',
        expectedUpdatedAt: now.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves reference text when editing structured accounts and synchronizes the principal access', async () => {
    const entry = {
      label: 'Administração',
      method: 'SSH' as const,
      host: '192.0.2.1',
      port: 2222,
      context: 'VPN',
      username: 'admin',
      secret: 'example',
      notes: '',
    };
    prisma.knowledgeCredential.findFirst.mockResolvedValue(
      credential({
        protectedContentEnc: 'encrypted:' + packVaultContent('original preservado', []),
      }),
    );
    await service.updateCredential('analista', 'user-1', 'tenant-1', 'credential-1', {
      accessEntries: [entry],
    });
    const data = prisma.knowledgeCredential.update.mock.calls[0][0].data;
    expect(data.host).toBe('192.0.2.1');
    expect(data.username).toBe('admin');
    expect(data.secretEnc).toBe('encrypted:example');
    expect(unpackVaultContent(data.protectedContentEnc.replace('encrypted:', ''))).toEqual({
      text: 'original preservado',
      accessEntries: [entry],
    });
  });

  it('returns only safe, tenant-scoped credential history to internal staff', async () => {
    prisma.auditLog = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'event-1',
          createdAt: now,
          actorUser: { name: 'Anderson' },
          metadata: { op: 'update', secret: 'must-not-return' },
        },
      ]),
    };
    const result = await service.credentialHistory('analista', 'tenant-1', 'credential-1');
    expect(result).toEqual([
      { id: 'event-1', createdAt: now, actor: 'Anderson', operation: 'update' },
    ]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          resourceType: 'knowledge_credential',
          resourceId: 'credential-1',
        },
        take: 100,
      }),
    );
    await expect(
      service.credentialHistory('cliente', 'tenant-1', 'credential-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.knowledgeCredential.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.credentialHistory('analista', 'other-tenant', 'credential-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('generates TOTP only for an authorized tenant-owned record and audits it', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(
      credential({ totpSecretEnc: 'encrypted:GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' }),
    );
    const result = await service.credentialTotp(
      'analista',
      'user-1',
      'tenant-1',
      'credential-1',
      'Atendimento',
      'confirm-test',
    );
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result).not.toHaveProperty('secret');
    expect(prisma.auditLog.create).toHaveBeenCalled();
    await expect(
      service.credentialTotp(
        'cliente',
        'user-1',
        'tenant-1',
        'credential-1',
        'Atendimento',
        'confirm-test',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.knowledgeCredential.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.credentialTotp(
        'analista',
        'user-1',
        'other-tenant',
        'credential-1',
        'Atendimento',
        'confirm-test',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never returns the encrypted TOTP seed in credential lists', async () => {
    prisma.knowledgeCredential.findMany.mockResolvedValue([
      credential({ totpSecretEnc: 'encrypted:private-seed' }),
    ]);
    const result = await service.listCredentials('analista', 'user-1', { tenantId: 'tenant-1' });
    expect(result.items[0]).toHaveProperty('hasTotp', true);
    expect(result.items[0]).not.toHaveProperty('totpSecretEnc');
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
    const result = await service.listCredentials('analista', 'user-1', {
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

  it('requires a reason and the current password before reading secrets', async () => {
    await expect(
      service.revealCredential(
        'analista',
        'user-1',
        'tenant-1',
        'credential-1',
        '',
        'confirm-test',
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.revealCredential(
        'analista',
        'user-1',
        'tenant-1',
        'credential-1',
        'Atendimento',
        'wrong',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.knowledgeCredential.findFirst).not.toHaveBeenCalled();
    expect(decryptSecret).not.toHaveBeenCalled();
  });

  it('recusa revelar acima do limite por hora (C-054)', async () => {
    prisma.auditLog.count.mockResolvedValue(30);
    await expect(
      service.revealCredential(
        'analista',
        'user-1',
        'tenant-1',
        'credential-1',
        'Atendimento',
        'confirm-test',
      ),
    ).rejects.toMatchObject({ status: 429 });
    // Gerente tem o dobro do limite do analista.
    prisma.auditLog.count.mockResolvedValue(59);
    await expect(
      service.revealCredential(
        'gerente',
        'user-2',
        'tenant-1',
        'credential-1',
        'Troca de senha',
        'confirm-test',
      ),
    ).resolves.toHaveProperty('secret');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'user-2',
        action: 'CREDENTIAL_ACCESS',
        metadata: expect.objectContaining({ op: 'reveal', reason: 'Troca de senha' }),
      }),
    });
  });

  it('reveals and audits tenant-owned credential secrets', async () => {
    prisma.auditLog.count.mockResolvedValue(0);
    const result = await service.revealCredential(
      'analista',
      'user-1',
      'tenant-1',
      'credential-1',
      'Atendimento',
      'confirm-test',
    );

    expect(decryptSecret).toHaveBeenCalledWith('encrypted:strong-secret');
    expect(result.secret).toBe('strong-secret');
    expect(result).not.toHaveProperty('secretEnc');
  });

  it('rejects missing credentials and unauthorized credential mutations', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(null);
    await expect(
      service.revealCredential(
        'analista',
        'user-1',
        'tenant-1',
        'missing',
        'Atendimento',
        'confirm-test',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.createCredential('cliente', 'user-1', {
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
    prisma.knowledgeCredential.count.mockResolvedValue(0);
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
  it('allows analyst creation and records the actor and create operation', async () => {
    await service.createCredential('analista', 'user-1', {
      tenantId: 'tenant-1',
      provider: 'Provedor',
      environment: 'Produção',
      host: 'https://example.invalid',
      username: 'teste',
      secret: 'only-test',
    });
    expect(prisma.knowledgeCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: 'user-1' }) }),
    );
  });

  it('links another access only to a root in the same tenant', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(
      credential({ parentCredentialId: null }),
    );
    await service.createCredential('gerente', 'user-1', {
      tenantId: 'tenant-1',
      parentCredentialId: 'credential-1',
      provider: 'ignored',
      environment: 'ignored',
      host: 'ssh.example:22',
      username: 'operator',
      secret: 'test',
      accessMethod: 'SSH',
    });
    expect(prisma.knowledgeCredential.findFirst).toHaveBeenCalledWith({
      where: { id: 'credential-1', tenantId: 'tenant-1', parentCredentialId: null },
    });
    expect(prisma.knowledgeCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentCredentialId: 'credential-1',
          provider: 'IXC',
          equipmentName: 'OLT Principal',
          accessMethod: 'SSH',
        }),
      }),
    );
    prisma.knowledgeCredential.findFirst.mockResolvedValue(null);
    await expect(
      service.createCredential('gerente', 'user-1', {
        tenantId: 'tenant-1',
        parentCredentialId: 'other-tenant',
        provider: 'x',
        environment: 'x',
        host: 'x',
        username: 'x',
        secret: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not delete a principal access with children', async () => {
    prisma.knowledgeCredential.findFirst.mockResolvedValue(credential());
    prisma.knowledgeCredential.count.mockResolvedValue(1);
    await expect(
      service.deleteCredential('gerente', 'user-1', 'tenant-1', 'credential-1'),
    ).rejects.toThrow('acessos adicionais');
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

  it.each(['cliente', 'analista', 'gerente', 'super_admin'])(
    'prevents %s from mutating another author note',
    async (role) => {
      prisma.note.findFirst.mockResolvedValue(note({ authorUserId: 'other-user' }));

      await expect(
        service.updateNote(role, 'user-1', 'tenant-1', 'note-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteNote(role, 'user-1', 'tenant-1', 'note-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
});
