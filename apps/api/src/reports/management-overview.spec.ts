import {
  buildManagementOverview,
  managementPeriod,
  type ManagementOrder,
} from './management-overview';
import { ReportsService } from './reports.service';

describe('Management overview', () => {
  const now = new Date('2026-10-29T02:00:00Z'); // 28/10, 23h em Fortaleza.
  const order = (overrides: Partial<ManagementOrder> = {}): ManagementOrder => ({
    id: 'order',
    status: 'ABERTA',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    deadlineAt: new Date('2026-10-28T12:00:00Z'),
    ...overrides,
  });

  it('mantém pendências antigas, mede a entrega pela resolução e exclui demonstrações', () => {
    const result = buildManagementOverview(
      [
        order(),
        order({ id: 'paused', pausedAt: now }),
        order({ id: 'not-eligible', slaEligible: false }),
        order({
          id: 'scheduled',
          scheduledAt: now,
          deadlineAt: new Date(now.getTime() + 3_600_000),
        }),
        order({
          id: 'closed',
          status: 'FECHADA',
          resolvedAt: new Date('2026-10-28T15:00:00Z'),
          closedAt: now,
          deadlineAt: new Date('2026-10-28T16:00:00Z'),
        }),
        order({
          id: 'old-delivery',
          status: 'RESOLVIDA',
          resolvedAt: new Date('2026-10-02T12:00:00Z'),
        }),
        order({ id: 'cancelled', status: 'CANCELADA', createdAt: now }),
        order({ id: 'demo', sourceMetadata: { demonstration: true } }),
        order({
          id: 'demo-closed',
          status: 'FECHADA',
          resolvedAt: now,
          sourceMetadata: { demonstration: true },
        }),
      ],
      7,
      now,
    );
    expect(result.operation).toMatchObject({
      totalOpen: 4,
      overdue: 1,
      paused: 1,
      dueSoon: 1,
      unassigned: 4,
      scheduled: 1,
      withoutSla: 1,
    });
    expect(result.results).toMatchObject({
      opened: 1,
      closed: 1,
      slaPercentage: 100,
      slaEvaluated: 1,
    });
    expect(result.population.excludedDemonstrations).toBe(2);
  });

  it('não infere entregas por updatedAt e não gera SLA ou média sem base válida', () => {
    const result = buildManagementOverview(
      [
        order({ id: 'missing', status: 'FECHADA', createdAt: now }),
        order({ id: 'future', status: 'RESOLVIDA', resolvedAt: new Date('2026-10-30T12:00:00Z') }),
        order({
          id: 'inverted',
          status: 'FECHADA',
          createdAt: now,
          resolvedAt: new Date('2026-10-27T12:00:00Z'),
        }),
      ],
      7,
      now,
    );
    expect(result.results).toMatchObject({
      closed: 0,
      measuredClosed: 0,
      tmrHours: null,
      slaPercentage: null,
      slaEvaluated: 0,
      missingCompletionDate: 1,
    });
  });

  it('separa homônimos por ID e reúne alterações do nome da mesma pessoa', () => {
    const result = buildManagementOverview(
      [
        order({
          id: 'a',
          assigneeUserId: 'user-a',
          analystName: 'Ana antiga',
          assignee: { name: 'Ana' },
        }),
        order({
          id: 'b',
          assigneeUserId: 'user-a',
          analystName: 'Ana nova',
          assignee: { name: 'Ana' },
        }),
        order({ id: 'c', assigneeUserId: 'user-b', assignee: { name: 'Ana' } }),
        order({
          id: 'd',
          status: 'FECHADA',
          assigneeUserId: 'user-a',
          assignee: { name: 'Ana' },
          resolvedAt: now,
        }),
      ],
      7,
      now,
    );
    expect(result.team).toHaveLength(2);
    expect(result.team.find((row) => row.userId === 'user-a')).toMatchObject({
      open: 2,
      closed: 1,
    });
    expect(result.team.find((row) => row.userId === 'user-b')).toMatchObject({
      open: 1,
      closed: 0,
    });
  });

  it('usa dias de Fortaleza e conta o primeiro dia, sem incluir o dia anterior', () => {
    expect(managementPeriod(7, now).start.toISOString()).toBe('2026-10-22T03:00:00.000Z');
    const result = buildManagementOverview(
      [
        order({ createdAt: new Date('2026-10-22T03:00:00Z') }),
        order({ createdAt: new Date('2026-10-22T02:59:59Z') }),
      ],
      7,
      now,
    );
    expect(result.results.opened).toBe(1);
    expect(result.operation.totalOpen).toBe(2);
  });

  it('consulta o tenant e removidas no banco e inclui antigas ainda pendentes ou entregues agora', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService({ serviceOrder: { findMany } } as any);
    await service.getManagementOverview('tenant-a', 7);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          deletedAt: null,
          OR: expect.arrayContaining([
            { status: { notIn: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] } },
            { resolvedAt: { gte: expect.any(Date), lte: expect.any(Date) } },
          ]),
        }),
      }),
    );
    await expect(service.getManagementOverview('tenant-a', 0)).rejects.toThrow();
    await expect(service.getManagementOverview('tenant-a', NaN)).rejects.toThrow();
    await expect(service.getManagementOverview('tenant-a', 1.5)).rejects.toThrow();
  });
});
