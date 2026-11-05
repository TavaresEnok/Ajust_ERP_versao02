import type { ErpRecord } from './contracts';

export const ANALYST_TIMEZONE = 'America/Fortaleza';
const DAY = 86_400_000;
const completed = new Set(['RESOLVIDA', 'FECHADA']);
export type OrderFocus = 'active' | 'overdue' | 'today' | 'soon' | 'closed' | 'all';

export function localDay(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function timestamp(value: unknown): number | null {
  if (!value) return null;
  const result = new Date(String(value)).getTime();
  return Number.isFinite(result) ? result : null;
}

export function isActiveOrder(row: ErpRecord) {
  return !completed.has(String(row.status)) && row.status !== 'CANCELADA';
}

export function isOwnOrder(row: ErpRecord, userId: string) {
  return Boolean(userId) && (row.ownerUserId === userId || row.assigneeUserId === userId);
}

export function orderDeadline(row: ErpRecord) {
  return row.slaEligible === false ? null : timestamp(row.deadlineAt);
}

export function deadlineSituation(row: ErpRecord, now: Date) {
  if (!isActiveOrder(row)) return 'Concluída';
  if (row.pausedAt) return 'Pausada';
  const deadline = orderDeadline(row);
  if (deadline === null) return 'Sem prazo de SLA';
  if (deadline < now.getTime()) return 'Atrasada';
  if (deadline <= now.getTime() + 2 * 3_600_000) return 'Vence em até 2h';
  return 'Dentro do prazo';
}

export function completionTime(row: ErpRecord) {
  if (!completed.has(String(row.status))) return null;
  // A resolution and its subsequent administrative closure are one delivery.
  // Missing historical dates are not inferred from updatedAt or createdAt.
  return timestamp(row.resolvedAt) ?? timestamp(row.closedAt);
}

export function buildAnalystOverview(rows: ErpRecord[], days: number | null, now: Date) {
  const nowMs = now.getTime();
  const today = localDay(now);
  const startMs =
    days === null ? null : new Date(`${today}T00:00:00-03:00`).getTime() - (days - 1) * DAY;
  const inPeriod = (time: number | null) =>
    time !== null && time <= nowMs && (startMs === null || time >= startMs);
  const active = rows.filter(isActiveOrder);
  const overdue = active.filter((r) => deadlineSituation(r, now) === 'Atrasada');
  const dueToday = active.filter((r) => {
    const deadline = orderDeadline(r);
    return !r.pausedAt && deadline !== null && localDay(new Date(deadline)) === today;
  });
  const dueSoon = active.filter((r) => deadlineSituation(r, now) === 'Vence em até 2h');
  const closed = rows.filter((r) => inPeriod(completionTime(r)));
  const withoutSla = active.filter((r) => orderDeadline(r) === null).length;
  const missingCompletionDate = rows.filter(
    (r) => completed.has(String(r.status)) && completionTime(r) === null,
  ).length;
  const groups = new Map<string, { day: string; opened: number; closed: number }>();
  const group = (key: string) => {
    if (!groups.has(key)) groups.set(key, { day: key, opened: 0, closed: 0 });
    return groups.get(key)!;
  };
  const earliestEvent = rows.reduce<number | null>((earliest, row) => {
    const times = [timestamp(row.createdAt), completionTime(row)].filter(
      (time): time is number => time !== null && time <= nowMs,
    );
    for (const time of times) earliest = earliest === null ? time : Math.min(earliest, time);
    return earliest;
  }, null);
  const seriesStart =
    startMs ??
    (earliestEvent === null
      ? null
      : new Date(`${localDay(new Date(earliestEvent))}T00:00:00-03:00`).getTime());
  if (seriesStart !== null) {
    // Preserve days without events, including in the complete history. Otherwise an area
    // chart would interpolate a delivery across months in which no delivery occurred.
    for (let t = seriesStart; t <= nowMs; t += DAY) group(localDay(new Date(t)));
  }
  for (const row of rows) {
    const openedAt = timestamp(row.createdAt);
    const closedAt = completionTime(row);
    if (inPeriod(openedAt)) group(localDay(new Date(openedAt!))).opened += 1;
    if (inPeriod(closedAt)) group(localDay(new Date(closedAt!))).closed += 1;
  }
  const ordered = [...rows].sort((a, b) => {
    if (isActiveOrder(a) !== isActiveOrder(b)) return isActiveOrder(a) ? -1 : 1;
    if (isActiveOrder(a))
      return (
        (orderDeadline(a) ?? Infinity) - (orderDeadline(b) ?? Infinity) ||
        String(a.id).localeCompare(String(b.id))
      );
    return (
      (completionTime(b) ?? timestamp(b.createdAt) ?? 0) -
      (completionTime(a) ?? timestamp(a.createdAt) ?? 0)
    );
  });
  return {
    active,
    overdue,
    dueToday,
    dueSoon,
    closed,
    withoutSla,
    missingCompletionDate,
    ordered,
    opened: rows.filter((r) => inPeriod(timestamp(r.createdAt))).length,
    series: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
  };
}
