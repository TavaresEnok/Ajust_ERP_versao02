import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Priority, ServiceOrderType } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';

interface DaySchedule {
  isWorkDay: boolean;
  startTime: string;
  endTime: string;
}

type CalendarConfig = Record<number, DaySchedule>;

@Injectable()
export class SlaEngineService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  // Business Calendar
  // ═══════════════════════════════════════════════════════════════

  async getBusinessCalendar(tenantId: string): Promise<CalendarConfig> {
    const rows = await this.prisma.businessCalendar.findMany({
      where: { tenantId },
    });
    const result: CalendarConfig = {} as CalendarConfig;
    for (let i = 0; i < 7; i++) {
      const row = rows.find((r) => r.dayOfWeek === i);
      if (row) {
        result[i] = {
          isWorkDay: row.isWorkDay,
          startTime: row.startTime,
          endTime: row.endTime,
        };
      } else {
        const isWeekend = i === 0 || i === 6;
        result[i] = {
          isWorkDay: !isWeekend,
          startTime: '08:00',
          endTime: '18:00',
        };
      }
    }
    return result;
  }

  async getCalendarException(tenantId: string, date: Date) {
    const timezone = await this.getTenantTimezone(tenantId);
    return this.getCalendarExceptionForWallDate(tenantId, toZonedTime(date, timezone));
  }

  async isBusinessTime(tenantId: string, date: Date): Promise<boolean> {
    const [calendar, timezone] = await Promise.all([
      this.getBusinessCalendar(tenantId),
      this.getTenantTimezone(tenantId),
    ]);
    const wallDate = toZonedTime(date, timezone);
    const exception = await this.getCalendarExceptionForWallDate(tenantId, wallDate);

    const daySchedule = calendar[wallDate.getDay()];
    const currentMinutes = wallDate.getHours() * 60 + wallDate.getMinutes();

    if (exception) {
      if (!exception.isWorkDay) return false;
      const [startH, startM] = (exception.startTime ?? daySchedule.startTime)
        .split(':')
        .map(Number);
      const [endH, endM] = (exception.endTime ?? daySchedule.endTime).split(':').map(Number);
      return currentMinutes >= startH * 60 + startM && currentMinutes < endH * 60 + endM;
    }

    if (!daySchedule.isWorkDay) return false;
    const [startH, startM] = daySchedule.startTime.split(':').map(Number);
    const [endH, endM] = daySchedule.endTime.split(':').map(Number);
    return currentMinutes >= startH * 60 + startM && currentMinutes < endH * 60 + endM;
  }

  async upsertCalendarDay(
    tenantId: string,
    dayOfWeek: number,
    data: { isWorkDay?: boolean; startTime?: string; endTime?: string },
  ) {
    const existing = await this.prisma.businessCalendar.findUnique({
      where: { tenantId_dayOfWeek: { tenantId, dayOfWeek } },
    });
    const isWorkDay = data.isWorkDay ?? existing?.isWorkDay ?? true;
    const startTime = data.startTime ?? existing?.startTime ?? '08:00';
    const endTime = data.endTime ?? existing?.endTime ?? '18:00';
    if (isWorkDay) this.assertValidSchedule(startTime, endTime);

    return this.prisma.businessCalendar.upsert({
      where: { tenantId_dayOfWeek: { tenantId, dayOfWeek } },
      update: {
        isWorkDay: data.isWorkDay,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      create: {
        tenantId,
        dayOfWeek,
        isWorkDay: data.isWorkDay ?? true,
        startTime: data.startTime ?? '08:00',
        endTime: data.endTime ?? '18:00',
      },
    });
  }

  async resetCalendarDay(tenantId: string, dayOfWeek: number) {
    await this.prisma.businessCalendar.deleteMany({
      where: { tenantId, dayOfWeek },
    });
    return { success: true };
  }

  async addCalendarException(
    tenantId: string,
    date: string,
    data: {
      isWorkDay?: boolean;
      startTime?: string;
      endTime?: string;
      reason?: string;
    },
  ) {
    const exceptionDate = new Date(`${date}T00:00:00.000Z`);
    if (data.isWorkDay !== false) {
      const calendar = await this.getBusinessCalendar(tenantId);
      const dayConfig = calendar[exceptionDate.getUTCDay()];
      this.assertValidSchedule(
        data.startTime ?? dayConfig.startTime,
        data.endTime ?? dayConfig.endTime,
      );
    }
    return this.prisma.businessCalendarException.create({
      data: {
        tenantId,
        date: exceptionDate,
        isWorkDay: data.isWorkDay ?? false,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        reason: data.reason ?? null,
      },
    });
  }

  async removeCalendarException(tenantId: string, id: string) {
    await this.prisma.businessCalendarException.deleteMany({
      where: { id, tenantId },
    });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // SLA Calculation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculates the SLA target (deadline) based on business hours.
   * Basic assumption: 08:00 to 18:00 Mon-Fri.
   * When tenantId is provided, uses the tenant's BusinessCalendar config.
   */
  calculateTargetDate(startDate: Date, slaHours: number): Date;
  calculateTargetDate(startDate: Date, slaHours: number, tenantId: string): Promise<Date>;
  calculateTargetDate(startDate: Date, slaHours: number, tenantId?: string): Date | Promise<Date> {
    if (tenantId) {
      return this.calcTargetWithCalendar(startDate, slaHours, tenantId);
    }
    return this.calcTargetDefault(startDate, slaHours);
  }

  /**
   * Finds the best matching policy for a service order
   */
  async findApplicablePolicy(tenantId: string, priority: Priority, type?: ServiceOrderType) {
    const policies = await this.prisma.slaPolicy.findMany({
      where: { tenantId, active: true },
      orderBy: [{ isOverride: 'desc' }, { updatedAt: 'desc' }],
    });

    const typeOverride = type
      ? policies.find((policy) => policy.isOverride && policy.serviceOrderType === type)
      : undefined;
    if (typeOverride) return typeOverride;

    const legacyExactMatch = policies.find(
      (policy) =>
        !policy.isOverride && policy.priority === priority && policy.serviceOrderType === type,
    );
    if (legacyExactMatch) return legacyExactMatch;

    const priorityPolicy = policies.find(
      (policy) =>
        !policy.isOverride && policy.priority === priority && policy.serviceOrderType === null,
    );
    if (priorityPolicy) return priorityPolicy;

    return { hours: 48, priority };
  }

  /**
   * Adjust deadline dynamically based on pauses.
   */
  calculateBusinessPauseDuration(startPause: Date, endPause: Date): number;
  calculateBusinessPauseDuration(
    startPause: Date,
    endPause: Date,
    tenantId: string,
  ): Promise<number>;
  calculateBusinessPauseDuration(
    startPause: Date,
    endPause: Date,
    tenantId?: string,
  ): number | Promise<number> {
    if (tenantId) {
      return this.calcPauseWithCalendar(startPause, endPause, tenantId);
    }
    return this.calcPauseDefault(startPause, endPause);
  }

  // ── private helpers ──────────────────────────────────────────

  private calcTargetDefault(startDate: Date, slaHours: number): Date {
    let remainingMinutes = slaHours * 60;
    const current = new Date(startDate);
    this.adjustToBusinessHours(current);

    while (remainingMinutes > 0) {
      const eod = new Date(current);
      eod.setHours(18, 0, 0, 0);

      const minutesToEndOfDay = (eod.getTime() - current.getTime()) / 60000;

      if (remainingMinutes <= minutesToEndOfDay) {
        current.setTime(current.getTime() + remainingMinutes * 60000);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesToEndOfDay;
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        this.adjustToBusinessHours(current);
      }
    }

    return current;
  }

  private async calcTargetWithCalendar(
    startDate: Date,
    slaHours: number,
    tenantId: string,
  ): Promise<Date> {
    const [calendar, timezone] = await Promise.all([
      this.getBusinessCalendar(tenantId),
      this.getTenantTimezone(tenantId),
    ]);
    let remainingMinutes = slaHours * 60;
    const current = toZonedTime(startDate, timezone);
    await this.adjustWithExceptions(current, tenantId, calendar);

    for (let safety = 0; safety < 1000; safety++) {
      if (remainingMinutes <= 0) break;

      const exception = await this.getCalendarExceptionForWallDate(tenantId, current);
      if (exception && !exception.isWorkDay) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
        continue;
      }

      const dayConfig = calendar[current.getDay()];
      const endTime = exception?.endTime || dayConfig.endTime;
      const [endH, endM] = endTime.split(':').map(Number);
      const eod = new Date(current);
      eod.setHours(endH, endM, 0, 0);

      const minutesToEndOfDay = (eod.getTime() - current.getTime()) / 60000;

      if (remainingMinutes <= minutesToEndOfDay) {
        current.setTime(current.getTime() + remainingMinutes * 60000);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesToEndOfDay;
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
      }
    }

    return fromZonedTime(current, timezone);
  }

  /**
   * Adjust date to next valid business time (skip weekends, push to start if early).
   * When `calendar` is provided, uses per-tenant day-of-week config.
   */
  /* private */
  adjustToBusinessHours(date: Date, calendar?: CalendarConfig | null) {
    if (calendar) {
      this.adjustWithConfig(date, calendar);
    } else {
      this.adjustDefault(date);
    }
  }

  private adjustDefault(date: Date) {
    while (date.getDay() === 0 || date.getDay() === 6 || date.getHours() >= 18) {
      if (date.getHours() >= 18) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
      }
      if (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
      }
    }

    if (date.getHours() < 8) {
      date.setHours(8, 0, 0, 0);
    }
  }

  private adjustWithConfig(date: Date, calendar: CalendarConfig) {
    for (let i = 0; i < 366; i++) {
      const day = date.getDay();
      const config = calendar[day];

      if (!config || !config.isWorkDay) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      const [startH, startM] = config.startTime.split(':').map(Number);
      const [endH, endM] = config.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = date.getHours() * 60 + date.getMinutes();

      if (currentMinutes >= endMinutes) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      if (currentMinutes < startMinutes) {
        date.setHours(startH, startM, 0, 0);
      }

      break;
    }
  }

  private async adjustWithExceptions(date: Date, tenantId: string, calendar: CalendarConfig) {
    for (let i = 0; i < 366; i++) {
      const exception = await this.getCalendarExceptionForWallDate(tenantId, date);
      const dayConfig = calendar[date.getDay()];

      if (exception && !exception.isWorkDay) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      if (!exception && (!dayConfig || !dayConfig.isWorkDay)) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      const startTime = exception?.startTime || dayConfig?.startTime || '08:00';
      const endTime = exception?.endTime || dayConfig?.endTime || '18:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = date.getHours() * 60 + date.getMinutes();

      if (currentMinutes >= endMinutes) {
        date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
        continue;
      }

      if (currentMinutes < startMinutes) {
        date.setHours(startH, startM, 0, 0);
      }
      return;
    }
  }

  private adjustWithConfigSingle(date: Date, calendar: CalendarConfig) {
    const day = date.getDay();
    const config = calendar[day];
    if (!config || !config.isWorkDay) {
      date.setDate(date.getDate() + 1);
      date.setHours(8, 0, 0, 0);
      return;
    }
    const [startH, startM] = config.startTime.split(':').map(Number);
    const [endH, endM] = config.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    if (currentMinutes >= endMinutes) {
      date.setDate(date.getDate() + 1);
      date.setHours(8, 0, 0, 0);
    } else if (currentMinutes < startMinutes) {
      date.setHours(startH, startM, 0, 0);
    }
  }

  // ── pause duration helpers ───────────────────────────────────

  private calcPauseDefault(startPause: Date, endPause: Date): number {
    let pausedMinutes = 0;
    const current = new Date(startPause);
    this.adjustToBusinessHours(current);

    while (current.getTime() < endPause.getTime()) {
      const eod = new Date(current);
      eod.setHours(18, 0, 0, 0);

      const chunkEnd = Math.min(eod.getTime(), endPause.getTime());
      pausedMinutes += (chunkEnd - current.getTime()) / 60000;

      if (eod.getTime() < endPause.getTime()) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        this.adjustToBusinessHours(current);
      } else {
        break;
      }
    }

    return pausedMinutes;
  }

  private async calcPauseWithCalendar(
    startPause: Date,
    endPause: Date,
    tenantId: string,
  ): Promise<number> {
    const [calendar, timezone] = await Promise.all([
      this.getBusinessCalendar(tenantId),
      this.getTenantTimezone(tenantId),
    ]);
    let pausedMinutes = 0;
    const current = toZonedTime(startPause, timezone);
    const endWall = toZonedTime(endPause, timezone);
    await this.adjustWithExceptions(current, tenantId, calendar);

    while (current.getTime() < endWall.getTime()) {
      const exception = await this.getCalendarExceptionForWallDate(tenantId, current);
      if (exception && !exception.isWorkDay) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
        continue;
      }

      const dayConfig = calendar[current.getDay()];
      const endTime = exception?.endTime || dayConfig.endTime;
      const [endH, endM] = endTime.split(':').map(Number);
      const eod = new Date(current);
      eod.setHours(endH, endM, 0, 0);

      const chunkEnd = Math.min(eod.getTime(), endWall.getTime());
      pausedMinutes += (chunkEnd - current.getTime()) / 60000;

      if (eod.getTime() < endWall.getTime()) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
      } else {
        break;
      }
    }

    return pausedMinutes;
  }

  private async getTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const timezone = tenant?.timezone || 'America/Sao_Paulo';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      return 'America/Sao_Paulo';
    }
  }

  private getCalendarExceptionForWallDate(tenantId: string, wallDate: Date) {
    const startOfDay = new Date(wallDate);
    startOfDay.setHours(0, 0, 0, 0);
    return this.prisma.businessCalendarException.findUnique({
      where: { tenantId_date: { tenantId, date: startOfDay } },
    });
  }

  private assertValidSchedule(startTime: string, endTime: string): void {
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    if (toMinutes(startTime) >= toMinutes(endTime)) {
      throw new BadRequestException('Business calendar startTime must be before endTime.');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════════════════

  async logSlaAuditEvent(
    tenantId: string,
    orderId: string,
    eventType: string,
    deadlineAt?: Date | null,
    reason?: string | null,
    metadata?: Record<string, unknown> | null,
  ) {
    return this.prisma.slaAuditEvent.create({
      data: {
        tenantId,
        orderId,
        eventType,
        deadlineAt: deadlineAt ?? null,
        reason: reason ?? null,
        metadata: (metadata ?? {}) as any,
      },
    });
  }

  async getAuditTrail(tenantId: string, orderId: string) {
    return this.prisma.slaAuditEvent.findMany({
      where: { tenantId, orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async calculateBreaches(tenantId: string) {
    return this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
        deadlineAt: { lt: new Date() },
      },
      orderBy: { deadlineAt: 'asc' },
    });
  }
}
