import { UnauthorizedException } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';

describe('MonitoringController', () => {
  const token = 'monitoring-token-for-tests';
  let prisma: any;
  let events: any;
  let sla: any;
  let controller: MonitoringController;

  beforeEach(() => {
    process.env.MONITORING_WEBHOOK_TOKEN = token;
    prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'ajust-demo' }),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          occurrence: { create: jest.fn().mockResolvedValue({ id: 'occurrence-1' }) },
          serviceOrder: {
            create: jest.fn().mockResolvedValue({ id: 'order-1', deadlineAt: new Date() }),
          },
        }),
      ),
    };
    events = { emitTenantEvent: jest.fn() };
    sla = {
      findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 4 }),
      calculateTargetDate: jest.fn().mockResolvedValue(new Date('2026-06-05T16:00:00.000Z')),
    };
    controller = new MonitoringController(prisma, events, sla);
  });

  afterEach(() => {
    delete process.env.MONITORING_WEBHOOK_TOKEN;
  });

  it('rejects invalid token', async () => {
    await expect(
      controller.handleZabbixWebhook('Bearer invalid', 'ajust-demo', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns no tenant for inactive or unknown tenant slug', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);
    await expect(
      controller.handleZabbixWebhook(`Bearer ${token}`, 'missing', { eventName: 'Down' }),
    ).resolves.toEqual({ status: 'no tenant' });
  });

  it('creates critical incident using tenant SLA and emits event', async () => {
    const result = await controller.handleZabbixWebhook(`Bearer ${token}`, ' ajust-demo ', {
      eventName: 'Core down',
      host: 'router-1',
      severity: 'Disaster',
    });

    expect(sla.findApplicablePolicy).toHaveBeenCalledWith('tenant-1', 'CRITICA', 'ROMPIMENTO');
    expect(sla.calculateTargetDate).toHaveBeenCalledWith(expect.any(Date), 4, 'tenant-1');
    expect(events.emitTenantEvent).toHaveBeenCalledWith('tenant-1', 'order_created', {
      orderId: 'order-1',
      source: 'ZABBIX',
    });
    expect(result).toEqual({ success: true, orderId: 'order-1' });
  });
});
