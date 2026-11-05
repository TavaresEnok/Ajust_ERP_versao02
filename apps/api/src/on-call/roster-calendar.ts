export interface RosterPolicy {
  effectiveFrom: string;
  dayUserIds: string[];
  nightUserIds: string[];
}
export interface RosterDay {
  date: string;
  userIds: string[];
  holidayName?: string | null;
  notes?: string | null;
}
export function isRosterDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  );
}
export function addRosterDays(date: string, count: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}
export function resolveRosterDay(
  date: string,
  policies: RosterPolicy[],
  override?: RosterDay,
  calendarHoliday?: string,
) {
  const policy = [...policies].reverse().find((entry) => entry.effectiveFrom <= date);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const holidayName = override?.holidayName || calendarHoliday || null;
  const dayUserIds =
    override?.userIds ?? (weekend || holidayName ? [] : (policy?.dayUserIds ?? []));
  const nightUserIds = policy?.nightUserIds ?? [];
  return {
    date,
    weekend,
    holidayName,
    dayUserIds,
    nightUserIds,
    notes: override?.notes || null,
    daySource: override ? 'programmed' : weekend || holidayName ? 'pending' : 'fixed',
    dayPending: dayUserIds.length === 0,
    nightPending: nightUserIds.length === 0,
  };
}
