import { getOperationalQueue, getOperationalSummary } from './service-order-operational';
import type { PrismaService } from '../prisma/prisma.service';

describe('service-order-operational (sem teto de 10.000 O.S.)', () => {
  it('agrega totais acima de 10.000 O.S. diretamente no banco sem truncar', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          totalActive: 15_432n,
          overdue: 2_310n,
          dueSoon: 412n,
          dueToday: 980n,
          withinSla: 11_710n,
          paused: 850n,
          withoutSla: 150n,
          unassigned: 320n,
          scheduled: 95n,
          urgent: 2_600n,
          opened: 4_200n,
          closed: 3_950n,
          allInScope: 48_900n,
          missingCompletionDate: 0n,
        },
      ])
      .mockResolvedValueOnce([
        { status: 'ABERTA', count: 10_001n },
        { status: 'EM_ANALISE', count: 5_431n },
      ])
      .mockResolvedValueOnce([{ provider: 'Meganet', count: 6_100n }])
      .mockResolvedValueOnce([{ userId: 'u-1', name: 'Ana', count: 8_200n, late: 500n }])
      .mockResolvedValueOnce([{ day: '2026-11-23', count: 120n }])
      .mockResolvedValueOnce([{ day: '2026-11-23', count: 95n }]);

    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const result = await getOperationalSummary(prisma, 'tenant-1', {
      scope: 'operation',
      days: 7,
    });

    expect(result.totals.totalActive).toBe(15_432);
    expect(result.totals.overdue).toBe(2_310);
    expect(result.totals.allInScope).toBe(48_900);
    expect(result.byStatus).toEqual([
      { status: 'ABERTA', count: 10_001 },
      { status: 'EM_ANALISE', count: 5_431 },
    ]);
    expect(result.byProvider).toEqual([{ provider: 'Meganet', count: 6_100 }]);
    expect(result.teamLoad).toEqual([{ userId: 'u-1', name: 'Ana', count: 8_200, late: 500 }]);
    expect(result.series.length).toBeGreaterThanOrEqual(7);
  });

  it('pagina fila operacional no servidor preservando a ordenação SQL e o total real > 10.000', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ total: 12_500n }])
      .mockResolvedValueOnce([{ id: 'ord-2' }, { id: 'ord-1' }]);
    const findMany = jest.fn().mockResolvedValueOnce([
      { id: 'ord-1', protocol: '2026100001', internalNotes: 'segredo' },
      { id: 'ord-2', protocol: '2026100002', internalNotes: 'segredo' },
    ]);

    const prisma = {
      $queryRaw: queryRaw,
      serviceOrder: { findMany },
    } as unknown as PrismaService;

    const result = await getOperationalQueue(prisma, 'tenant-1', {
      scope: 'operation',
      focus: 'overdue',
      limit: 20,
      offset: 40,
      role: 'gerente',
    });

    expect(result.total).toBe(12_500);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);
    expect(result.items.map((item) => item.id)).toEqual(['ord-2', 'ord-1']);
  });

  it('busca trata %, _ e \\ digitados como texto, não como curingas', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);
    const prisma = {
      $queryRaw: queryRaw,
      serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await getOperationalQueue(prisma, 'tenant-1', {
      scope: 'operation',
      focus: 'all',
      limit: 20,
      offset: 0,
      role: 'gerente',
      search: ' 100%_a\\b ',
    });

    const values = queryRaw.mock.calls[0][0].values as unknown[];
    expect(values).toContain('%100\\%\\_a\\\\b%');
  });
});
