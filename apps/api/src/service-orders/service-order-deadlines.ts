import type { Prisma } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';

export type DeadlineFilter = 'overdue' | 'today' | 'soon' | 'paused' | 'without';

export function deadlineWhere(
  filter: DeadlineFilter,
  now: Date,
  timezone = 'America/Fortaleza',
): Prisma.ServiceOrderWhereInput {
  const active: Prisma.ServiceOrderWhereInput = {
    status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
  };
  if (filter === 'paused') return { ...active, pausedAt: { not: null } };
  if (filter === 'without') return { ...active, slaEligible: false };
  let deadlineAt: Prisma.DateTimeFilter;
  if (filter === 'overdue') deadlineAt = { lt: now };
  else if (filter === 'soon')
    deadlineAt = { gte: now, lte: new Date(now.getTime() + 2 * 60 * 60 * 1000) };
  else {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    deadlineAt = {
      gte: fromZonedTime(`${day}T00:00:00`, timezone),
      lt: fromZonedTime(`${next.toISOString().slice(0, 10)}T00:00:00`, timezone),
    };
  }
  return { ...active, slaEligible: true, pausedAt: null, deadlineAt };
}
