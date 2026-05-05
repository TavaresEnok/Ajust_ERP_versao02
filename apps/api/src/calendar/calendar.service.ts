import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarEventType } from '@prisma/client';

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

    if (from || to) {
      where.startAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    // Return events that are either global OR assigned to this user
    if (userId) {
      where.OR = [{ isGlobal: true }, { assigneeId: userId }];
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee:  { select: { id: true, name: true } },
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

    if (from || to) {
      where.startAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    if (assigneeId === 'global') {
      where.isGlobal = true;
    } else if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee:  { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async listTenantUsers(tenantId: string) {
    const userTenants = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        role: { select: { code: true, name: true } },
      },
    });

    return userTenants.map((ut) => ({
      id:    ut.user.id,
      name:  ut.user.name,
      email: ut.user.email,
      role:  ut.role?.code ?? 'ANALYST',
    }));
  }

  async create(tenantId: string, createdById: string, dto: CreateCalendarEventDto) {
    return this.prisma.calendarEvent.create({
      data: {
        tenantId,
        title:       dto.title,
        description: dto.description,
        type:        dto.type ?? 'OUTRO',
        isGlobal:    dto.isGlobal ?? false,
        startAt:     new Date(dto.startAt),
        endAt:       dto.endAt ? new Date(dto.endAt) : null,
        allDay:      dto.allDay ?? false,
        meetingLink: dto.meetingLink,
        location:    dto.location,
        color:       dto.color ?? '#3b82f6',
        createdById,
        assigneeId:  dto.isGlobal ? null : (dto.assigneeId ?? null),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee:  { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateCalendarEventDto) {
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Evento não encontrado.');

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title       !== undefined ? { title:       dto.title }              : {}),
        ...(dto.description !== undefined ? { description: dto.description }        : {}),
        ...(dto.type        !== undefined ? { type:        dto.type }               : {}),
        ...(dto.isGlobal    !== undefined ? { isGlobal:    dto.isGlobal }           : {}),
        ...(dto.startAt     !== undefined ? { startAt:     new Date(dto.startAt) }  : {}),
        ...(dto.endAt       !== undefined ? { endAt:       new Date(dto.endAt) }    : {}),
        ...(dto.allDay      !== undefined ? { allDay:      dto.allDay }             : {}),
        ...(dto.meetingLink !== undefined ? { meetingLink: dto.meetingLink }        : {}),
        ...(dto.location    !== undefined ? { location:    dto.location }           : {}),
        ...(dto.color       !== undefined ? { color:       dto.color }              : {}),
        ...(dto.assigneeId  !== undefined ? { assigneeId:  dto.assigneeId || null } : {}),
        ...(dto.isGlobal    === true      ? { assigneeId:  null }                   : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee:  { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Evento não encontrado.');
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { deleted: true };
  }
}
