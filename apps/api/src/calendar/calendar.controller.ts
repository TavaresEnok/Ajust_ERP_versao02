import { Inject } from '@nestjs/common';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  CalendarService,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './calendar.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { z } from 'zod';
import { CalendarEventType } from '@prisma/client';

/** Apenas gerentes e super_admin podem criar eventos globais (visíveis para todos). */
const GLOBAL_EVENT_ROLES = new Set(['super_admin', 'gerente']);

const CalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional(),
  type: z.nativeEnum(CalendarEventType).optional(),
  isGlobal: z.boolean().optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).optional(),
  allDay: z.boolean().optional(),
  meetingLink: z.string().url().max(2048).optional(),
  location: z.string().trim().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  assigneeId: z.string().uuid().optional(),
  recurrenceRule: z.string().trim().max(1000).optional(),
  recurrenceEnd: z.string().datetime({ offset: true }).optional(),
  parentEventId: z.string().uuid().optional(),
  serviceOrderId: z.string().uuid().optional(),
  occurrenceId: z.string().uuid().optional(),
  changeRequestId: z.string().uuid().optional(),
});

const UpdateCalendarEventSchema = CalendarEventSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided.' },
);

const ConflictSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  userId: z.string().uuid(),
  excludeEventId: z.string().uuid().optional(),
});

@Controller('calendar')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendarService: CalendarService) {}

  /**
   * GET /calendar/events
   * Retorna eventos visíveis para o usuário logado (pessoais + globais).
   */
  @Get('events')
  async listEvents(
    @Req() req: RequestWithAuth,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.calendarService.listEvents({
      tenantId: req.auth.tenantId,
      userId: req.auth.userId,
      from,
      to,
    });
  }

  /**
   * GET /calendar/events/all
   * Retorna TODOS os eventos do tenant (visão gerencial).
   * Restrito a gerente / super_admin.
   */
  @Get('events/all')
  async listAllEvents(
    @Req() req: RequestWithAuth,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const role = req.auth.role || '';
    if (!GLOBAL_EVENT_ROLES.has(role)) {
      throw new ForbiddenException('Apenas gerentes podem visualizar todos os eventos.');
    }

    return this.calendarService.listAllEvents({
      tenantId: req.auth.tenantId,
      from,
      to,
      assigneeId,
    });
  }

  /**
   * GET /calendar/users
   * Lista usuários do tenant para o dropdown de assignee.
   */
  @Get('users')
  async listUsers(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.calendarService.listTenantUsers(req.auth.tenantId);
  }

  /**
   * POST /calendar/events/check-conflict
   * Verifica se há conflito de horário para um usuário no período informado.
   */
  @Post('events/check-conflict')
  @ApiOperation({ summary: 'Check for scheduling conflicts for a user' })
  async checkConflict(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = ConflictSchema.parse(body);
    return this.calendarService.checkConflict(
      req.auth.tenantId,
      input.userId,
      new Date(input.startAt),
      new Date(input.endAt),
      input.excludeEventId,
    );
  }

  /**
   * POST /calendar/events
   * Cria um novo evento. Eventos globais (isGlobal=true) requerem papel gerente+.
   */
  @Post('events')
  @ApiOperation({ summary: 'Create a calendar event with optional conflict check' })
  async create(
    @Req() req: RequestWithAuth,
    @Body() body: unknown,
    @Query('skipConflictCheck') skipConflictCheck?: string,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = CalendarEventSchema.parse(body) as CreateCalendarEventDto;
    const role = req.auth.role || '';
    if (input.isGlobal && !GLOBAL_EVENT_ROLES.has(role)) {
      throw new ForbiddenException('Apenas gerentes podem criar eventos globais.');
    }

    return this.calendarService.create(
      req.auth.tenantId,
      req.auth.userId,
      input,
      skipConflictCheck === 'true',
    );
  }

  /**
   * PATCH /calendar/events/:id
   * Atualiza um evento existente.
   */
  @Patch('events/:id')
  @ApiOperation({ summary: 'Update a calendar event with optional conflict check' })
  async update(
    @Param('id') id: string,
    @Req() req: RequestWithAuth,
    @Body() body: unknown,
    @Query('skipConflictCheck') skipConflictCheck?: string,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = UpdateCalendarEventSchema.parse(body) as UpdateCalendarEventDto;
    const role = req.auth.role || '';
    if (input.isGlobal && !GLOBAL_EVENT_ROLES.has(role)) {
      throw new ForbiddenException('Apenas gerentes podem tornar eventos globais.');
    }

    return this.calendarService.update(
      id,
      req.auth.tenantId,
      req.auth.userId,
      req.auth.role,
      input,
      skipConflictCheck === 'true',
    );
  }

  /**
   * DELETE /calendar/events/:id
   */
  @Delete('events/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.calendarService.remove(id, req.auth.tenantId, req.auth.userId, req.auth.role);
  }
}
