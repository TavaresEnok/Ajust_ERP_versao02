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
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserStatus } from '@prisma/client';
import { z } from 'zod';
import type { Express, Response } from 'express';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { AuthGuard } from '../auth/auth.guard';
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

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantId: z.string().uuid(),
  roleCode: z.string().min(2)
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
    roleCode: z.string().min(2).optional()
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.status !== undefined ||
      data.roleCode !== undefined,
    {
      message: 'At least one user field must be provided.'
    }
  );

const MANAGER_ASSIGNABLE_ROLES = new Set(['analista', 'tecnico', 'cliente', 'leitura']);
const CLIENT_ASSIGNABLE_ROLES = new Set(['cliente', 'leitura']);

@Controller('iam')
@UseGuards(AuthGuard)
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

  @Post('tenants')
  async createTenant(@Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin']);
    const input = CreateTenantSchema.parse(body);
    return this.iamService.createTenant(input);
  }

  @Patch('tenants/:tenantId')
  async updateTenant(@Param('tenantId') tenantId: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    this.assertTenantScope(req, tenantId);
    const patch = UpdateTenantSchema.parse(body);
    return this.iamService.updateTenant(tenantId, patch);
  }

  @Post('users')
  async createUser(@Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const input = CreateUserSchema.parse(body);
    this.assertTenantScope(req, input.tenantId);
    this.assertRoleAssignment(req.auth?.role || '', input.roleCode);
    return this.iamService.createUser(input);
  }

  @Get('users')
  async listUsersByTenant(@Query('tenantId') tenantIdParam: string | undefined, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required.');
    }
    this.assertTenantScope(req, tenantId);
    return this.iamService.listUsersByTenant(tenantId);
  }

  @Patch('users/:userId')
  async updateUser(@Param('userId') userId: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const patch = UpdateUserSchema.parse(body);
    const tenantId = patch.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required.');
    }
    this.assertTenantScope(req, tenantId);
    if (patch.roleCode) {
      this.assertRoleAssignment(req.auth?.role || '', patch.roleCode);
    }

    return this.iamService.updateUserInTenant({
      userId,
      tenantId,
      name: patch.name,
      email: patch.email,
      password: patch.password,
      status: patch.status,
      roleCode: patch.roleCode
    });
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string, @Query('tenantId') tenantIdParam: string | undefined, @Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'cliente']);
    const tenantId = tenantIdParam || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required.');
    }
    this.assertTenantScope(req, tenantId);
    if (req.auth?.userId === userId) {
      throw new BadRequestException('You cannot remove your own active account.');
    }
    return this.iamService.removeUserFromTenant(tenantId, userId);
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
    return this.iamService.saveTenantLogo(tenantId, file);
  }

  private assertTenantScope(req: RequestWithAuth, targetTenantId: string) {
    const role = req.auth?.role;
    if (role === 'super_admin') return;
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
