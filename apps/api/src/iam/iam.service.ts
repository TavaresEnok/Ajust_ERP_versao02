import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { Express } from 'express';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

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
};

@Injectable()
export class IamService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private normalizeTaxId(taxId: string) {
    return taxId.replace(/\D/g, '');
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: [{ isGlobal: 'desc' }, { code: 'asc' }]
    });
  }

  async listTenants(scopeTenantId?: string) {
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(scopeTenantId ? { id: scopeTenantId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTenant(input: CreateTenantInput) {
    try {
      const normalizedTaxId = this.normalizeTaxId(input.taxId);
      return await this.prisma.tenant.create({
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
          status: input.status || 'ACTIVE'
        }
      });
    } catch {
      throw new ConflictException('Tenant already exists or has conflicting unique fields.');
    }
  }

  async updateTenant(tenantId: string, patch: UpdateTenantInput) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true }
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
      ...(patch.status !== undefined ? { status: patch.status } : {})
    };

    try {
      return await this.prisma.tenant.update({
        where: { id: tenantId },
        data: payload
      });
    } catch {
      throw new ConflictException('Tenant could not be updated due to conflicting unique fields.');
    }
  }

  async createUser(input: CreateUserInput) {
    const role = await this.prisma.role.findUnique({
      where: { code: input.roleCode }
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const normalizedEmail = input.email.toLowerCase();
    const passwordHash = await hash(input.password, 12);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });

    if (existingUser) {
      const existingMembership = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId: input.tenantId
          }
        },
        select: { id: true }
      });
      if (existingMembership) {
        throw new ConflictException('User is already linked to this tenant.');
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: input.name,
            passwordHash,
            status: 'ACTIVE',
            deletedAt: null
          }
        });

        await tx.userTenant.create({
          data: {
            userId: existingUser.id,
            tenantId: input.tenantId,
            roleId: role.id
          }
        });

        const membership = await tx.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId: existingUser.id,
              tenantId: input.tenantId
            }
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
                createdAt: true
              }
            }
          }
        });

        return membership;
      });
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          name: input.name,
          email: normalizedEmail,
          passwordHash,
          tenants: {
            create: {
              tenantId: input.tenantId,
              roleId: role.id
            }
          }
        },
        select: {
          id: true
        }
      });

      return this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: created.id,
            tenantId: input.tenantId
          }
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
              createdAt: true
            }
          }
        }
      });
    } catch {
      throw new ConflictException('User could not be created. Check unique constraints.');
    }
  }

  async listUsersByTenant(tenantId: string) {
    return this.prisma.userTenant.findMany({
      where: {
        tenantId,
        user: { deletedAt: null }
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
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async updateUserInTenant(input: UpdateUserInTenantInput) {
    const membership = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId
        }
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!membership) {
      throw new NotFoundException('User membership not found for this tenant.');
    }

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
      ...(input.password ? { passwordHash: await hash(input.password, 12) } : {})
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({
            where: { id: input.userId },
            data: userPatch
          });
        }

        if (nextRole) {
          await tx.userTenant.update({
            where: { id: membership.id },
            data: { roleId: nextRole.id }
          });
        }
      });
    } catch {
      throw new ConflictException('User could not be updated. Check unique constraints.');
    }

    return this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId
        }
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
            createdAt: true
          }
        }
      }
    });
  }

  async removeUserFromTenant(tenantId: string, userId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId
        }
      },
      select: { id: true }
    });
    if (!membership) {
      throw new NotFoundException('User membership not found for this tenant.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userTenant.delete({
        where: { id: membership.id }
      });

      const remainingMemberships = await tx.userTenant.count({
        where: { userId }
      });

      if (remainingMemberships === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: 'INACTIVE',
            deletedAt: new Date()
          }
        });
      }

      await tx.session.updateMany({
        where: { userId, tenantId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });

    return { removed: true, userId, tenantId };
  }

  async saveTenantLogo(tenantId: string, file: Express.Multer.File) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true }
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const allowedMime = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);
    if (!allowedMime.has(file.mimetype)) {
      throw new ConflictException('Unsupported logo format. Use png, jpg, webp, or svg.');
    }

    const root = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const logoDir = join(root, 'tenant-logos');
    await mkdir(logoDir, { recursive: true });

    const ext = extname(file.originalname || '').toLowerCase() || (file.mimetype === 'image/svg+xml' ? '.svg' : '.png');
    const nextName = `${tenantId}${ext}`;

    const existing = await readdir(logoDir).catch(() => []);
    await Promise.all(
      existing
        .filter((item) => item.startsWith(`${tenantId}.`) && item !== nextName)
        .map((item) => rm(join(logoDir, item), { force: true }))
    );

    await writeFile(join(logoDir, nextName), file.buffer);
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
        : ext === '.svg'
        ? 'image/svg+xml'
        : 'application/octet-stream';

    return { fileName, mimeType, buffer };
  }
}
