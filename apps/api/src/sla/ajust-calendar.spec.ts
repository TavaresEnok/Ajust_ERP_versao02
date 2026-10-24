import { SlaEngineService } from './sla-engine.service';

describe('Calendário operacional Ajust: SLA útil de 24h', () => {
  const db = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Fortaleza' }) },
    businessCalendar: { findMany: jest.fn().mockResolvedValue([]) },
    businessCalendarException: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const sla = new SlaEngineService(db as never);
  it.each([
    ['2026-10-19T06:00:00-03:00', 48, '2026-10-21T06:00:00-03:00'],
    ['2026-10-23T06:00:00-03:00', 48, '2026-10-27T06:00:00-03:00'],
    ['2026-10-24T02:00:00-03:00', 48, '2026-10-28T00:00:00-03:00'],
    ['2026-10-23T23:00:00-03:00', 2, '2026-10-26T01:00:00-03:00'],
  ])('calcula %s + %s horas úteis', async (start, hours, end) => {
    expect(await sla.calculateTargetDate(new Date(start), hours, 'ajust')).toEqual(new Date(end));
  });
  it('não consome SLA no fim de semana, mas conta madrugada de segunda', async () => {
    expect(await sla.isBusinessTime('ajust', new Date('2026-10-24T02:00:00-03:00'))).toBe(false);
    expect(await sla.isBusinessTime('ajust', new Date('2026-10-26T02:00:00-03:00'))).toBe(true);
  });
  it('pausa sexta às 23h até segunda à 01h suspende somente duas horas úteis', async () => {
    const minutes = await sla.calculateBusinessPauseDuration(new Date('2026-10-23T23:00:00-03:00'), new Date('2026-10-26T01:00:00-03:00'), 'ajust');
    expect(minutes).toBe(120);
    expect(await sla.calculateTargetDate(new Date('2026-10-23T23:00:00-03:00'), minutes / 60, 'ajust')).toEqual(new Date('2026-10-26T01:00:00-03:00'));
  });
});
