import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarEvent, CalendarEventType } from '@prisma/client';

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  type?: CalendarEventType;
  isGlobal?: boolean;
  startAt: string; // ISO datetime
  endAt?: string;
  allDay?: boolean;
  meetingLink?: string;
  location?: string;
  color?: string;
  assigneeId?: string; // null = global
  recurrenceRule?: string; // RRULE: FREQ=WEEKLY;BYDAY=MO,WE,FR
  recurrenceEnd?: string;
  parentEventId?: string;
  serviceOrderId?: string;
  occurrenceId?: string;
  changeRequestId?: string;
}

export type UpdateCalendarEventDto = Partial<CreateCalendarEventDto>;

@Injectable()
export class CalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEvents(params: {
    tenantId: string;
    userId?: string; // the requesting user
    from?: string;
    to?: string;
  }) {
    const { tenantId, userId, from, to } = params;

    const where: Record<string, unknown> = { tenantId };
    const fromDate = from ? this.parseDate(from, 'from') : null;
    const toDate = to ? this.parseDate(to, 'to') : null;
    if (fromDate && toDate) this.assertValidRange(fromDate, toDate);

    if (fromDate || toDate) {
      where.startAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    // Return events that are either global OR assigned to this user
    if (userId) {
      where.OR = [{ isGlobal: true }, { createdById: userId }, { assigneeId: userId }];
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return events;
  }

  async listAllEvents(params: {
    tenantId: string;
    from?: string;
    to?: string;
    assigneeId?: string;
  }) {
    const { tenantId, from, to, assigneeId } = params;

    const where: Record<string, unknown> = { tenantId };
    const fromDate = from ? this.parseDate(from, 'from') : null;
    const toDate = to ? this.parseDate(to, 'to') : null;
    if (fromDate && toDate) this.assertValidRange(fromDate, toDate);

    if (fromDate || toDate) {
      where.startAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    if (assigneeId === 'global') {
      where.isGlobal = true;
    } else if (assigneeId) {
      await this.assertTenantUser(tenantId, assigneeId);
      where.assigneeId = assigneeId;
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async listTenantUsers(tenantId: string) {
    const userTenants = await this.prisma.userTenant.findMany({
      where: {
        tenantId,
        user: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        role: { select: { code: true, name: true } },
      },
    });

    return userTenants.map((ut) => ({
      id: ut.user.id,
      name: ut.user.name,
      email: ut.user.email,
      role: ut.role?.code ?? 'ANALYST',
    }));
  }

  async checkConflict(
    tenantId: string,
    userId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ): Promise<{ hasConflict: boolean; conflictingEvents: CalendarEvent[] }> {
    if (endAt < startAt) {
      throw new BadRequestException('endAt deve ser igual ou posterior a startAt.');
    }
    await this.assertTenantUser(tenantId, userId);

    const conflictingEvents = await this.prisma.calendarEvent.findMany({
      where: {
        tenantId,
        AND: [
          { startAt: { lt: endAt } },
          {
            OR: [
              { endAt: { gt: startAt } },
              { AND: [{ endAt: null }, { startAt: { gte: startAt } }] },
            ],
          },
          {
            OR: [{ createdById: userId }, { assigneeId: userId }],
          },
        ],
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return {
      hasConflict: conflictingEvents.length > 0,
      conflictingEvents,
    };
  }

  async create(
    tenantId: string,
    createdById: string,
    dto: CreateCalendarEventDto,
    skipConflictCheck?: boolean,
  ) {
    const startAt = this.parseDate(dto.startAt, 'startAt');
    const endAt = dto.endAt ? this.parseDate(dto.endAt, 'endAt') : null;
    this.assertValidRange(startAt, endAt);

    const assigneeId = dto.isGlobal ? null : (dto.assigneeId ?? createdById);
    if (assigneeId) await this.assertTenantUser(tenantId, assigneeId);
    await this.assertTenantReferences(tenantId, dto);

    if (!skipConflictCheck && assigneeId) {
      const { hasConflict, conflictingEvents } = await this.checkConflict(
        tenantId,
        assigneeId,
        startAt,
        endAt ?? startAt,
      );
      if (hasConflict) {
        throw new ConflictException({
          message: 'Conflict detected with existing events.',
          hasConflict: true,
          conflictingEvents,
        });
      }
    }

    return this.prisma.calendarEvent.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'OUTRO',
        isGlobal: dto.isGlobal ?? false,
        startAt,
        endAt,
        allDay: dto.allDay ?? false,
        meetingLink: dto.meetingLink,
        location: dto.location,
        color: dto.color ?? '#3b82f6',
        createdById,
        assigneeId,
        recurrenceRule: dto.recurrenceRule ?? null,
        recurrenceEnd: dto.recurrenceEnd
          ? this.parseDate(dto.recurrenceEnd, 'recurrenceEnd')
          : null,
        parentEventId: dto.parentEventId ?? null,
        serviceOrderId: dto.serviceOrderId ?? null,
        occurrenceId: dto.occurrenceId ?? null,
        changeRequestId: dto.changeRequestId ?? null,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    actorUserId: string,
    role: string | null,
    dto: UpdateCalendarEventDto,
    skipConflictCheck?: boolean,
  ) {
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Evento não encontrado.');

    const canManageAll = role === 'super_admin' || role === 'gerente';
    if (!canManageAll && (event.createdById !== actorUserId || event.isGlobal)) {
      throw new ForbiddenException('Você só pode alterar seus próprios eventos pessoais.');
    }
    if (!canManageAll && dto.isGlobal === true) {
      throw new ForbiddenException('Apenas gerentes podem tornar eventos globais.');
    }

    const effectiveStartAt =
      dto.startAt !== undefined ? this.parseDate(dto.startAt, 'startAt') : event.startAt;
    const effectiveEndAt =
      dto.endAt !== undefined
        ? dto.endAt
          ? this.parseDate(dto.endAt, 'endAt')
          : null
        : event.endAt;
    this.assertValidRange(effectiveStartAt, effectiveEndAt);

    const effectiveAssignee =
      dto.isGlobal === true
        ? null
        : dto.assigneeId !== undefined
          ? dto.assigneeId || null
          : event.assigneeId;
    if (effectiveAssignee) await this.assertTenantUser(tenantId, effectiveAssignee);
    await this.assertTenantReferences(tenantId, dto);

    if (
      !skipConflictCheck &&
      (dto.assigneeId !== undefined || dto.startAt !== undefined || dto.endAt !== undefined)
    ) {
      if (effectiveAssignee) {
        const { hasConflict, conflictingEvents } = await this.checkConflict(
          tenantId,
          effectiveAssignee,
          effectiveStartAt,
          effectiveEndAt ?? effectiveStartAt,
          id,
        );
        if (hasConflict) {
          throw new ConflictException({
            message: 'Conflict detected with existing events.',
            hasConflict: true,
            conflictingEvents,
          });
        }
      }
    }

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.isGlobal !== undefined ? { isGlobal: dto.isGlobal } : {}),
        ...(dto.startAt !== undefined ? { startAt: effectiveStartAt } : {}),
        ...(dto.endAt !== undefined ? { endAt: effectiveEndAt } : {}),
        ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
        ...(dto.meetingLink !== undefined ? { meetingLink: dto.meetingLink } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId || null } : {}),
        ...(dto.isGlobal === true ? { assigneeId: null } : {}),
        ...(dto.recurrenceRule !== undefined ? { recurrenceRule: dto.recurrenceRule || null } : {}),
        ...(dto.recurrenceEnd !== undefined
          ? {
              recurrenceEnd: dto.recurrenceEnd
                ? this.parseDate(dto.recurrenceEnd, 'recurrenceEnd')
                : null,
            }
          : {}),
        ...(dto.parentEventId !== undefined ? { parentEventId: dto.parentEventId || null } : {}),
        ...(dto.serviceOrderId !== undefined ? { serviceOrderId: dto.serviceOrderId || null } : {}),
        ...(dto.occurrenceId !== undefined ? { occurrenceId: dto.occurrenceId || null } : {}),
        ...(dto.changeRequestId !== undefined
          ? { changeRequestId: dto.changeRequestId || null }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, tenantId: string, actorUserId: string, role: string | null) {
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Evento não encontrado.');
    const canManageAll = role === 'super_admin' || role === 'gerente';
    if (!canManageAll && (event.createdById !== actorUserId || event.isGlobal)) {
      throw new ForbiddenException('Você só pode remover seus próprios eventos pessoais.');
    }
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertTenantUser(tenantId: string, userId: string): Promise<void> {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException('Usuário não pertence a este tenant.');
  }

  private async assertTenantReferences(
    tenantId: string,
    refs: Pick<
      UpdateCalendarEventDto,
      'parentEventId' | 'serviceOrderId' | 'occurrenceId' | 'changeRequestId'
    >,
  ): Promise<void> {
    const checks = [
      refs.parentEventId
        ? this.prisma.calendarEvent.findFirst({
            where: { id: refs.parentEventId, tenantId },
            select: { id: true },
          })
        : null,
      refs.serviceOrderId
        ? this.prisma.serviceOrder.findFirst({
            where: { id: refs.serviceOrderId, tenantId, deletedAt: null },
            select: { id: true },
          })
        : null,
      refs.occurrenceId
        ? this.prisma.occurrence.findFirst({
            where: { id: refs.occurrenceId, tenantId, deletedAt: null },
            select: { id: true },
          })
        : null,
      refs.changeRequestId
        ? this.prisma.changeRequest.findFirst({
            where: { id: refs.changeRequestId, tenantId },
            select: { id: true },
          })
        : null,
    ];
    const results = await Promise.all(checks.map((check) => check ?? Promise.resolve(true)));
    const labels = ['Evento pai', 'Ordem de serviço', 'Ocorrência', 'Mudança'];
    const invalidIndex = results.findIndex((result) => !result);
    if (invalidIndex >= 0) {
      throw new NotFoundException(`${labels[invalidIndex]} não pertence a este tenant.`);
    }
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} deve ser uma data válida.`);
    }
    return parsed;
  }

  private assertValidRange(startAt: Date, endAt: Date | null): void {
    if (endAt && endAt <= startAt) {
      throw new BadRequestException('endAt deve ser posterior a startAt.');
    }
  }
}
