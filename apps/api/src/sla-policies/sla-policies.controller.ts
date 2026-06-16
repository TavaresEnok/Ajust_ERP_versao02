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
import { SlaPoliciesService } from './sla-policies.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { Priority, ServiceOrderType } from '@prisma/client';
import { assertManagerRole } from '../common/role-utils';
import { z } from 'zod';

const CreateSlaPolicySchema = z
  .object({
    priority: z.nativeEnum(Priority),
    serviceOrderType: z.nativeEnum(ServiceOrderType).nullable().optional(),
    hours: z.number().int().positive().max(8760),
    isOverride: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isOverride && !data.serviceOrderType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serviceOrderType'],
        message: 'Override policies require a serviceOrderType.',
      });
    }
    if (!data.isOverride && data.serviceOrderType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serviceOrderType'],
        message: 'Base policies cannot target a serviceOrderType.',
      });
    }
  });

const UpdateSlaPolicySchema = z
  .object({
    hours: z.number().int().positive().max(8760).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

@ApiTags('SLA Policies')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('sla-policies')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class SlaPoliciesController {
  constructor(@Inject(SlaPoliciesService) private readonly svc: SlaPoliciesService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.create(req.auth.tenantId, CreateSlaPolicySchema.parse(body));
  }

  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.update(req.auth.tenantId, id, UpdateSlaPolicySchema.parse(body));
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.remove(req.auth.tenantId, id);
  }
}
