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
import { OnCallService } from './on-call.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertManagerRole } from '../common/role-utils';
import { z } from 'zod';

type CreateOnCallScheduleBody = {
  userId: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
};

const CreateOnCallScheduleSchema = z.object({
  userId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(1000).optional(),
});

const DateRangeQuerySchema = z
  .object({
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

@ApiTags('On-Call')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('on-call')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class OnCallController {
  constructor(@Inject(OnCallService) private readonly svc: OnCallService) {}

  @Get()
  list(@Req() req: RequestWithAuth, @Query('from') from?: string, @Query('to') to?: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const range = DateRangeQuerySchema.parse({ from, to });
    return this.svc.list(req.auth.tenantId, range.from, range.to);
  }

  @Get('current')
  current(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.currentOnCall(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.create(
      req.auth.tenantId,
      CreateOnCallScheduleSchema.parse(body) as CreateOnCallScheduleBody,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.remove(req.auth.tenantId, id);
  }
}
