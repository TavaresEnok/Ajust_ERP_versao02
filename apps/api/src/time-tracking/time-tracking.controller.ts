import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { CreateTimeEntryInput, TimeTrackingService } from './time-tracking.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole } from '../common/role-utils';
import { z } from 'zod';

const CreateTimeEntrySchema = z.object({
  orderId: z.string().uuid(),
  minutes: z
    .number()
    .positive()
    .max(24 * 60),
  description: z.string().trim().max(2000).optional(),
  billable: z.boolean().optional(),
  loggedAt: z.string().datetime({ offset: true }).optional(),
});

const ListTimeEntriesSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    from: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()))
      .optional(),
    to: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()))
      .optional(),
  })
  .refine(({ from, to }) => !from || !to || new Date(from).getTime() <= new Date(to).getTime(), {
    message: 'from must be less than or equal to to.',
  });

@ApiTags('Time Tracking')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('time-entries')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class TimeTrackingController {
  constructor(@Inject(TimeTrackingService) private readonly svc: TimeTrackingService) {}

  @Get()
  list(
    @Req() req: RequestWithAuth,
    @Query('orderId') orderId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico', 'leitura']);
    const input = ListTimeEntriesSchema.parse({ orderId, from, to });
    if (input.orderId) return this.svc.listByOrder(req.auth.tenantId, input.orderId);
    return this.svc.listByTenant(req.auth.tenantId, input.from, input.to);
  }

  @Get('summary')
  summary(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura']);
    return this.svc.summary(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico']);
    return this.svc.create(
      req.auth.tenantId,
      req.auth.userId,
      CreateTimeEntrySchema.parse(body) as CreateTimeEntryInput,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'tecnico']);
    return this.svc.remove(req.auth.tenantId, id, req.auth.userId, req.auth.role || '');
  }
}
