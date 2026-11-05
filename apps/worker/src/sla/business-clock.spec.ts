import { businessMinutesBetween, defaultDays, type TenantCalendar } from './business-clock';

const cal = (exceptions: Array<[string, boolean]> = []): TenantCalendar => ({
  timezone: 'America/Fortaleza',
  days: defaultDays([]),
  exceptions: new Map(
    exceptions.map(([day, isWorkDay]) => [day, { isWorkDay, startTime: null, endTime: null }]),
  ),
});

describe('businessMinutesBetween', () => {
  it('fim de semana não conta', () => {
    // Sexta 23h → segunda 01h (Fortaleza): 1h de sexta + 1h de segunda.
    expect(
      businessMinutesBetween(
        new Date('2026-10-23T23:00:00-03:00'),
        new Date('2026-10-26T01:00:00-03:00'),
        cal(),
      ),
    ).toBe(120);
  });

  it('feriado não conta', () => {
    expect(
      businessMinutesBetween(
        new Date('2026-11-01T22:00:00-03:00'),
        new Date('2026-11-03T02:00:00-03:00'),
        cal([['2026-11-02', false]]),
      ),
    ).toBe(120);
  });

  it('horário de expediente configurado', () => {
    const c = cal();
    c.days[1] = { isWorkDay: true, startTime: '08:00', endTime: '18:00' };
    expect(
      businessMinutesBetween(
        new Date('2026-10-26T07:00:00-03:00'),
        new Date('2026-10-26T09:30:00-03:00'),
        c,
      ),
    ).toBe(90);
  });
});
