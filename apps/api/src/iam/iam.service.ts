import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, Priority, ServiceOrderType, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { Express } from 'express';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EventsGateway } from '../events.gateway';

type CreateTenantInput = {
  legalName: string;
  tradeName: string;
  taxId: string;
  slug: string;
  domain: string;
  timezone: string;
  techContactName: string;
  techContactEmail: string;
  techContactPhone: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  tenantId: string;
  roleCode: string;
  sector?: string;
  customerId?: string;
  actorRole?: string;
};

type UpdateTenantInput = {
  legalName?: string;
  tradeName?: string;
  taxId?: string;
  slug?: string;
  domain?: string;
  timezone?: string;
  techContactName?: string;
  techContactEmail?: string;
  techContactPhone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
};

type UpdateUserInTenantInput = {
  userId: string;
  tenantId: string;
  name?: string;
  email?: string;
  password?: string;
  status?: UserStatus;
  roleCode?: string;
  sector?: string;
  actorRole?: string;
};

type CreateTenantSectorInput = {
  tenantId: string;
  name: string;
};

type UpdateTenantSectorInput = {
  tenantId: string;
  sectorId: string;
  name: string;
};

type SaveSlaPolicyInput = {
  id?: string;
  priority?: Priority;
  serviceOrderType?: ServiceOrderType | null;
  hours?: number;
  active?: boolean;
  isOverride?: boolean;
};

@Injectable()
export class IamService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional() @Inject(EventsGateway) private readonly eventsGateway?: EventsGateway,
  ) {}

  private normalizeTaxId(taxId: string) {
    return taxId.replace(/\D/g, '');
  }

  private normalizeSectorName(name: string) {
    return name.trim().replace(/\s+/g, ' ');
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: [{ isGlobal: 'desc' }, { code: 'asc' }],
    });
  }

  async listTenants(scopeTenantId?: string) {
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(scopeTenantId ? { id: scopeTenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, sectors: true } } },
    });
  }

  async listAuditLogs(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      include: {
        actorUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listSlaPolicies(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'asc' }, { serviceOrderType: 'asc' }],
    });
  }

  async saveSlaPolicy(actorUserId: string, tenantId: string, input: SaveSlaPolicyInput) {
    if (input.id) {
      const policy = await this.prisma.slaPolicy.findFirst({
        where: { id: input.id, tenantId },
        select: { id: true },
      });
      if (!policy) throw new NotFoundException('Policy not found');

      const updated = await this.prisma.slaPolicy.update({
        where: { id: policy.id },
        data: {
          hours: input.hours,
          active: input.active,
        },
      });
      await this.audit.log(tenantId, actorUserId, 'SLA_CHANGE', 'sla_policy', updated.id, {
        op: 'update',
      });
      return updated;
    } else {
      if (!input.priority || input.hours === undefined) {
        throw new BadRequestException('New SLA policies require priority and hours.');
      }
      const isOverride = input.isOverride ?? false;
      const serviceOrderType = isOverride ? input.serviceOrderType : null;
      if (isOverride && !serviceOrderType) {
        throw new BadRequestException('Override policies require a serviceOrderType.');
      }
      const existing = await this.prisma.slaPolicy.findFirst({
        where: isOverride
          ? { tenantId, isOverride: true, serviceOrderType }
          : { tenantId, isOverride: false, priority: input.priority, serviceOrderType: null },
        select: { id: true },
      });
      if (existing) throw new ConflictException('An equivalent SLA policy already exists.');

      const created = await this.prisma.slaPolicy.create({
        data: {
          tenantId,
          priority: input.priority,
          serviceOrderType,
          hours: input.hours,
          active: input.active ?? true,
          isOverride,
        },
      });
      await this.audit.log(tenantId, actorUserId, 'SLA_CHANGE', 'sla_policy', created.id, {
        op: 'create',
      });
      return created;
    }
  }

  async createTenant(actorUserId: string, input: CreateTenantInput) {
    try {
      const normalizedTaxId = this.normalizeTaxId(input.taxId);
      const created = await this.prisma.tenant.create({
        data: {
          legalName: input.legalName,
          tradeName: input.tradeName,
          taxId: normalizedTaxId,
          slug: input.slug,
          domain: input.domain,
          timezone: input.timezone,
          techContactName: input.techContactName,
          techContactEmail: input.techContactEmail,
          techContactPhone: input.techContactPhone,
          status: input.status || 'ACTIVE',
        },
      });
      await this.audit.log(created.id, actorUserId, 'CREATE_TENANT', 'tenant', created.id, {
        op: 'create',
      });
      return created;
    } catch {
      throw new ConflictException('Tenant already exists or has conflicting unique fields.');
    }
  }

  async updateTenant(actorUserId: string, tenantId: string, patch: UpdateTenantInput) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Tenant not found.');
    }

    const payload: Prisma.TenantUpdateInput = {
      ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
      ...(patch.tradeName !== undefined ? { tradeName: patch.tradeName } : {}),
      ...(patch.taxId !== undefined ? { taxId: this.normalizeTaxId(patch.taxId) } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.domain !== undefined ? { domain: patch.domain } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.techContactName !== undefined ? { techContactName: patch.techContactName } : {}),
      ...(patch.techContactEmail !== undefined ? { techContactEmail: patch.techContactEmail } : {}),
      ...(patch.techContactPhone !== undefined ? { techContactPhone: patch.techContactPhone } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    };

    const disableTenant = patch.status !== undefined && patch.status !== 'ACTIVE';
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.tenant.update({
          where: { id: tenantId },
          data: payload,
        });
        if (disableTenant) {
          await tx.session.updateMany({
            where: { tenantId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return result;
      });
      if (disableTenant) {
        this.eventsGateway?.disconnectTenant(tenantId);
      }
      await this.audit.log(tenantId, actorUserId, 'UPDATE_TENANT', 'tenant', tenantId, {
        op: 'update',
        ...(disableTenant ? { sessionsRevoked: true } : {}),
      });
      return updated;
    } catch {
      throw new ConflictException('Tenant could not be updated due to conflicting unique fields.');
    }
  }

  async createUser(actorUserId: string, input: CreateUserInput) {
    const role = await this.prisma.role.findUnique({
      where: { code: input.roleCode },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    // Conta cliente sempre ligada a um provedor do próprio tenant (C-019).
    if (input.roleCode === 'cliente') {
      if (!input.customerId)
        throw new BadRequestException('Selecione o provedor ao qual o usuário cliente pertence.');
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Provedor não encontrado nesta empresa.');
    }
    const customerLink = input.roleCode === 'cliente' ? { customerId: input.customerId } : {};

    const normalizedEmail = input.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, status: true, deletedAt: true },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId: input.tenantId,
          },
        },
        select: { id: true },
      });
      if (existingMembership) {
        throw new ConflictException('User is already linked to this tenant.');
      }
      // A conta já existe: só cria o vínculo. Nome, senha e situação pertencem ao dono
      // da conta e não podem ser trocados por quem está cadastrando (C-020).
      if (existingUser.deletedAt || existingUser.status !== 'ACTIVE') {
        throw new ConflictException(
          'Este e-mail pertence a uma conta inativa ou excluída. A reativação é feita pelo super admin.',
        );
      }

      const membership = await this.prisma.$transaction(async (tx) => {
        await tx.userTenant.create({
          data: {
            userId: existingUser.id,
            tenantId: input.tenantId,
            roleId: role.id,
            ...customerLink,
            ...(input.sector !== undefined ? { sector: input.sector } : {}),
          },
        });

        return tx.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId: existingUser.id,
              tenantId: input.tenantId,
            },
          },
          include: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                twoFactorEnabled: true,
                lastLoginAt: true,
                createdAt: true,
              },
            },
          },
        });
      });
      await this.audit.log(input.tenantId, actorUserId, 'CREATE_USER', 'user', existingUser.id, {
        op: 'create_link',
        role: input.roleCode,
        existingAccountKept: true,
      });
      return membership;
    }

    const passwordHash = await hash(input.password, 12);
    try {
      const created = await this.prisma.user.create({
        data: {
          name: input.name,
          email: normalizedEmail,
          passwordHash,
          tenants: {
            create: {
              tenantId: input.tenantId,
              roleId: role.id,
              ...customerLink,
              ...(input.sector !== undefined ? { sector: input.sector } : {}),
            },
          },
        },
        select: {
          id: true,
        },
      });

      await this.audit.log(input.tenantId, actorUserId, 'CREATE_USER', 'user', created.id, {
        op: 'create',
        role: input.roleCode,
      });

      return this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: created.id,
            tenantId: input.tenantId,
          },
        },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              twoFactorEnabled: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
      });
    } catch {
      throw new ConflictException('User could not be created. Check unique constraints.');
    }
  }

  async listUsersByTenant(tenantId: string) {
    const members = await this.prisma.userTenant.findMany({
      where: {
        tenantId,
        user: { deletedAt: null },
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            twoFactorEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            sourceSystem: true,
            externalId: true,
            sourceMetadata: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    // Aggregate in one database snapshot, without loading the order history into memory.
    // SLA measures technical resolution; later administrative closure does not change it.
    const metrics = await this.prisma.$queryRaw<
      {
        assigneeUserId: string;
        activeOrderCount: number;
        completedOrderCount: number;
        slaEvaluatedCount: number;
        slaMetCount: number;
      }[]
    >`
      WITH assigned AS (
        SELECT *, COALESCE("resolvedAt", "closedAt") AS "finishedAt"
        FROM "ServiceOrder"
        WHERE "tenantId" = ${tenantId}
          AND "deletedAt" IS NULL AND "assigneeUserId" IS NOT NULL
          AND ("sourceMetadata"->'demonstration') IS DISTINCT FROM 'true'::jsonb
      ), measured AS (
        SELECT *, (
          "status" IN ('RESOLVIDA', 'FECHADA') AND "slaEligible" = true
          AND "deadlineAt" IS NOT NULL AND "finishedAt" >= "createdAt"
          AND "finishedAt" <= CURRENT_TIMESTAMP
        ) AS eligible
        FROM assigned
      )
      SELECT "assigneeUserId",
        (COUNT(*) FILTER (WHERE "status" NOT IN ('RESOLVIDA', 'FECHADA', 'CANCELADA')))::int AS "activeOrderCount",
        (COUNT(*) FILTER (WHERE "status" IN ('RESOLVIDA', 'FECHADA')))::int AS "completedOrderCount",
        (COUNT(*) FILTER (WHERE eligible))::int AS "slaEvaluatedCount",
        (COUNT(*) FILTER (WHERE eligible AND "finishedAt" <= "deadlineAt"))::int AS "slaMetCount"
      FROM measured GROUP BY "assigneeUserId"
    `;
    const byAssignee = new Map(metrics.map((row) => [row.assigneeUserId, row]));
    return members.map((member) => {
      const stats = byAssignee.get(member.userId);
      const slaEvaluatedCount = stats?.slaEvaluatedCount ?? 0;
      const slaMetCount = stats?.slaMetCount ?? 0;
      return {
        ...member,
        activeOrderCount: stats?.activeOrderCount ?? 0,
        completedOrderCount: stats?.completedOrderCount ?? 0,
        slaEvaluatedCount,
        slaMetCount,
        slaPercentage: slaEvaluatedCount
          ? Math.round((slaMetCount / slaEvaluatedCount) * 1000) / 10
          : null,
        metricsScope: 'ASSIGNED_ORDERS_WITHOUT_DEMONSTRATIONS',
        slaScope: 'ALL_TIME_CURRENT_ASSIGNEE',
      };
    });
  }

  async updateUserInTenant(actorUserId: string, input: UpdateUserInTenantInput) {
    const membership = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('User membership not found for this tenant.');
    }
    await this.assertCanManageUser(input.actorRole, input.userId);

    const nextRole = input.roleCode
      ? await this.prisma.role.findUnique({ where: { code: input.roleCode } })
      : null;

    if (input.roleCode && !nextRole) {
      throw new NotFoundException('Role not found.');
    }

    const userPatch: Prisma.UserUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.password ? { passwordHash: await hash(input.password, 12) } : {}),
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({
            where: { id: input.userId },
            data: userPatch,
          });
        }

        if (nextRole || input.sector !== undefined) {
          await tx.userTenant.update({
            where: { id: membership.id },
            data: {
              ...(nextRole ? { roleId: nextRole.id } : {}),
              ...(input.sector !== undefined ? { sector: input.sector } : {}),
            },
          });
        }
        if (
          input.password ||
          input.email !== undefined ||
          (input.status !== undefined && input.status !== 'ACTIVE')
        ) {
          await tx.session.updateMany({
            where: { userId: input.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      });
      await this.audit.log(input.tenantId, actorUserId, 'UPDATE_USER', 'user', input.userId, {
        op: 'update',
        sessionsRevoked:
          Boolean(input.password) ||
          input.email !== undefined ||
          (input.status !== undefined && input.status !== 'ACTIVE'),
      });
    } catch {
      throw new ConflictException('User could not be updated. Check unique constraints.');
    }

    return this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            twoFactorEnabled: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Só um super admin altera ou remove outro super admin. Vale para qualquer vínculo da
   * conta, porque o usuário (e a senha) é global entre tenants (C-021).
   */
  private async assertCanManageUser(actorRole: string | undefined, targetUserId: string) {
    if (actorRole === 'super_admin') return;
    const privileged = await this.prisma.userTenant.count({
      where: { userId: targetUserId, role: { code: 'super_admin' } },
    });
    if (privileged > 0) {
      throw new ForbiddenException(
        'Somente um super admin pode alterar ou remover outro super admin.',
      );
    }
  }

  async removeUserFromTenant(
    actorUserId: string,
    tenantId: string,
    userId: string,
    actorRole?: string,
  ) {
    const membership = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('User membership not found for this tenant.');
    }
    await this.assertCanManageUser(actorRole, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userTenant.delete({
        where: { id: membership.id },
      });

      const remainingMemberships = await tx.userTenant.count({
        where: { userId },
      });

      if (remainingMemberships === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: 'INACTIVE',
            deletedAt: new Date(),
          },
        });
      }

      await tx.session.updateMany({
        where: { userId, tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'user', userId, { op: 'remove' });

    return { removed: true, userId, tenantId };
  }

  async saveTenantLogo(actorUserId: string, tenantId: string, file: Express.Multer.File) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const detected = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ? { ext: '.png', mimeType: 'image/png' }
      : file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff
        ? { ext: '.jpg', mimeType: 'image/jpeg' }
        : file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
            file.buffer.subarray(8, 12).toString('ascii') === 'WEBP'
          ? { ext: '.webp', mimeType: 'image/webp' }
          : null;
    if (!detected || file.size > 5 * 1024 * 1024) {
      throw new ConflictException('Unsupported logo. Use a png, jpg, or webp file up to 5 MB.');
    }

    const root = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const logoDir = join(root, 'tenant-logos');
    await mkdir(logoDir, { recursive: true });

    const nextName = `${tenantId}${detected.ext}`;

    const existing = await readdir(logoDir).catch(() => []);
    await Promise.all(
      existing
        .filter((item) => item.startsWith(`${tenantId}.`) && item !== nextName)
        .map((item) => rm(join(logoDir, item), { force: true })),
    );

    await writeFile(join(logoDir, nextName), file.buffer);
    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'tenant_logo', tenantId, {
      op: 'upload',
      fileName: nextName,
      mimeType: detected.mimeType,
    });
    return { tenantId, fileName: nextName };
  }

  async readTenantLogo(tenantId: string) {
    const root = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const logoDir = join(root, 'tenant-logos');
    const existing = await readdir(logoDir).catch(() => []);
    const fileName = existing.find((item) => item.startsWith(`${tenantId}.`));
    if (!fileName) {
      return null;
    }

    const fullPath = join(logoDir, fileName);
    const buffer = await readFile(fullPath);
    const ext = extname(fileName).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

    return { fileName, mimeType, buffer };
  }

  async listOrderOrigins(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { orderOrigins: true },
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant.orderOrigins.map((name) => ({ id: name, name }));
  }

  async saveOrderOrigins(tenantId: string, names: string[]) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        orderOrigins: [...new Set(names.map((name) => name.trim()))].sort((a, b) =>
          a.localeCompare(b, 'pt-BR'),
        ),
      },
    });
    return this.listOrderOrigins(tenantId);
  }

  async listTenantSectors(tenantId: string) {
    return this.prisma.tenantSector.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createTenantSector(actorUserId: string, input: CreateTenantSectorInput) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: input.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const name = this.normalizeSectorName(input.name);
    try {
      const created = await this.prisma.tenantSector.create({
        data: {
          tenantId: input.tenantId,
          name,
        },
      });
      await this.audit.log(input.tenantId, actorUserId, 'OS_UPDATE', 'tenant_sector', created.id, {
        op: 'create',
        name,
      });
      return created;
    } catch {
      throw new ConflictException('Setor já existe para este tenant.');
    }
  }

  async updateTenantSector(actorUserId: string, input: UpdateTenantSectorInput) {
    const existing = await this.prisma.tenantSector.findFirst({
      where: { id: input.sectorId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Setor não encontrado para este tenant.');
    }

    const name = this.normalizeSectorName(input.name);
    try {
      const updated = await this.prisma.tenantSector.update({
        where: { id: input.sectorId },
        data: { name },
      });
      await this.audit.log(input.tenantId, actorUserId, 'OS_UPDATE', 'tenant_sector', updated.id, {
        op: 'update',
        name,
      });
      return updated;
    } catch {
      throw new ConflictException('Já existe setor com este nome para este tenant.');
    }
  }

  async deleteTenantSector(actorUserId: string, tenantId: string, sectorId: string) {
    const existing = await this.prisma.tenantSector.findFirst({
      where: { id: sectorId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Setor não encontrado para este tenant.');
    }
    await this.prisma.tenantSector.delete({
      where: { id: sectorId },
    });
    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'tenant_sector', sectorId, {
      op: 'delete',
    });
    return { removed: true, tenantId, sectorId };
  }
}
