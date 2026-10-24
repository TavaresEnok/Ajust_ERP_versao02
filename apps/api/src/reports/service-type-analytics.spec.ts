import { buildServiceTypeAnalytics } from './service-type-analytics';

const now = new Date('2026-10-21T12:00:00Z');
const order = (overrides = {}) => ({
  type: 'BGP',
  status: 'ABERTA',
  priority: 'NORMAL',
  createdAt: new Date('2026-10-20T12:00:00Z'),
  deadlineAt: new Date('2026-10-22T12:00:00Z'),
  slaEligible: true,
  occurrence: { type: 'Configuração BGP', provider: 'Meganet', customerId: 'c1' },
  ...overrides,
});

describe('buildServiceTypeAnalytics', () => {
  it('agrupa pelo tipo real sem contar demonstrações ou colapsar tipos no enum', () => {
    const result = buildServiceTypeAnalytics(
      [
        order({ sourceMetadata: { originalType: 'BGP de borda' } }),
        order({ sourceMetadata: { originalType: 'BGP de trânsito' } }),
        order({ sourceMetadata: { demonstration: true, originalType: 'Inventado' } }),
      ],
      undefined,
      now,
    );
    expect(result.summary.totalOrders).toBe(2);
    expect(result.summary.types).toBe(2);
    expect(result.summary.excludedDemonstrations).toBe(1);
  });
  it('calcula resolução apenas com encerramentos válidos e separa apontamento de trabalho', () => {
    const result = buildServiceTypeAnalytics(
      [
        order({ status: 'FECHADA', closedAt: now, timeEntries: [{ minutes: 30 }] }),
        order({ status: 'RESOLVIDA', resolvedAt: new Date('2026-10-20T12:00:00Z') }),
        order({ status: 'FECHADA', closedAt: new Date('2026-10-19T12:00:00Z') }),
        order({ status: 'FECHADA' }),
        order({ status: 'CANCELADA', closedAt: now }),
      ],
      undefined,
      now,
    );
    expect(result.summary.avgResolutionHours).toBe(12);
    expect(result.summary.measuredClosed).toBe(2);
    expect(result.summary.canceled).toBe(1);
    expect(result.rows[0].loggedMinutes).toBe(30);
  });
  it('não inventa atrasos para histórico sem SLA e não trata cancelamento como conclusão', () => {
    const result = buildServiceTypeAnalytics(
      [
        order({ deadlineAt: new Date('2026-10-20T11:00:00Z'), slaEligible: false }),
        order({ deadlineAt: new Date('2026-10-21T11:59:00Z') }),
        order({ deadlineAt: new Date('2026-10-21T14:00:00Z') }),
        order({ status: 'CANCELADA', deadlineAt: new Date('2026-10-21T11:00:00Z') }),
      ],
      undefined,
      now,
    );
    expect(result.summary.overdue).toBe(1);
    expect(result.summary.dueSoon).toBe(1);
    expect(result.summary.withoutSla).toBe(1);
    expect(result.summary.closed).toBe(0);
  });
  it('filtra provedor preservando as opções e consolida responsáveis', () => {
    const result = buildServiceTypeAnalytics(
      [
        order({ analystName: 'Ana', assigneeUserId: 'u1' }),
        order({ analystName: 'ANA', assigneeUserId: 'u1' }),
        order({ occurrence: { type: 'DNS', provider: 'Homenet', customerId: 'c2' } }),
      ],
      'meganet',
      now,
    );
    expect(result.summary.totalOrders).toBe(2);
    expect(result.providerOptions).toHaveLength(2);
    expect(result.rows[0].analysts).toEqual([{ name: 'Ana', orders: 2 }]);
    expect(result.providers[0].customerId).toBe('c1');
  });
});
