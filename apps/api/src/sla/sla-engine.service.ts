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
          startTime: '00:00',
          endTime: '24:00',
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
    const startTime = data.startTime ?? existing?.startTime ?? '00:00';
    const endTime = data.endTime ?? existing?.endTime ?? '24:00';
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
        startTime: data.startTime ?? '00:00',
        endTime: data.endTime ?? '24:00',
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
   * Always uses the tenant's calendar, exceptions and timezone.
   */
  async calculateTargetDate(startDate: Date, slaHours: number, tenantId: string): Promise<Date> {
    if (!tenantId) throw new BadRequestException('Informe a empresa para calcular o SLA.');
    if (!Number.isFinite(slaHours) || slaHours < 0)
      throw new BadRequestException('Prazo de SLA inválido.');
    return this.calcTargetWithCalendar(startDate, slaHours, tenantId);
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

    const legacyExactMatch = type
      ? policies.find((policy) => policy.serviceOrderType === type)
      : undefined;
    if (legacyExactMatch) return legacyExactMatch;

    // Ordem (decisão de 04/11, C-024): exceção do tipo → política do tipo → política da
    // prioridade → política NORMAL → 48 h. "CRÍTICA = 4 h" vale para qualquer tipo sem política.
    const priorityPolicy = policies.find(
      (policy) =>
        !policy.isOverride && policy.priority === priority && policy.serviceOrderType === null,
    );
    if (priorityPolicy) return priorityPolicy;
    const normalPolicy = policies.find(
      (policy) =>
        !policy.isOverride &&
        policy.priority === Priority.NORMAL &&
        policy.serviceOrderType === null,
    );
    if (normalPolicy) return normalPolicy;

    return { hours: 48, priority };
  }

  /**
   * Adjust deadline dynamically based on pauses.
   */
  async calculateBusinessPauseDuration(
    startPause: Date,
    endPause: Date,
    tenantId: string,
  ): Promise<number> {
    if (!tenantId) throw new BadRequestException('Informe a empresa para calcular a pausa.');
    return this.calcPauseWithCalendar(startPause, endPause, tenantId);
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
        current.setHours(0, 0, 0, 0);
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
        current.setHours(0, 0, 0, 0);
        await this.adjustWithExceptions(current, tenantId, calendar);
      }
    }

    if (remainingMinutes > 0)
      throw new BadRequestException('Calendário sem capacidade para calcular o prazo.');
    return fromZonedTime(current, timezone);
  }

  private async adjustWithExceptions(date: Date, tenantId: string, calendar: CalendarConfig) {
    for (let i = 0; i < 366; i++) {
      const exception = await this.getCalendarExceptionForWallDate(tenantId, date);
      const dayConfig = calendar[date.getDay()];

      if (exception && !exception.isWorkDay) {
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        continue;
      }

      if (!exception && (!dayConfig || !dayConfig.isWorkDay)) {
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        continue;
      }

      const startTime = exception?.startTime || dayConfig?.startTime || '00:00';
      const endTime = exception?.endTime || dayConfig?.endTime || '24:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = date.getHours() * 60 + date.getMinutes();

      if (currentMinutes >= endMinutes) {
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        continue;
      }

      if (currentMinutes < startMinutes) {
        date.setHours(startH, startM, 0, 0);
      }
      return;
    }
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
        current.setHours(0, 0, 0, 0);
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
        current.setHours(0, 0, 0, 0);
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
    // Exceções são gravadas como "AAAA-MM-DDT00:00:00Z". A data de parede (fuso do tenant)
    // vem nos campos locais do objeto; montar a chave em UTC a partir deles não depende do
    // fuso do processo Node (C-026).
    const day = new Date(Date.UTC(wallDate.getFullYear(), wallDate.getMonth(), wallDate.getDate()));
    return this.prisma.businessCalendarException.findUnique({
      where: { tenantId_date: { tenantId, date: day } },
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
        slaEligible: true,
        pausedAt: null,
        deletedAt: null,
        status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
        deadlineAt: { lt: new Date() },
      },
      orderBy: { deadlineAt: 'asc' },
    });
  }
}
