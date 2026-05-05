import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserStatus } from '@prisma/client';
import { z } from 'zod';
import type { Express, Response } from 'express';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { IamService } from './iam.service';

const CreateTenantSchema = z.object({
  legalName: z.string().min(3),
  tradeName: z.string().min(2),
  taxId: z.string().min(11),
  slug: z.string().min(2),
  domain: z.string().min(2),
  timezone: z.string().min(2).default('America/Sao_Paulo'),
  techContactName: z.string().min(2),
  techContactEmail: z.string().email(),
  techContactPhone: z.string().min(8),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
});

const UserSectorSchema = z.string().min(2).max(64);
const TenantSectorSchema = z.object({
  name: z.string().min(2).max(64)
});

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantId: z.string().uuid(),
  roleCode: z.string().min(2),
  sector: UserSectorSchema.optional()
});

const UpdateTenantSchema = z
  .object({
    legalName: z.string().min(3).optional(),
    tradeName: z.string().min(2).optional(),
    taxId: z.string().min(11).optional(),
    slug: z.string().min(2).optional(),
    domain: z.string().min(2).optional(),
    timezone: z.string().min(2).optional(),
    techContactName: z.string().min(2).optional(),
    techContactEmail: z.string().email().optional(),
    techContactPhone: z.string().min(8).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one tenant field must be provided.'
  });

const UpdateUserSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    roleCode: z.string().min(2).optional(),
    sector: UserSectorSchema.optional()
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.status !== undefined ||
      data.roleCode !== undefined ||
      data.sector !== undefined,
    {
      message: 'At least one user field must be provided.'
    }
  );

const MANAGER_ASSIGNABLE_ROLES = new Set(['gerente', 'analista', 'tecnico', 'cliente', 'leitura']);
const CLIENT_ASSIGNABLE_ROLES = new Set(['cliente', 'leitura']);

const SlaPolicySchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA']),
  serviceOrderType: z.string().nullable().optional(),
  hours: z.number().positive(),
  active: z.boolean().optional(),
  isOverride: z.boolean().optional(),
});

@Controller('iam')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class IamController {
  constructor(@Inject(IamService) private readonly iamService: IamService) {}

  @Get('roles')
  async listRoles(@Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const all = await this.iamService.listRoles();
    if (req.auth?.role === 'super_admin') return all;
    if (req.auth?.role === 'gerente') return all.filter((role) => role.code !== 'super_admin');
    return all.filter((role) => CLIENT_ASSIGNABLE_ROLES.has(role.code));
  }

  @Get('tenants')
  async listTenants(@Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    if (req.auth?.role === 'super_admin') {
      return this.iamService.listTenants();
    }

    if (!req.auth?.tenantId) {
      throw new BadRequestException('tenantId is required for this role scope.');
    }
    return this.iamService.listTenants(req.auth.tenantId);
  }

  @Get('tenants/:tenantId/audit')
  async listAuditLogs(@Param('tenantId') tenantId: string, @Req() req: RequestWithAuth) {
    if (req.auth!.role !== 'super_admin' && req.auth!.tenantId !== tenantId) {
      throw new ForbiddenException();
    }
    return this.iamService.listAuditLogs(tenantId);
  }

  @Post('tenants')
  async createTenant(@Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin']);
    const input = CreateTenantSchema.parse(body);
    return this.iamService.createTenant(req.auth!.userId, input);
  }

  @Patch('tenants/:tenantId')
  async updateTenant(@Param('tenantId') tenantId: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    this.assertTenantScope(req, tenantId);
    const patch = UpdateTenantSchema.parse(body);
    return this.iamService.updateTenant(req.auth!.userId, tenantId, patch);
  }

  @Post('users')
  async createUser(@Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const input = CreateUserSchema.parse(body);
    this.assertTenantScope(req, input.tenantId);
    this.assertRoleAssignment(req.auth?.role || '', input.roleCode);
    return this.iamService.createUser(req.auth!.userId, input);
  }

  @Get('users')
  async listUsersByTenant(@Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    if (!req.auth?.tenantId) {
      throw new UnauthorizedException('Missing tenantId');
    }
    this.assertTenantScope(req, req.auth.tenantId);
    return this.iamService.listUsersByTenant(req.auth.tenantId);
  }

  @Patch('users/:userId')
  async updateUser(@Param('userId') userId: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const patch = UpdateUserSchema.parse(body);
    this.assertTenantScope(req, req.auth.tenantId);
    if (patch.roleCode) {
      this.assertRoleAssignment(req.auth.role || '', patch.roleCode);
    }

    return this.iamService.updateUserInTenant(req.auth.userId, {
      userId,
      tenantId: req.auth.tenantId,
      name: patch.name,
      email: patch.email,
      password: patch.password,
      status: patch.status,
      roleCode: patch.roleCode,
      sector: patch.sector
    });
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    if (!req.auth?.tenantId) {
      throw new UnauthorizedException('Missing tenantId');
    }
    this.assertTenantScope(req, req.auth.tenantId);
    if (req.auth.userId === userId) {
      throw new BadRequestException('You cannot remove your own active account.');
    }
    return this.iamService.removeUserFromTenant(req.auth.userId, req.auth.tenantId, userId);
  }

  @Get('tenants/:tenantId/logo')
  async getTenantLogo(@Param('tenantId') tenantId: string, @Req() req: RequestWithAuth, @Res() res: Response) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura']);
    this.assertTenantScope(req, tenantId);
    const logo = await this.iamService.readTenantLogo(tenantId);
    if (!logo) {
      throw new BadRequestException('Tenant logo not found.');
    }
    res.setHeader('content-type', logo.mimeType);
    res.setHeader('cache-control', 'no-store');
    return res.send(logo.buffer);
  }

  @Post('tenants/:tenantId/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTenantLogo(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: RequestWithAuth
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    this.assertTenantScope(req, tenantId);
    if (!file) {
      throw new BadRequestException('Logo file is required.');
    }
    return this.iamService.saveTenantLogo(req.auth!.userId, tenantId, file);
  }

  @Get('tenants/:tenantId/sectors')
  async listTenantSectors(@Param('tenantId') tenantId: string, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico', 'cliente', 'leitura']);
    this.assertTenantScope(req, tenantId);
    return this.iamService.listTenantSectors(tenantId);
  }

  @Post('tenants/:tenantId/sectors')
  async createTenantSector(@Param('tenantId') tenantId: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    this.assertTenantScope(req, tenantId);
    const input = TenantSectorSchema.parse(body);
    return this.iamService.createTenantSector(req.auth!.userId, {
      tenantId,
      name: input.name
    });
  }

  @Patch('tenants/:tenantId/sectors/:sectorId')
  async updateTenantSector(
    @Param('tenantId') tenantId: string,
    @Param('sectorId') sectorId: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    this.assertTenantScope(req, tenantId);
    const input = TenantSectorSchema.parse(body);
    return this.iamService.updateTenantSector(req.auth!.userId, {
      tenantId,
      sectorId,
      name: input.name
    });
  }

  @Delete('tenants/:tenantId/sectors/:sectorId')
  async deleteTenantSector(
    @Param('tenantId') tenantId: string,
    @Param('sectorId') sectorId: string,
    @Req() req: RequestWithAuth
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    this.assertTenantScope(req, tenantId);
    return this.iamService.deleteTenantSector(req.auth!.userId, tenantId, sectorId);
  }

  @Get('tenants/:tenantId/sla')
  async listSlaPolicies(@Param('tenantId') tenantId: string, @Req() req: RequestWithAuth) {
    if (req.auth!.role !== 'super_admin' && req.auth!.tenantId !== tenantId) {
      throw new ForbiddenException();
    }
    return this.iamService.listSlaPolicies(tenantId);
  }

  @Post('tenants/:tenantId/sla')
  async saveSlaPolicy(
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    if (req.auth!.role !== 'super_admin' && req.auth!.tenantId !== tenantId) {
      throw new ForbiddenException();
    }
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    const input = SlaPolicySchema.parse(body);
    return this.iamService.saveSlaPolicy(req.auth!.userId, tenantId, input as any);
  }

  private assertTenantScope(req: RequestWithAuth, targetTenantId: string) {
    const role = req.auth?.role;
    // super_admin, gerente and analista from Consultoria have cross-tenant access
    if (role === 'super_admin' || role === 'gerente' || role === 'analista') return;
    if (!req.auth?.tenantId || req.auth.tenantId !== targetTenantId) {
      throw new ForbiddenException('This action is outside of your tenant scope.');
    }
  }

  private assertRoleAssignment(actorRole: string, targetRoleCode: string) {
    if (actorRole === 'super_admin') return;
    if (actorRole === 'gerente' && MANAGER_ASSIGNABLE_ROLES.has(targetRoleCode)) return;
    if (actorRole === 'cliente' && CLIENT_ASSIGNABLE_ROLES.has(targetRoleCode)) return;
    throw new ForbiddenException(`Role ${actorRole} cannot assign ${targetRoleCode}.`);
  }
}
