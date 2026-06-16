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
import { ChangeStatus } from '@prisma/client';
import { ChangeService, CreateChangeInput } from './change.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';
import { z } from 'zod';
import { ChangeRisk } from '@prisma/client';

const CreateChangeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(10_000),
  justification: z.string().trim().min(3).max(10_000),
  rollbackPlan: z.string().trim().max(10_000).nullable().optional(),
  risk: z.nativeEnum(ChangeRisk).optional(),
  plannedStart: z.string().datetime({ offset: true }).optional(),
  plannedEnd: z.string().datetime({ offset: true }).optional(),
  affectedSystems: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
});

const ChangeTransitionSchema = z.object({ toStatus: z.nativeEnum(ChangeStatus) });

@ApiTags('Change Management')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('change-management')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ChangeController {
  constructor(@Inject(ChangeService) private readonly changeService: ChangeService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura']);
    return this.changeService.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return this.changeService.create(
      req.auth.tenantId,
      req.auth.userId,
      CreateChangeSchema.parse(body) as CreateChangeInput,
    );
  }

  @Patch(':id/transition')
  transition(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    const input = ChangeTransitionSchema.parse(body);
    return this.changeService.transition(req.auth.tenantId, id, req.auth.userId, input.toStatus);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.changeService.remove(req.auth.tenantId, id);
  }
}
