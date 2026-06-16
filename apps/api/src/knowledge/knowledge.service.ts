import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decryptSecret, encryptSecret } from '../common/secrets.crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

type ListArticleInput = {
  tenantId: string;
  search?: string;
  tag?: string;
  includeDrafts?: boolean;
};

type CreateArticleInput = {
  tenantId: string;
  title: string;
  content: string;
  tags?: string[];
  isPublished?: boolean;
};

type UpdateArticleInput = {
  title?: string;
  content?: string;
  tags?: string[];
  isPublished?: boolean;
};

type CreateCredentialInput = {
  tenantId: string;
  provider: string;
  equipmentType?: string;
  equipmentName?: string;
  environment: string;
  host: string;
  username: string;
  secret: string;
  notes?: string;
};

type UpdateCredentialInput = {
  provider?: string;
  equipmentType?: string;
  equipmentName?: string;
  environment?: string;
  host?: string;
  username?: string;
  secret?: string;
  notes?: string | null;
};

type ListCredentialInput = {
  tenantId: string;
  search?: string;
  provider?: string;
  equipmentType?: string;
  environment?: string;
  sortBy?:
    | 'provider'
    | 'equipmentType'
    | 'equipmentName'
    | 'environment'
    | 'host'
    | 'username'
    | 'notes'
    | 'updatedAt'
    | 'createdAt';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

type ListCredentialProvidersInput = {
  tenantId: string;
  search?: string;
  equipmentType?: string;
  environment?: string;
  limit?: number;
  offset?: number;
};

type ListNotesInput = {
  tenantId: string;
  search?: string;
  pinned?: boolean;
};

type CreateNoteInput = {
  tenantId: string;
  title: string;
  content?: string;
  pinned?: boolean;
};

type UpdateNoteInput = {
  title?: string;
  content?: string;
  pinned?: boolean;
};

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listArticles(authRole: string, authUserId: string, input: ListArticleInput) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico', 'leitura'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to read knowledge base.');
    }

    const where: Prisma.KnowledgeArticleWhereInput = {
      tenantId: input.tenantId,
      ...(input.includeDrafts && ['super_admin', 'gerente'].includes(authRole)
        ? {}
        : { isPublished: true }),
    };

    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: 'insensitive' } },
        { content: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    if (input.tag) {
      where.tags = {
        some: {
          tag: {
            name: { equals: input.tag, mode: 'insensitive' },
          },
        },
      };
    }

    const articles = await this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      isPublished: article.isPublished,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      author: article.author,
      tags: article.tags.map((item) => item.tag.name),
    }));
  }

  async createArticle(authRole: string, authUserId: string, input: CreateArticleInput) {
    if (!['super_admin', 'gerente', 'analista'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to create knowledge article.');
    }

    const slug = await this.buildArticleSlug(input.tenantId, input.title);
    const tags = this.normalizeTags(input.tags || []);

    const created = await this.prisma.knowledgeArticle.create({
      data: {
        tenantId: input.tenantId,
        authorUserId: authUserId,
        title: input.title,
        slug,
        content: input.content,
        isPublished: input.isPublished ?? true,
        tags: {
          create: tags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })),
        },
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    await this.logAudit(input.tenantId, authUserId, 'OS_UPDATE', 'knowledge_article', created.id, {
      op: 'create',
      title: created.title,
    });

    return {
      id: created.id,
      title: created.title,
      slug: created.slug,
      content: created.content,
      isPublished: created.isPublished,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      author: created.author,
      tags: created.tags.map((item) => item.tag.name),
    };
  }

  async updateArticle(
    authRole: string,
    authUserId: string,
    tenantId: string,
    articleId: string,
    patch: UpdateArticleInput,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to update knowledge article.');
    }

    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
    });
    if (!article) {
      throw new NotFoundException('Knowledge article not found.');
    }

    const nextTitle = patch.title?.trim();
    const nextSlug =
      nextTitle && nextTitle !== article.title
        ? await this.buildArticleSlug(tenantId, nextTitle, article.id)
        : undefined;

    const tags = patch.tags ? this.normalizeTags(patch.tags) : null;

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: {
        ...(nextTitle ? { title: nextTitle } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.isPublished !== undefined ? { isPublished: patch.isPublished } : {}),
        ...(tags
          ? {
              tags: {
                deleteMany: {},
                create: tags.map((tagName) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name: tagName },
                      create: { name: tagName },
                    },
                  },
                })),
              },
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'knowledge_article', updated.id, {
      op: 'update',
    });

    return {
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      content: updated.content,
      isPublished: updated.isPublished,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      author: updated.author,
      tags: updated.tags.map((item) => item.tag.name),
    };
  }

  async deleteArticle(authRole: string, authUserId: string, tenantId: string, articleId: string) {
    if (!['super_admin', 'gerente', 'analista'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to delete knowledge article.');
    }

    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
      select: { id: true, title: true },
    });
    if (!article) {
      throw new NotFoundException('Knowledge article not found.');
    }

    await this.prisma.knowledgeArticle.delete({
      where: { id: article.id },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'knowledge_article', article.id, {
      op: 'delete',
      title: article.title,
    });

    return { deleted: true, id: article.id };
  }

  async listCredentials(authRole: string, authUserId: string, input: ListCredentialInput) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to read credentials.');
    }

    const where = this.buildCredentialWhere({
      tenantId: input.tenantId,
      search: input.search,
      provider: input.provider,
      equipmentType: input.equipmentType,
      environment: input.environment,
    });

    const orderField = input.sortBy || 'updatedAt';
    const orderDir = input.sortDir || 'desc';
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    const [total, credentials] = await this.prisma.$transaction([
      this.prisma.knowledgeCredential.count({ where }),
      this.prisma.knowledgeCredential.findMany({
        where,
        orderBy: [{ [orderField]: orderDir }, { provider: 'asc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          provider: true,
          equipmentType: true,
          equipmentName: true,
          environment: true,
          host: true,
          username: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    await this.logAudit(
      input.tenantId,
      authUserId,
      'CREDENTIAL_ACCESS',
      'knowledge_credential',
      null,
      {
        op: 'list',
        count: credentials.length,
        total,
      },
    );

    return { items: credentials, total, limit, offset };
  }

  async listCredentialProviders(
    authRole: string,
    authUserId: string,
    input: ListCredentialProvidersInput,
  ) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to read credentials.');
    }

    const where = this.buildCredentialWhere({
      tenantId: input.tenantId,
      search: input.search,
      equipmentType: input.equipmentType,
      environment: input.environment,
    });
    const limit = input.limit ?? 500;
    const offset = input.offset ?? 0;

    const rows = await this.prisma.knowledgeCredential.findMany({
      where,
      select: {
        provider: true,
        equipmentType: true,
        environment: true,
      },
      orderBy: [{ provider: 'asc' }],
    });

    const grouped = new Map<
      string,
      { provider: string; total: number; types: Set<string>; envs: Set<string> }
    >();
    for (const row of rows) {
      const provider = row.provider || 'Sem provedor';
      if (!grouped.has(provider)) {
        grouped.set(provider, {
          provider,
          total: 0,
          types: new Set<string>(),
          envs: new Set<string>(),
        });
      }
      const item = grouped.get(provider)!;
      item.total += 1;
      item.types.add(row.equipmentType || 'OUTROS');
      item.envs.add(row.environment || 'Nao informado');
    }

    const summaries = Array.from(grouped.values())
      .map((item) => ({
        provider: item.provider,
        total: item.total,
        equipmentTypeCount: item.types.size,
        environmentCount: item.envs.size,
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider, 'pt-BR'));

    const total = summaries.length;
    const items = summaries.slice(offset, offset + limit);

    await this.logAudit(
      input.tenantId,
      authUserId,
      'CREDENTIAL_ACCESS',
      'knowledge_credential',
      null,
      {
        op: 'list_providers',
        count: items.length,
        total,
      },
    );

    return { items, total, limit, offset };
  }

  async createCredential(authRole: string, authUserId: string, input: CreateCredentialInput) {
    if (!['super_admin', 'gerente'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to create credentials.');
    }

    const created = await this.prisma.knowledgeCredential.create({
      data: {
        tenantId: input.tenantId,
        createdById: authUserId,
        provider: input.provider.trim(),
        equipmentType: (input.equipmentType || 'OUTROS').trim() || 'OUTROS',
        equipmentName: (input.equipmentName || '').trim(),
        environment: input.environment.trim(),
        host: input.host.trim(),
        username: input.username.trim(),
        secretEnc: encryptSecret(input.secret),
        notes: input.notes?.trim() || null,
      },
      select: {
        id: true,
        provider: true,
        equipmentType: true,
        equipmentName: true,
        environment: true,
        host: true,
        username: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAudit(
      input.tenantId,
      authUserId,
      'OS_UPDATE',
      'knowledge_credential',
      created.id,
      {
        op: 'create',
        provider: created.provider,
        environment: created.environment,
      },
    );

    return created;
  }

  async revealCredential(
    authRole: string,
    authUserId: string,
    tenantId: string,
    credentialId: string,
  ) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to reveal credential secret.');
    }

    const credential = await this.prisma.knowledgeCredential.findFirst({
      where: { id: credentialId, tenantId },
      select: {
        id: true,
        provider: true,
        equipmentType: true,
        equipmentName: true,
        environment: true,
        host: true,
        username: true,
        notes: true,
        secretEnc: true,
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found.');
    }

    await this.logAudit(
      tenantId,
      authUserId,
      'CREDENTIAL_ACCESS',
      'knowledge_credential',
      credential.id,
      {
        op: 'reveal',
        provider: credential.provider,
        environment: credential.environment,
      },
    );

    return {
      id: credential.id,
      provider: credential.provider,
      equipmentType: credential.equipmentType,
      equipmentName: credential.equipmentName,
      environment: credential.environment,
      host: credential.host,
      username: credential.username,
      notes: credential.notes,
      secret: decryptSecret(credential.secretEnc),
    };
  }

  async updateCredential(
    authRole: string,
    authUserId: string,
    tenantId: string,
    credentialId: string,
    patch: UpdateCredentialInput,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to update credentials.');
    }

    const credential = await this.prisma.knowledgeCredential.findFirst({
      where: { id: credentialId, tenantId },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found.');
    }

    const data: Prisma.KnowledgeCredentialUpdateInput = {};
    if (patch.provider !== undefined) data.provider = patch.provider.trim();
    if (patch.equipmentType !== undefined)
      data.equipmentType = patch.equipmentType.trim() || 'OUTROS';
    if (patch.equipmentName !== undefined) data.equipmentName = patch.equipmentName.trim();
    if (patch.environment !== undefined) data.environment = patch.environment.trim();
    if (patch.host !== undefined) data.host = patch.host.trim();
    if (patch.username !== undefined) data.username = patch.username.trim();
    if (patch.secret !== undefined && patch.secret.trim() !== '')
      data.secretEnc = encryptSecret(patch.secret);
    if (patch.notes !== undefined) data.notes = patch.notes ? patch.notes.trim() : null;

    const updated = await this.prisma.knowledgeCredential.update({
      where: { id: credential.id },
      data,
      select: {
        id: true,
        provider: true,
        equipmentType: true,
        equipmentName: true,
        environment: true,
        host: true,
        username: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'knowledge_credential', updated.id, {
      op: 'update',
      provider: updated.provider,
      environment: updated.environment,
    });

    return updated;
  }

  async deleteCredential(
    authRole: string,
    authUserId: string,
    tenantId: string,
    credentialId: string,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(authRole)) {
      throw new ForbiddenException('Role is not allowed to delete credentials.');
    }

    const credential = await this.prisma.knowledgeCredential.findFirst({
      where: { id: credentialId, tenantId },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found.');
    }

    await this.prisma.knowledgeCredential.delete({
      where: { id: credential.id },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'knowledge_credential', credential.id, {
      op: 'delete',
      provider: credential.provider,
      environment: credential.environment,
    });

    return { deleted: true, id: credential.id };
  }

  async listNotes(authRole: string, authUserId: string, input: ListNotesInput) {
    if (
      !['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura'].includes(authRole)
    ) {
      throw new ForbiddenException('Role is not allowed to read notes.');
    }

    const where: Prisma.NoteWhereInput = {
      tenantId: input.tenantId,
      authorUserId: authUserId,
    };

    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: 'insensitive' } },
        { content: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    if (input.pinned !== undefined) {
      where.pinned = input.pinned;
    }

    const notes = await this.prisma.note.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        content: true,
        pinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return notes;
  }

  async createNote(authRole: string, authUserId: string, input: CreateNoteInput) {
    if (
      !['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura'].includes(authRole)
    ) {
      throw new ForbiddenException('Role is not allowed to create notes.');
    }

    const created = await this.prisma.note.create({
      data: {
        tenantId: input.tenantId,
        authorUserId: authUserId,
        title: input.title.trim(),
        content: input.content || '',
        pinned: !!input.pinned,
      },
      select: {
        id: true,
        title: true,
        content: true,
        pinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAudit(input.tenantId, authUserId, 'OS_UPDATE', 'note', created.id, {
      op: 'create',
    });

    return created;
  }

  async updateNote(
    authRole: string,
    authUserId: string,
    tenantId: string,
    noteId: string,
    patch: UpdateNoteInput,
  ) {
    if (
      !['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura'].includes(authRole)
    ) {
      throw new ForbiddenException('Role is not allowed to update notes.');
    }

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId },
      select: {
        id: true,
        authorUserId: true,
      },
    });
    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    const canEditAnyNote = authRole === 'super_admin' || authRole === 'gerente';
    if (!canEditAnyNote && note.authorUserId !== authUserId) {
      throw new ForbiddenException('Only the note author can update this note.');
    }

    const updated = await this.prisma.note.update({
      where: { id: note.id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      },
      select: {
        id: true,
        title: true,
        content: true,
        pinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'note', updated.id, {
      op: 'update',
    });

    return updated;
  }

  async deleteNote(authRole: string, authUserId: string, tenantId: string, noteId: string) {
    if (
      !['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura'].includes(authRole)
    ) {
      throw new ForbiddenException('Role is not allowed to delete notes.');
    }

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId },
      select: {
        id: true,
        authorUserId: true,
      },
    });
    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    const canDeleteAnyNote = authRole === 'super_admin' || authRole === 'gerente';
    if (!canDeleteAnyNote && note.authorUserId !== authUserId) {
      throw new ForbiddenException('Only the note author can remove this note.');
    }

    await this.prisma.note.delete({
      where: { id: note.id },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'note', note.id, {
      op: 'delete',
    });

    return { deleted: true, id: note.id };
  }

  private buildCredentialWhere(input: {
    tenantId: string;
    search?: string;
    provider?: string;
    equipmentType?: string;
    environment?: string;
  }): Prisma.KnowledgeCredentialWhereInput {
    const where: Prisma.KnowledgeCredentialWhereInput = {
      tenantId: input.tenantId,
    };

    if (input.search) {
      where.OR = [
        { provider: { contains: input.search, mode: 'insensitive' } },
        { equipmentType: { contains: input.search, mode: 'insensitive' } },
        { equipmentName: { contains: input.search, mode: 'insensitive' } },
        { environment: { contains: input.search, mode: 'insensitive' } },
        { host: { contains: input.search, mode: 'insensitive' } },
        { username: { contains: input.search, mode: 'insensitive' } },
        { notes: { contains: input.search, mode: 'insensitive' } },
      ];
    }
    if (input.provider) {
      where.provider = { equals: input.provider, mode: 'insensitive' };
    }
    if (input.equipmentType) {
      where.equipmentType = { equals: input.equipmentType, mode: 'insensitive' };
    }
    if (input.environment) {
      where.environment = { equals: input.environment, mode: 'insensitive' };
    }

    return where;
  }

  private normalizeTags(raw: string[]) {
    const normalized = raw
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toLowerCase())
      .map((item) => item.replace(/\s+/g, '-'));

    return Array.from(new Set(normalized));
  }

  private async buildArticleSlug(tenantId: string, title: string, ignoreId?: string) {
    const base = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    let slug = base || `artigo-${Date.now()}`;
    let suffix = 1;

    while (true) {
      const conflict = await this.prisma.knowledgeArticle.findFirst({
        where: {
          tenantId,
          slug,
          ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
        select: { id: true },
      });

      if (!conflict) return slug;
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
  }

  /** Elimina duplicação — delega ao AuditService central. */
  private async logAudit(
    tenantId: string | null,
    actorUserId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown>,
  ) {
    // Mapeia strings de ação para o enum correto
    const actionMap: Record<string, import('@prisma/client').AuditAction> = {
      OS_UPDATE: 'OS_UPDATE',
      CREDENTIAL_ACCESS: 'CREDENTIAL_ACCESS',
      EXPORT: 'EXPORT',
      SYNC: 'SYNC',
    };
    const auditAction = actionMap[action] ?? 'OS_UPDATE';
    await this.audit.log(tenantId, actorUserId, auditAction, resourceType, resourceId, metadata);
  }
}
