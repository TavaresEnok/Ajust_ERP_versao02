import { SlaMonitoringService } from './sla-monitoring.service';
import { SlaMonitoringProcessor } from '../queues/processors/sla-monitoring.processor';

jest.mock('../common/ssrf-guard', () => ({
  safeFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  assertSafeUrl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Queue: jest.fn().mockImplementation(() => ({
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('SlaMonitoringService & Processor', () => {
  let prismaMock: any;
  let service: SlaMonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    prismaMock = {
      serviceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      slaAuditEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      slaEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'sla-event-1' }),
      },
      notificationConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Todos os dias úteis 24h: os percentuais dos cenários não dependem do dia em que roda.
      businessCalendar: {
        findMany: jest.fn().mockResolvedValue(
          [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek,
            isWorkDay: true,
            startTime: '00:00',
            endTime: '24:00',
          })),
        ),
      },
      businessCalendarException: { findMany: jest.fn().mockResolvedValue([]) },
      onCallSchedule: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    service = new SlaMonitoringService(prismaMock);
  });

  describe('evaluateOpenOrders', () => {
    it('returns zeroes when no open orders exist', async () => {
      prismaMock.serviceOrder.findMany.mockResolvedValue([]);

      const result = await service.evaluateOpenOrders();

      expect(result).toEqual({
        evaluated: 0,
        warnings75: 0,
        warnings90: 0,
        breaches: 0,
        alertsSent: 0,
      });
      expect(prismaMock.slaAuditEvent.create).not.toHaveBeenCalled();
    });

    it('detects and dispatches alerts for 75%, 90% and BREACHED thresholds', async () => {
      const now = new Date();
      // Total duration: 10 hours (600 mins)
      // 1. Order at ~80% elapsed (8h elapsed, 2h remaining) -> WARNING_75
      const order75 = {
        id: 'order-75',
        tenantId: 'tenant-1',
        protocol: 'OS-2026-001',
        title: 'Lentidão fibra',
        status: 'EM_ANALISE',
        priority: 'ALTA',
        type: 'LENTIDAO',
        createdAt: new Date(now.getTime() - 8 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 2 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor Alpha' },
      };

      // 2. Order at ~95% elapsed (9.5h elapsed, 0.5h remaining) -> WARNING_90
      const order90 = {
        id: 'order-90',
        tenantId: 'tenant-1',
        protocol: 'OS-2026-002',
        title: 'BGP Down',
        status: 'ABERTA',
        priority: 'CRITICA',
        type: 'BGP',
        createdAt: new Date(now.getTime() - 9.5 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 0.5 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor Beta' },
      };

      // 3. Order breached (deadline was 1h ago) -> BREACHED
      const orderBreached = {
        id: 'order-breached',
        tenantId: 'tenant-1',
        protocol: 'OS-2026-003',
        title: 'Rompimento cabo submarino',
        status: 'AG_CAMPO',
        priority: 'CRITICA',
        type: 'ROMPIMENTO',
        createdAt: new Date(now.getTime() - 11 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() - 1 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor Gamma' },
      };

      // 4. Order at 50% elapsed (no alert yet)
      const orderSafe = {
        id: 'order-safe',
        tenantId: 'tenant-1',
        protocol: 'OS-2026-004',
        title: 'Troca de ONU',
        status: 'ABERTA',
        priority: 'BAIXA',
        type: 'CONFIGURACAO_ONU',
        createdAt: new Date(now.getTime() - 5 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 5 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor Delta' },
      };

      prismaMock.serviceOrder.findMany.mockResolvedValue([
        order75,
        order90,
        orderBreached,
        orderSafe,
      ]);

      prismaMock.notificationConfig.findMany.mockResolvedValue([
        {
          id: 'cfg-1',
          tenantId: 'tenant-1',
          channel: 'WEBHOOK',
          trigger: 'SLA_BREACH_WARNING',
          target: 'https://webhook.example.com/sla',
          active: true,
        },
      ]);

      const result = await service.evaluateOpenOrders();

      expect(result.evaluated).toBe(4);
      expect(result.warnings75).toBe(1);
      expect(result.warnings90).toBe(1);
      expect(result.breaches).toBe(1);
      expect(result.alertsSent).toBe(3);

      // Verify SlaAuditEvent logged for WARNING_75, WARNING_90 and BREACHED
      expect(prismaMock.slaAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-75',
            eventType: 'WARNING_75',
          }),
        }),
      );
      expect(prismaMock.slaAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-90',
            eventType: 'WARNING_90',
          }),
        }),
      );
      expect(prismaMock.slaAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-breached',
            eventType: 'BREACHED',
          }),
        }),
      );

      // Verify SlaEvent created specifically for breached order
      expect(prismaMock.slaEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceOrderId: 'order-breached',
            snapshotStatus: 'AG_CAMPO',
          }),
        }),
      );

      // Verify webhook calls were made for all 3 alerts (+ the internal "SLA violado"
      // publication for workflows, C-036, when WORKER_API_TOKEN is set).
      const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(calls.filter((u) => !u.includes('/workflows/internal/sla-breach'))).toHaveLength(3);
      if (process.env.WORKER_API_TOKEN)
        expect(calls.filter((u) => u.includes('/workflows/internal/sla-breach'))).toHaveLength(1);
    });

    it('ensures idempotency by not resending already emitted alerts (SLA-02)', async () => {
      const now = new Date();
      const order = {
        id: 'order-already-alerted',
        tenantId: 'tenant-1',
        protocol: 'OS-2026-999',
        title: 'Alerta Duplicado Teste',
        status: 'ABERTA',
        priority: 'ALTA',
        type: 'LENTIDAO',
        createdAt: new Date(now.getTime() - 9.5 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 0.5 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor Teste' },
      };

      prismaMock.serviceOrder.findMany.mockResolvedValue([order]);
      // Simulate that WARNING_90 was ALREADY emitted previously in SlaAuditEvent
      prismaMock.slaAuditEvent.findFirst.mockResolvedValue({
        id: 'existing-event-id',
        orderId: 'order-already-alerted',
        eventType: 'WARNING_90',
      });

      const result = await service.evaluateOpenOrders();

      expect(result.evaluated).toBe(1);
      expect(result.warnings90).toBe(1);
      expect(result.alertsSent).toBe(0); // Deduplicated!
      expect(prismaMock.slaAuditEvent.create).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('resiliently continues evaluation if one webhook target fails', async () => {
      const now = new Date();
      const order1 = {
        id: 'order-1',
        tenantId: 'tenant-1',
        protocol: 'OS-1',
        title: 'OS 1',
        status: 'ABERTA',
        priority: 'ALTA',
        type: 'LENTIDAO',
        createdAt: new Date(now.getTime() - 8 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 2 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor 1' },
      };
      const order2 = {
        id: 'order-2',
        tenantId: 'tenant-1',
        protocol: 'OS-2',
        title: 'OS 2',
        status: 'ABERTA',
        priority: 'ALTA',
        type: 'LENTIDAO',
        createdAt: new Date(now.getTime() - 8 * 3600 * 1000),
        deadlineAt: new Date(now.getTime() + 2 * 3600 * 1000),
        tenant: { id: 'tenant-1', tradeName: 'Provedor 2' },
      };

      prismaMock.serviceOrder.findMany.mockResolvedValue([order1, order2]);
      prismaMock.notificationConfig.findMany.mockResolvedValue([
        {
          id: 'cfg-fail',
          tenantId: 'tenant-1',
          channel: 'WEBHOOK',
          trigger: 'SLA_BREACH_WARNING',
          target: 'https://bad-webhook.com',
          active: true,
        },
      ]);

      // First webhook call rejects, second succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await service.evaluateOpenOrders();

      expect(result.evaluated).toBe(2);
      expect(result.alertsSent).toBe(2);
      expect(prismaMock.slaAuditEvent.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('SlaMonitoringProcessor', () => {
    it('delegates job processing to SlaMonitoringService.evaluateOpenOrders', async () => {
      const evaluateSpy = jest.spyOn(service, 'evaluateOpenOrders').mockResolvedValue({
        evaluated: 5,
        warnings75: 1,
        warnings90: 1,
        breaches: 0,
        alertsSent: 2,
      });

      const processor = new SlaMonitoringProcessor(service);
      await processor.process({ id: 'job-1' } as any);

      expect(evaluateSpy).toHaveBeenCalledTimes(1);

      await processor.onModuleDestroy();
    });
  });

  describe('regras novas do monitor (C-027, C-028, C-029)', () => {
    const order = (overrides: Record<string, unknown> = {}) => ({
      id: 'o1',
      tenantId: 'tenant-1',
      protocol: '2026100001',
      title: 'Link',
      status: 'EM_ANALISE',
      priority: 'ALTA',
      type: 'ROMPIMENTO',
      requester: 'Meganet',
      occurrence: {
        provider: 'Meganet',
        customer: { tradeName: 'Meganet', legalName: 'Meganet Ltda' },
      },
      tenant: { id: 'tenant-1', tradeName: 'Ajust Consultoria', timezone: 'America/Fortaleza' },
      ...overrides,
    });

    it('fim de semana não consome o percentual (calendário padrão)', async () => {
      prismaMock.businessCalendar.findMany.mockResolvedValue([]);
      jest.useFakeTimers().setSystemTime(new Date('2026-10-25T12:00:00-03:00')); // domingo
      prismaMock.serviceOrder.findMany.mockResolvedValue([
        order({
          createdAt: new Date('2026-10-23T23:00:00-03:00'), // sexta 23h
          deadlineAt: new Date('2026-10-26T03:00:00-03:00'), // 4h úteis: 1h sexta + 3h segunda
        }),
      ]);
      const result = await service.evaluateOpenOrders();
      jest.useRealTimers();
      expect(result.warnings75 + result.warnings90 + result.breaches).toBe(0);
    });

    it('prazo novo volta a avisar; idempotência considera o prazo vigente', async () => {
      const deadlineAt = new Date(Date.now() - 60_000);
      prismaMock.serviceOrder.findMany.mockResolvedValue([
        order({ createdAt: new Date(Date.now() - 3_600_000), deadlineAt }),
      ]);
      await service.evaluateOpenOrders();
      expect(prismaMock.slaAuditEvent.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ eventType: 'BREACHED', deadlineAt }),
      });
    });

    it('mensagem usa o provedor atendido e o horário do tenant', async () => {
      prismaMock.notificationConfig.findMany.mockResolvedValue([
        { channel: 'WHATSAPP', target: 'https://wa.example/api' },
      ]);
      const deadlineAt = new Date('2026-11-04T15:00:00Z');
      prismaMock.serviceOrder.findMany.mockResolvedValue([
        order({ createdAt: new Date('2026-11-04T10:00:00Z'), deadlineAt }),
      ]);
      await service.evaluateOpenOrders();
      const whatsapp = (global.fetch as jest.Mock).mock.calls.find((c) =>
        String(c[0]).includes('wa.example'),
      );
      const body = JSON.parse(whatsapp[1].body);
      expect(body.message).toContain('*Cliente:* Meganet');
      expect(body.message).not.toContain('Ajust Consultoria');
      expect(body.message).toContain('04/11/2026, 12:00:00');
    });

    it('violação de O.S. crítica cita o plantonista atual (C-059)', async () => {
      prismaMock.onCallSchedule.findFirst.mockResolvedValue({
        user: { name: 'Bruno Plantão', email: 'bruno@ajust.com' },
      });
      prismaMock.notificationConfig.findMany.mockResolvedValue([
        { channel: 'WEBHOOK', target: 'https://hook.example/sla' },
      ]);
      prismaMock.serviceOrder.findMany.mockResolvedValue([
        order({
          priority: 'CRITICA',
          createdAt: new Date(Date.now() - 7_200_000),
          deadlineAt: new Date(Date.now() - 60_000),
        }),
      ]);
      await service.evaluateOpenOrders();
      const hook = (global.fetch as jest.Mock).mock.calls.find((c) =>
        String(c[0]).includes('hook.example'),
      );
      expect(JSON.parse(hook[1].body).onCall).toEqual({
        name: 'Bruno Plantão',
        email: 'bruno@ajust.com',
      });
    });
  });
});
