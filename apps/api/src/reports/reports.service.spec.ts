import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let svc: ReportsService;

  function makePrismaWithOrders(orders: any[]) {
    return {
      serviceOrder: {
        findMany: jest.fn().mockResolvedValue(orders),
      },
      serviceOrderStatusEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
  }

  beforeEach(() => {
    svc = new ReportsService(makePrismaWithOrders([]));
  });

  describe('getServiceTypes', () => {
    it('health groups by linked provider, not the requester', async () => {
      svc = new ReportsService(
        makePrismaWithOrders([
          {
            requester: 'João',
            status: 'ABERTA',
            occurrence: { provider: 'MEGANET', customerId: '60' },
          },
          {
            requester: 'Maria',
            status: 'FECHADA',
            occurrence: { provider: 'MEGANET', customerId: '60' },
          },
          {
            requester: 'João',
            status: 'ABERTA',
            occurrence: { provider: 'HOMENET', customerId: '108' },
          },
          { requester: 'Visitante', status: 'ABERTA' },
        ]),
      );
      const rows = await svc.getOperationalHealth('tenant-1');
      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.customerId === '60')?.totalOrders).toBe(2);
      expect(rows.map((r) => r.name).sort()).toEqual(['HOMENET', 'Interno', 'MEGANET']);
    });
    it('limita ao tenant, exclui removidas e aplica o período completo no banco', async () => {
      const prisma = makePrismaWithOrders([]);
      svc = new ReportsService(prisma);
      const result = await svc.getServiceTypes('tenant-1', {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-21',
        provider: 'Meganet',
      });
      expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            deletedAt: null,
            createdAt: {
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: new Date('2026-10-21T23:59:59.999Z'),
            },
          },
        }),
      );
      expect(result.summary.totalOrders).toBe(0);
    });
    it('rejeita período invertido, datas inválidas e quantidade inválida de dias', async () => {
      await expect(
        svc.getServiceTypes('tenant-1', { periodStart: '2026-10-21', periodEnd: '2026-10-01' }),
      ).rejects.toThrow();
      await expect(svc.getServiceTypes('tenant-1', { periodStart: 'não-data' })).rejects.toThrow();
      await expect(svc.getServiceTypes('tenant-1', { daysBack: 0 })).rejects.toThrow();
      await expect(svc.getServiceTypes('tenant-1', { daysBack: NaN })).rejects.toThrow();
      await expect(svc.getServiceTypes('tenant-1', { source: 'arbitraria' })).rejects.toThrow();
    });
    it('permite consultar apenas o SGP sem alterar o escopo de tenant', async () => {
      const prisma = makePrismaWithOrders([]);
      svc = new ReportsService(prisma);
      await svc.getServiceTypes('tenant-1', { source: 'SGP' });
      expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', deletedAt: null, sourceSystem: 'SGP' },
        }),
      );
    });
  });

  describe('getManagerKPIs', () => {
    it('does not invent a measurement base', async () => {
      const { overview } = await svc.getManagerKPIs('tenant-1');
      expect(overview.tmrHours).toBeNull();
      expect(overview.slaPercentage).toBeNull();
    });
    it('excludes cancellations and missing dates from measurements', async () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const deadlineAt = new Date('2025-01-01T03:00:00Z');
      svc = new ReportsService(
        makePrismaWithOrders([
          {
            analystName: 'Ana',
            status: 'FECHADA',
            createdAt,
            resolvedAt: new Date('2025-01-01T02:00:00Z'),
            deadlineAt,
          },
          {
            analystName: 'Bob',
            status: 'RESOLVIDA',
            createdAt,
            resolvedAt: new Date('2025-01-01T04:00:00Z'),
            deadlineAt,
          },
          { analystName: 'Bob', status: 'CANCELADA', createdAt, deadlineAt },
          {
            analystName: 'Ana',
            status: 'FECHADA',
            createdAt,
            updatedAt: new Date('2025-01-01T20:00:00Z'),
          },
        ]),
      );
      const { overview } = await svc.getManagerKPIs('tenant-1');
      expect(overview.tmrHours).toBe(3);
      expect(overview.measuredClosed).toBe(2);
      expect(overview.slaPercentage).toBe(50);
      expect(overview.slaBreaches).toBe(0);
      expect(overview.totalOpen).toBe(0);
    });
    it('retorna overview zerado quando nao ha ordens', async () => {
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.overview.totalOpen).toBe(0);
      expect(result.overview.totalClosed).toBe(0);
      expect(result.overview.slaBreaches).toBe(0);
      expect(result.performanceByAnalyst).toEqual([]);
    });

    it('conta ordens abertas e fechadas corretamente', async () => {
      const orders = [
        {
          id: '1',
          analystName: 'Ana',
          status: 'ABERTA',
          priority: 'NORMAL',
          createdAt: new Date(),
          deadlineAt: null,
          updatedAt: new Date(),
        },
        {
          id: '2',
          analystName: 'Ana',
          status: 'FECHADA',
          priority: 'ALTA',
          createdAt: new Date('2025-01-01'),
          deadlineAt: null,
          updatedAt: new Date('2025-01-15'),
        },
        {
          id: '3',
          analystName: 'Bob',
          status: 'RESOLVIDA',
          priority: 'CRITICA',
          createdAt: new Date('2025-02-01'),
          deadlineAt: null,
          updatedAt: new Date('2025-02-10'),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.overview.totalOpen).toBe(1);
      expect(result.overview.totalClosed).toBe(2);
    });

    it('detecta SLA breaches para ordens abertas com deadline vencido', async () => {
      const pastDeadline = new Date(Date.now() - 86400000);
      const orders = [
        {
          id: '1',
          analystName: 'Ana',
          status: 'ABERTA',
          priority: 'CRITICA',
          createdAt: new Date(),
          deadlineAt: pastDeadline,
          updatedAt: new Date(),
        },
        {
          id: '2',
          analystName: 'Ana',
          status: 'FECHADA',
          priority: 'ALTA',
          createdAt: new Date(),
          deadlineAt: pastDeadline,
          updatedAt: new Date(),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.overview.slaBreaches).toBe(1);
    });

    it('nao conta SLA breach para ordens fechadas', async () => {
      const pastDeadline = new Date(Date.now() - 86400000);
      const orders = [
        {
          id: '1',
          analystName: 'Bob',
          status: 'FECHADA',
          priority: 'CRITICA',
          createdAt: new Date('2025-01-01'),
          deadlineAt: pastDeadline,
          updatedAt: new Date('2025-01-15'),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.overview.slaBreaches).toBe(0);
    });

    it('calcula TMR por analista', async () => {
      const created = new Date('2025-01-01');
      const resolved = new Date('2025-01-02');
      const orders = [
        {
          id: '1',
          analystName: 'Ana',
          status: 'FECHADA',
          priority: 'NORMAL',
          createdAt: created,
          deadlineAt: null,
          updatedAt: resolved,
          resolvedAt: resolved,
        },
        {
          id: '2',
          analystName: 'Ana',
          status: 'RESOLVIDA',
          priority: 'ALTA',
          createdAt: created,
          deadlineAt: null,
          updatedAt: new Date('2025-01-03'),
          resolvedAt: new Date('2025-01-03'),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      const ana = result.performanceByAnalyst.find((a) => a.name === 'Ana');
      expect(ana).toBeDefined();
      expect(ana!.closed).toBe(2);
      expect(ana!.tmrHours).toBeGreaterThan(0);
    });

    it('utiliza resolvedAt e nao updatedAt para evitar distorcao no calculo de TMR', async () => {
      const created = new Date('2025-01-01T10:00:00.000Z');
      const resolved = new Date('2025-01-01T12:00:00.000Z'); // Resolvida em exatamente 2h
      const updatedDaysLater = new Date('2025-01-20T10:00:00.000Z'); // Editada 19 dias depois (anotação/tag)

      const orders = [
        {
          id: '1',
          analystName: 'Carlos',
          status: 'RESOLVIDA',
          priority: 'NORMAL',
          createdAt: created,
          deadlineAt: null,
          resolvedAt: resolved,
          closedAt: null,
          updatedAt: updatedDaysLater,
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      const carlos = result.performanceByAnalyst.find((a) => a.name === 'Carlos');
      expect(carlos).toBeDefined();
      expect(carlos!.closed).toBe(1);
      // Deve ser 2 horas, e NÃO ~456 horas como seria usando updatedAt
      expect(carlos!.tmrHours).toBe(2);
    });

    it('agrupa ordens por responsável, incluindo as sem responsável', async () => {
      const orders = [
        {
          id: '1',
          analystName: null,
          status: 'ABERTA',
          priority: 'NORMAL',
          createdAt: new Date(),
          deadlineAt: null,
          updatedAt: new Date(),
        },
        {
          id: '2',
          analystName: 'Bob',
          status: 'ABERTA',
          priority: 'ALTA',
          createdAt: new Date(),
          deadlineAt: null,
          updatedAt: new Date(),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.performanceByAnalyst).toHaveLength(2);
      expect(result.performanceByAnalyst.find((a) => a.name === 'Sem responsável')).toBeDefined();
      expect(result.performanceByAnalyst.find((a) => a.name === 'Bob')).toBeDefined();
    });
  });

  describe('getManagerKPIs — agrupamento por id (C-040)', () => {
    const base = {
      status: 'FECHADA',
      priority: 'NORMAL',
      slaEligible: true,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      deadlineAt: new Date('2026-10-02T00:00:00Z'),
      updatedAt: new Date(),
    };
    it('o mesmo responsável com nomes diferentes vira uma linha só', async () => {
      const svc = new ReportsService(
        makePrismaWithOrders([
          {
            ...base,
            id: '1',
            assigneeUserId: 'u1',
            analystName: 'Ana',
            resolvedAt: new Date('2026-10-01T10:00:00Z'),
          },
          {
            ...base,
            id: '2',
            assigneeUserId: 'u1',
            analystName: 'Ana Souza',
            resolvedAt: new Date('2026-10-03T10:00:00Z'),
          },
        ]),
      );
      const result = await svc.getManagerKPIs('tenant-1');
      expect(result.performanceByAnalyst).toHaveLength(1);
      expect(result.performanceByAnalyst[0]).toMatchObject({
        userId: 'u1',
        closed: 2,
        closedLate: 1,
      });
      expect(result.overview).toMatchObject({ closedLate: 1, tmrBasis: 'HORAS_CORRIDAS' });
    });
    it('separa resolvidas aguardando fechamento das fechadas', async () => {
      const svc = new ReportsService(
        makePrismaWithOrders([
          {
            ...base,
            id: '1',
            status: 'RESOLVIDA',
            assigneeUserId: 'u1',
            analystName: 'Ana',
            resolvedAt: new Date('2026-10-01T10:00:00Z'),
          },
        ]),
      );
      expect((await svc.getManagerKPIs('tenant-1')).overview.resolvedAwaitingClosure).toBe(1);
    });
  });

  describe('getServiceOrderFlow', () => {
    it('retorna estrutura vazia sem ordens', async () => {
      const result = await svc.getServiceOrderFlow('tenant-1', {});
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.totalOrders).toBe(0);
    });

    it('retorna nodes com contagem por status', async () => {
      const orders = [
        { id: '1', status: 'ABERTA', priority: 'NORMAL', protocol: 'OS-001', deadlineAt: null },
        { id: '2', status: 'ABERTA', priority: 'CRITICA', protocol: 'OS-002', deadlineAt: null },
        { id: '3', status: 'FECHADA', priority: 'BAIXA', protocol: 'OS-003', deadlineAt: null },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getServiceOrderFlow('tenant-1', {});
      const aberta = result.nodes.find((n) => n.status === 'ABERTA');
      expect(aberta).toBeDefined();
      expect(aberta!.total).toBe(2);
      expect(aberta!.priorityBreakdown).toEqual({ NORMAL: 1, CRITICA: 1 });
      expect(result.totalOrders).toBe(3);
    });

    it('retorna edges com contagem de transicoes', async () => {
      const orders = [
        { id: '1', status: 'ABERTA', priority: 'NORMAL', protocol: 'OS-001', deadlineAt: null },
        { id: '2', status: 'EM_ANALISE', priority: 'NORMAL', protocol: 'OS-002', deadlineAt: null },
      ];
      const events = [
        { fromStatus: 'ABERTA', toStatus: 'EM_ANALISE' },
        { fromStatus: 'ABERTA', toStatus: 'EM_ANALISE' },
        { fromStatus: 'EM_ANALISE', toStatus: 'RESOLVIDA' },
      ];
      const prisma = {
        serviceOrder: { findMany: jest.fn().mockResolvedValue(orders) },
        serviceOrderStatusEvent: { findMany: jest.fn().mockResolvedValue(events) },
      } as any;
      svc = new ReportsService(prisma);
      const result = await svc.getServiceOrderFlow('tenant-1', {});
      const edge = result.edges.find((e) => e.from === 'ABERTA' && e.to === 'EM_ANALISE');
      expect(edge).toBeDefined();
      expect(edge!.count).toBe(2);
    });

    it('aplica filtro de periodo nas ordens', async () => {
      const prisma = {
        serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
        serviceOrderStatusEvent: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      svc = new ReportsService(prisma);
      await svc.getServiceOrderFlow('tenant-1', {
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
      });
      const callArgs = prisma.serviceOrder.findMany.mock.calls[0][0];
      expect(callArgs.where.createdAt.gte instanceof Date).toBe(true);
      expect(callArgs.where.createdAt.lte instanceof Date).toBe(true);
      expect(callArgs.where.createdAt.lte.toISOString()).toBe('2025-12-31T23:59:59.999Z');
    });

    it('rejeita datas de periodo invalidas ou invertidas', async () => {
      await expect(
        svc.getServiceOrderFlow('tenant-1', { periodStart: 'data-invalida' }),
      ).rejects.toThrow('periodStart must be a valid ISO date');
      await expect(
        svc.getServiceOrderFlow('tenant-1', {
          periodStart: '2025-12-31',
          periodEnd: '2025-01-01',
        }),
      ).rejects.toThrow('periodStart must be before or equal to periodEnd');
    });

    it('aplica filtro de prioridade nas ordens', async () => {
      const prisma = {
        serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
        serviceOrderStatusEvent: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      svc = new ReportsService(prisma);
      await svc.getServiceOrderFlow('tenant-1', { priority: 'CRITICA' });
      const callArgs = prisma.serviceOrder.findMany.mock.calls[0][0];
      expect(callArgs.where.priority).toBe('CRITICA');
    });

    it('marca ordens vencidas como overdue', async () => {
      const pastDeadline = new Date(Date.now() - 86400000);
      const orders = [
        {
          id: '1',
          status: 'ABERTA',
          priority: 'CRITICA',
          protocol: 'OS-001',
          deadlineAt: pastDeadline,
        },
        {
          id: '2',
          status: 'ABERTA',
          priority: 'NORMAL',
          protocol: 'OS-002',
          deadlineAt: new Date(Date.now() + 86400000),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getServiceOrderFlow('tenant-1', {});
      const aberta = result.nodes.find((n) => n.status === 'ABERTA');
      expect(aberta).toBeDefined();
      expect(aberta!.overdue).toBe(1);
    });
  });
});
