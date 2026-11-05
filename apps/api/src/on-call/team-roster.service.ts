import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addRosterDays, resolveRosterDay } from './roster-calendar';

const INTERNAL_ROLES = ['super_admin', 'gerente', 'analista'];
const conflict = () =>
  new ConflictException(
    'A escala foi alterada por outra pessoa. Atualize a página antes de salvar novamente.',
  );

@Injectable()
export class TeamRosterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(tenantId: string, userId: string, from: string, to: string) {
    const span = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (span < 0 || span > 41) throw new BadRequestException('Consulte até seis semanas por vez.');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tenant.timezone }).format(
      new Date(),
    );
    const min = from < today ? from : today;
    const horizon = addRosterDays(today, 42);
    const max = to > horizon ? to : horizon;
    const holidayHorizon = addRosterDays(today, 365);
    const [policies, overrides, holidays, memberships, history] = await Promise.all([
      this.prisma.teamRosterPolicy.findMany({
        where: { tenantId },
        orderBy: { effectiveFrom: 'asc' },
      }),
      this.prisma.teamRosterDay.findMany({
        where: { tenantId, date: { gte: min, lte: max } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.businessCalendarException.findMany({
        where: {
          tenantId,
          isWorkDay: false,
          date: { gte: new Date(`${min}T00:00:00Z`), lte: new Date(`${max}T23:59:59.999Z`) },
        },
      }),
      this.prisma.userTenant.findMany({
        where: { tenantId, role: { code: { in: INTERNAL_ROLES } } },
        select: { user: { select: { id: true, name: true, status: true, deletedAt: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId, resourceType: 'team-roster', action: 'ROSTER_UPDATE' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          metadata: true,
          createdAt: true,
          actorUser: { select: { name: true } },
        },
      }),
    ]);
    const [upcomingCalendarHolidays, upcomingRosterHolidays] = await Promise.all([
      this.prisma.businessCalendarException.findMany({
        where: {
          tenantId,
          isWorkDay: false,
          date: {
            gte: new Date(`${today}T00:00:00.000Z`),
            lte: new Date(`${holidayHorizon}T23:59:59.999Z`),
          },
        },
        select: { date: true, reason: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.teamRosterDay.findMany({
        where: { tenantId, date: { gte: today, lte: holidayHorizon }, holidayName: { not: null } },
        select: { date: true, holidayName: true },
        orderBy: { date: 'asc' },
      }),
    ]);
    const dayMap = new Map(overrides.map((entry) => [entry.date, entry]));
    const holidayMap = new Map(
      holidays.map((entry) => [entry.date.toISOString().slice(0, 10), entry.reason || 'Feriado']),
    );
    const resolve = (date: string) =>
      resolveRosterDay(date, policies, dayMap.get(date), holidayMap.get(date));
    const days = Array.from({ length: span + 1 }, (_, index) =>
      resolve(addRosterDays(from, index)),
    );
    const holidayDates = new Map(
      upcomingCalendarHolidays.map((entry) => [
        entry.date.toISOString().slice(0, 10),
        entry.reason || 'Feriado',
      ]),
    );
    for (const entry of upcomingRosterHolidays) {
      if (entry.holidayName) holidayDates.set(entry.date, entry.holidayName);
    }
    const nextHolidayEntry = [...holidayDates].sort(([dateA], [dateB]) =>
      dateA.localeCompare(dateB),
    )[0];
    let nextAssignment: { date: string; shifts: string[] } | null = null;
    for (let offset = 0; offset <= 42; offset++) {
      const day = resolve(addRosterDays(today, offset));
      const shifts = [
        day.dayUserIds.includes(userId) ? 'Dia' : '',
        day.nightUserIds.includes(userId) ? 'Noite' : '',
      ].filter(Boolean);
      if (shifts.length) {
        nextAssignment = { date: day.date, shifts };
        break;
      }
    }
    return {
      today,
      timezone: tenant.timezone,
      configured: policies.length > 0 || overrides.length > 0,
      policies,
      overrides,
      members: memberships.map(({ user }) => ({
        id: user.id,
        name: user.name,
        active: user.status === 'ACTIVE' && !user.deletedAt,
      })),
      days,
      todayRoster: resolve(today),
      nextAssignment,
      nextHoliday: nextHolidayEntry
        ? { date: nextHolidayEntry[0], name: nextHolidayEntry[1] }
        : null,
      history,
    };
  }

  private async validateMembers(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const count = await this.prisma.userTenant.count({
      where: {
        tenantId,
        userId: { in: unique },
        role: { code: { in: INTERNAL_ROLES } },
        user: { status: 'ACTIVE', deletedAt: null },
      },
    });
    if (count !== unique.length)
      throw new BadRequestException('Selecione somente integrantes ativos da equipe Ajust.');
    return unique;
  }

  async savePolicy(
    tenantId: string,
    actorUserId: string,
    input: {
      effectiveFrom: string;
      dayUserIds: string[];
      nightUserIds: string[];
      expectedVersion: number;
    },
  ) {
    const dayUserIds = await this.validateMembers(tenantId, input.dayUserIds);
    const nightUserIds = await this.validateMembers(tenantId, input.nightUserIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const where = { tenantId_effectiveFrom: { tenantId, effectiveFrom: input.effectiveFrom } };
        const previous = await tx.teamRosterPolicy.findUnique({ where });
        if ((previous?.version ?? 0) !== input.expectedVersion) throw conflict();
        const baseline =
          previous ??
          (await tx.teamRosterPolicy.findFirst({
            where: { tenantId, effectiveFrom: { lte: input.effectiveFrom } },
            orderBy: { effectiveFrom: 'desc' },
          }));
        const data = { dayUserIds, nightUserIds };
        if (previous) {
          const changed = await tx.teamRosterPolicy.updateMany({
            where: { id: previous.id, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          });
          if (changed.count !== 1) throw conflict();
        } else {
          await tx.teamRosterPolicy.create({
            data: { tenantId, effectiveFrom: input.effectiveFrom, ...data },
          });
        }
        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId,
            action: 'ROSTER_UPDATE',
            resourceType: 'team-roster',
            resourceId: input.effectiveFrom,
            metadata: {
              operation: 'fixed-teams',
              date: input.effectiveFrom,
              previous: baseline
                ? { dayUserIds: baseline.dayUserIds, nightUserIds: baseline.nightUserIds }
                : null,
              next: data,
            },
          },
        });
        return { success: true };
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async saveDay(
    tenantId: string,
    actorUserId: string,
    date: string,
    input: {
      userIds: string[];
      holidayName?: string | null;
      notes?: string | null;
      expectedVersion: number;
    },
  ) {
    const userIds = await this.validateMembers(tenantId, input.userIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.teamRosterDay.findUnique({
          where: { tenantId_date: { tenantId, date } },
        });
        if ((previous?.version ?? 0) !== input.expectedVersion) throw conflict();
        const policies = previous
          ? []
          : await tx.teamRosterPolicy.findMany({
              where: { tenantId },
              orderBy: { effectiveFrom: 'asc' },
            });
        const calendarHoliday = previous
          ? null
          : await tx.businessCalendarException.findFirst({
              where: {
                tenantId,
                isWorkDay: false,
                date: {
                  gte: new Date(`${date}T00:00:00Z`),
                  lte: new Date(`${date}T23:59:59.999Z`),
                },
              },
            });
        const baseline = resolveRosterDay(
          date,
          policies,
          undefined,
          calendarHoliday?.reason || (calendarHoliday ? 'Feriado' : undefined),
        );
        const data = {
          userIds,
          holidayName: input.holidayName || null,
          notes: input.notes || null,
        };
        if (previous) {
          const changed = await tx.teamRosterDay.updateMany({
            where: { id: previous.id, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          });
          if (changed.count !== 1) throw conflict();
        } else {
          await tx.teamRosterDay.create({ data: { tenantId, date, ...data } });
        }
        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId,
            action: 'ROSTER_UPDATE',
            resourceType: 'team-roster',
            resourceId: date,
            metadata: {
              operation: 'day-roster',
              date,
              previous: previous
                ? {
                    userIds: previous.userIds,
                    holidayName: previous.holidayName,
                    notes: previous.notes,
                  }
                : { userIds: baseline.dayUserIds, holidayName: baseline.holidayName, notes: null },
              next: data,
            },
          },
        });
        return { success: true };
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async restoreDay(tenantId: string, actorUserId: string, date: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.teamRosterDay.findUnique({
        where: { tenantId_date: { tenantId, date } },
      });
      if (!previous || previous.version !== expectedVersion) throw conflict();
      const removed = await tx.teamRosterDay.deleteMany({
        where: { id: previous.id, version: expectedVersion },
      });
      if (removed.count !== 1) throw conflict();
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: 'ROSTER_UPDATE',
          resourceType: 'team-roster',
          resourceId: date,
          metadata: {
            operation: 'restore-day',
            date,
            previous: {
              userIds: previous.userIds,
              holidayName: previous.holidayName,
              notes: previous.notes,
            },
            next: null,
          },
        },
      });
      return { success: true };
    });
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw conflict();
    throw error;
  }
}
