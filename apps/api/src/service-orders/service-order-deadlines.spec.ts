import { deadlineWhere } from './service-order-deadlines';

describe('Service order deadline filters', () => {
  const now = new Date('2026-10-27T02:30:00Z');

  it('excludes paused, resolved, closed and cancelled orders from overdue and upcoming filters', () => {
    for (const filter of ['overdue', 'today', 'soon'] as const) {
      expect(deadlineWhere(filter, now)).toMatchObject({
        status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
        pausedAt: null,
        slaEligible: true,
      });
    }
    expect(deadlineWhere('overdue', now).deadlineAt).toEqual({ lt: now });
    expect(deadlineWhere('soon', now).deadlineAt).toEqual({
      gte: now,
      lte: new Date('2026-10-27T04:30:00Z'),
    });
  });

  it('uses the company local day rather than the UTC day, including month and year boundaries', () => {
    expect(deadlineWhere('today', now).deadlineAt).toEqual({
      gte: new Date('2026-10-26T03:00:00Z'),
      lt: new Date('2026-10-27T03:00:00Z'),
    });
    expect(deadlineWhere('today', new Date('2027-01-01T01:00:00Z')).deadlineAt).toEqual({
      gte: new Date('2026-12-31T03:00:00Z'),
      lt: new Date('2027-01-01T03:00:00Z'),
    });
  });

  it('respects a configured company timezone even on daylight-saving transition days', () => {
    expect(
      deadlineWhere('today', new Date('2026-03-08T12:00:00Z'), 'America/New_York').deadlineAt,
    ).toEqual({
      gte: new Date('2026-03-08T05:00:00Z'),
      lt: new Date('2026-03-09T04:00:00Z'),
    });
  });

  it('keeps paused and SLA-ineligible orders available in explicit separate filters', () => {
    expect(deadlineWhere('paused', now)).toMatchObject({ pausedAt: { not: null } });
    expect(deadlineWhere('without', now)).toMatchObject({ slaEligible: false });
    expect(deadlineWhere('without', now).deadlineAt).toBeUndefined();
  });
});
