import { Inject } from "@nestjs/common";
import {
  BadRequestException,
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
import { CalendarService, CreateCalendarEventDto, UpdateCalendarEventDto } from './calendar.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

/** Apenas gerentes e super_admin podem criar eventos globais (visíveis para todos). */
const GLOBAL_EVENT_ROLES = new Set(['super_admin', 'gerente']);

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

    return this.calendarService.listAllEvents({ tenantId: req.auth.tenantId, from, to, assigneeId });
  }

  /**
   * GET /calendar/users
   * Lista usuários do tenant para o dropdown de assignee.
   */
  @Get('users')
  async listUsers(
    @Req() req: RequestWithAuth,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.calendarService.listTenantUsers(req.auth.tenantId);
  }

  /**
   * POST /calendar/events
   * Cria um novo evento. Eventos globais (isGlobal=true) requerem papel gerente+.
   */
  @Post('events')
  async create(
    @Req() req: RequestWithAuth,
    @Body() body: CreateCalendarEventDto,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const role = req.auth.role || '';
    if (body.isGlobal && !GLOBAL_EVENT_ROLES.has(role)) {
      throw new ForbiddenException('Apenas gerentes podem criar eventos globais.');
    }

    return this.calendarService.create(req.auth.tenantId, req.auth.userId, body);
  }

  /**
   * PATCH /calendar/events/:id
   * Atualiza um evento existente.
   */
  @Patch('events/:id')
  async update(
    @Param('id') id: string,
    @Req() req: RequestWithAuth,
    @Body() body: UpdateCalendarEventDto,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const role = req.auth.role || '';
    if (body.isGlobal && !GLOBAL_EVENT_ROLES.has(role)) {
      throw new ForbiddenException('Apenas gerentes podem tornar eventos globais.');
    }

    return this.calendarService.update(id, req.auth.tenantId, body);
  }

  /**
   * DELETE /calendar/events/:id
   */
  @Delete('events/:id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithAuth,
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.calendarService.remove(id, req.auth.tenantId);
  }
}

