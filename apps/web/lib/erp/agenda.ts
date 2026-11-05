import type { ErpRecord } from './contracts';

export const AGENDA_TIMEZONE = 'America/Fortaleza';
export const agendaDay = (value: Date | string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
export const agendaTime = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: AGENDA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
export const agendaInput = (value: string) => `${agendaDay(value)}T${agendaTime(value)}`;
export function agendaEventOnDay(event: { startAt: string; endAt?: string | null }, day: string) {
  const start = new Date(`${day}T00:00:00-03:00`).getTime();
  const end = start + 86400000;
  const eventStart = new Date(event.startAt).getTime();
  const eventEnd = event.endAt ? new Date(event.endAt).getTime() : eventStart;
  return eventStart < end && (eventEnd > start || (!event.endAt && eventStart >= start));
}
export function agendaInterval(startAt: string, endAt?: string | null, allDay = false) {
  const start = new Date(
    startAt.includes('T') ? `${startAt}:00-03:00` : `${startAt}T00:00:00-03:00`,
  );
  if (!Number.isFinite(start.getTime())) throw new Error('Informe uma data de início válida.');
  let end = endAt
    ? new Date(endAt.includes('T') ? `${endAt}:00-03:00` : `${endAt}T00:00:00-03:00`)
    : null;
  if (allDay) {
    const endDay = endAt || startAt;
    end = new Date(`${endDay.split('T')[0]}T00:00:00-03:00`);
    end.setUTCDate(end.getUTCDate() + 1);
  }
  if (end && (!Number.isFinite(end.getTime()) || end <= start))
    throw new Error('O término precisa ser depois do início.');
  return { startAt: start.toISOString(), endAt: end?.toISOString() || null };
}
export function managedOrderEvent(event: ErpRecord) {
  return Boolean(event.serviceOrderId && String(event.title).startsWith('Execução · '));
}
