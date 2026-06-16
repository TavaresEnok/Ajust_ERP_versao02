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

  describe('getManagerKPIs', () => {
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
        },
        {
          id: '2',
          analystName: 'Ana',
          status: 'RESOLVIDA',
          priority: 'ALTA',
          createdAt: created,
          deadlineAt: null,
          updatedAt: new Date('2025-01-03'),
        },
      ];
      svc = new ReportsService(makePrismaWithOrders(orders));
      const result = await svc.getManagerKPIs('tenant-1');
      const ana = result.performanceByAnalyst.find((a) => a.name === 'Ana');
      expect(ana).toBeDefined();
      expect(ana!.closed).toBe(2);
      expect(ana!.tmrHours).toBeGreaterThan(0);
    });

    it('agrupa ordens por analista, incluindo Unassigned', async () => {
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
      expect(result.performanceByAnalyst.find((a) => a.name === 'Unassigned')).toBeDefined();
      expect(result.performanceByAnalyst.find((a) => a.name === 'Bob')).toBeDefined();
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
