import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AssetWriteInput, CmdbService } from './cmdb.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole } from '../common/role-utils';
import { z } from 'zod';
import { AssetCategory, AssetStatus } from '@prisma/client';

const AssetWriteSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.nativeEnum(AssetCategory).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  serialNumber: z.string().trim().max(500).nullable().optional(),
  vendor: z.string().trim().max(500).nullable().optional(),
  contractEnd: z.string().datetime({ offset: true }).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
});

const CreateAssetSchema = AssetWriteSchema.extend({
  name: z.string().trim().min(1).max(200),
});

const UpdateAssetSchema = AssetWriteSchema.refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided.',
});

const LinkOrderSchema = z.object({ orderId: z.string().uuid() });

@ApiTags('CMDB')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('cmdb/assets')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class CmdbController {
  constructor(@Inject(CmdbService) private readonly cmdbService: CmdbService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico', 'leitura']);
    return this.cmdbService.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return this.cmdbService.create(
      req.auth.tenantId,
      req.auth.userId,
      CreateAssetSchema.parse(body) as AssetWriteInput & { name: string },
    );
  }

  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return this.cmdbService.update(
      req.auth.tenantId,
      id,
      UpdateAssetSchema.parse(body) as AssetWriteInput,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    return this.cmdbService.remove(req.auth.tenantId, id);
  }

  @Post(':id/link-order')
  linkOrder(@Req() req: RequestWithAuth, @Param('id') assetId: string, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    const input = LinkOrderSchema.parse(body);
    return this.cmdbService.linkOrder(req.auth.tenantId, assetId, input.orderId);
  }
}
