import { fromZonedTime } from 'date-fns-tz';

/**
 * Minutos úteis entre dois instantes, com o calendário do tenant (auditoria C-027).
 * Mesma regra do motor da API: sem linha de calendário, dias úteis 00:00–24:00 e fim de
 * semana parado; exceções por data substituem o dia. O calendário é carregado uma vez por
 * rodada do monitor, não a cada O.S.
 */
export type DayRule = { isWorkDay: boolean; startTime: string; endTime: string };
export type ExceptionRule = {
  isWorkDay: boolean;
  startTime: string | null;
  endTime: string | null;
};
export type TenantCalendar = {
  timezone: string;
  days: Record<number, DayRule>;
  /** Chave AAAA-MM-DD (data de parede do tenant). */
  exceptions: Map<string, ExceptionRule>;
};

export function defaultDays(rows: Array<{ dayOfWeek: number } & DayRule>): Record<number, DayRule> {
  const days: Record<number, DayRule> = {};
  for (let d = 0; d < 7; d++) {
    const row = rows.find((r) => r.dayOfWeek === d);
    days[d] = row
      ? { isWorkDay: row.isWorkDay, startTime: row.startTime, endTime: row.endTime }
      : { isWorkDay: d !== 0 && d !== 6, startTime: '00:00', endTime: '24:00' };
  }
  return days;
}

const wallDay = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date); // AAAA-MM-DD

const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const at = (day: string, time: string, timezone: string) =>
  time === '24:00'
    ? fromZonedTime(`${nextDay(day)}T00:00:00`, timezone)
    : fromZonedTime(`${day}T${time}:00`, timezone);

export function businessMinutesBetween(start: Date, end: Date, cal: TenantCalendar) {
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  let day = wallDay(start, cal.timezone);
  const last = wallDay(end, cal.timezone);
  for (let guard = 0; guard < 400; guard++) {
    const exception = cal.exceptions.get(day);
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    const rule = cal.days[dow];
    const isWork = exception ? exception.isWorkDay : rule.isWorkDay;
    if (isWork) {
      const open = at(day, exception?.startTime || rule.startTime, cal.timezone).getTime();
      const close = at(day, exception?.endTime || rule.endTime, cal.timezone).getTime();
      const from = Math.max(open, start.getTime());
      const to = Math.min(close, end.getTime());
      if (to > from) total += (to - from) / 60000;
    }
    if (day === last) break;
    day = nextDay(day);
  }
  return total;
}
