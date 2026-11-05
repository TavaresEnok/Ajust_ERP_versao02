export type RosterMember = { id: string; name: string; active: boolean };

export type RosterDay = {
  date: string;
  weekend: boolean;
  holidayName: string | null;
  dayUserIds: string[];
  nightUserIds: string[];
  notes: string | null;
  daySource: string;
  dayPending: boolean;
  nightPending: boolean;
};

export function addRosterDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function rosterWeekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addRosterDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function rosterDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
) {
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function countSpecialAssignments(days: RosterDay[]) {
  const counts = new Map<string, number>();
  for (const day of days) {
    if (!day.weekend && !day.holidayName) continue;
    for (const id of new Set(day.dayUserIds)) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function calendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545: fold by UTF-8 octets without splitting a character.
function calendarLine(value: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '';
  let size = 0;
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      lines.push(current);
      current = ' ';
      size = 1;
    }
    current += character;
    size += bytes;
  }
  lines.push(current);
  return lines.join('\r\n');
}

/** Date-only reminders: no shift start/end hours have been configured. */
export function buildRosterCalendar({
  days,
  members,
  tenantId,
  userId,
  now = new Date(),
}: {
  days: RosterDay[];
  members: RosterMember[];
  tenantId: string;
  userId?: string;
  now?: Date;
}) {
  const byId = new Map(members.map((member) => [member.id, member.name]));
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ajust ERP//Escala de plantao//PT-BR',
    'CALSCALE:GREGORIAN',
  ];
  for (const day of days) {
    if (
      (!day.weekend && !day.holidayName) ||
      !day.dayUserIds.length ||
      (userId && !day.dayUserIds.includes(userId))
    )
      continue;
    const team = day.dayUserIds.map((id) => byId.get(id) || 'Integrante indisponível').join(', ');
    const description = [
      `Equipe diurna: ${team}`,
      day.holidayName ? `Feriado: ${day.holidayName}` : '',
      day.notes || '',
    ]
      .filter(Boolean)
      .join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:plantao-diurno-${day.date}-${tenantId}@ajust.erp`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addRosterDays(day.date, 1).replace(/-/g, '')}`,
      `SUMMARY:${calendarText('Plantão diurno · Ajust')}`,
      `DESCRIPTION:${calendarText(description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(calendarLine).join('\r\n') + '\r\n';
}
