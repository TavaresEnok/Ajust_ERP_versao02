import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  Query,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { SlaEngineService } from './sla-engine.service';
import { Priority, ServiceOrderType } from '@prisma/client';
import { assertManagerRole } from '../common/role-utils';
import { z } from 'zod';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CalendarDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isWorkDay: z.boolean().optional(),
  startTime: z.string().regex(TIME_PATTERN).optional(),
  endTime: z.string().regex(TIME_PATTERN).optional(),
});
const CalendarExceptionSchema = z.object({
  date: z.string().date(),
  isWorkDay: z.boolean().optional(),
  startTime: z.string().regex(TIME_PATTERN).optional(),
  endTime: z.string().regex(TIME_PATTERN).optional(),
  reason: z.string().trim().max(500).optional(),
});
const SimulateSchema = z.object({
  priority: z.nativeEnum(Priority),
  type: z.nativeEnum(ServiceOrderType).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
});

@ApiTags('SLA')
@Controller('sla')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class SlaController {
  constructor(@Inject(SlaEngineService) private readonly slaEngine: SlaEngineService) {}

  private tenant(req: RequestWithAuth): string {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenantId');
    return tenantId;
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get business calendar configuration' })
  async getCalendar(@Req() req: RequestWithAuth) {
    return this.slaEngine.getBusinessCalendar(this.tenant(req));
  }

  @Post('calendar')
  @ApiOperation({ summary: 'Create or update a calendar day setting' })
  async upsertCalendarDay(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertManagerRole(req.auth);
    const input = CalendarDaySchema.parse(body);
    return this.slaEngine.upsertCalendarDay(this.tenant(req), input.dayOfWeek, {
      isWorkDay: input.isWorkDay,
      startTime: input.startTime,
      endTime: input.endTime,
    });
  }

  @Delete('calendar/:dayOfWeek')
  @ApiOperation({ summary: 'Reset calendar day to defaults' })
  async resetCalendarDay(@Req() req: RequestWithAuth, @Param('dayOfWeek') dayOfWeek: string) {
    assertManagerRole(req.auth);
    const parsedDay = z.coerce.number().int().min(0).max(6).parse(dayOfWeek);
    return this.slaEngine.resetCalendarDay(this.tenant(req), parsedDay);
  }

  @Post('calendar/exceptions')
  @ApiOperation({ summary: 'Add a calendar exception (holiday or special day)' })
  async addException(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertManagerRole(req.auth);
    const input = CalendarExceptionSchema.parse(body);
    return this.slaEngine.addCalendarException(this.tenant(req), input.date, {
      isWorkDay: input.isWorkDay,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason,
    });
  }

  @Delete('calendar/exceptions/:id')
  @ApiOperation({ summary: 'Remove a calendar exception' })
  async removeException(@Req() req: RequestWithAuth, @Param('id') id: string) {
    assertManagerRole(req.auth);
    return this.slaEngine.removeCalendarException(this.tenant(req), id);
  }

  @Get('audit/:orderId')
  @ApiOperation({ summary: 'Get SLA audit trail for an order' })
  async getAuditTrail(@Req() req: RequestWithAuth, @Param('orderId') orderId: string) {
    return this.slaEngine.getAuditTrail(this.tenant(req), orderId);
  }

  @Get('simulate')
  @ApiOperation({ summary: 'Simulate SLA target date based on priority and type' })
  @ApiQuery({ name: 'priority', required: true, enum: Priority })
  @ApiQuery({ name: 'type', required: false, enum: ServiceOrderType })
  @ApiQuery({ name: 'startDate', required: false })
  async simulate(
    @Req() req: RequestWithAuth,
    @Query('priority') priority: Priority,
    @Query('type') type?: ServiceOrderType,
    @Query('startDate') startDateStr?: string,
  ) {
    const tenantId = this.tenant(req);
    const input = SimulateSchema.parse({ priority, type, startDate: startDateStr });
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const policy = await this.slaEngine.findApplicablePolicy(tenantId, input.priority, input.type);
    const target = await this.slaEngine.calculateTargetDate(startDate, policy.hours, tenantId);

    return {
      policy,
      targetDate: target,
      startDate,
    };
  }

  @Get('breaches')
  @ApiOperation({ summary: 'Get current SLA breaches' })
  async getBreaches(@Req() req: RequestWithAuth) {
    return this.slaEngine.calculateBreaches(this.tenant(req));
  }
}
