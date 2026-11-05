import { IxcInternalController } from './ixc-internal.controller';
import { IxcService } from './ixc.service';
describe('Internal IXC reconciliation', () => {
  const previous = process.env.WORKER_API_TOKEN;
  afterEach(() => {
    if (previous === undefined) delete process.env.WORKER_API_TOKEN;
    else process.env.WORKER_API_TOKEN = previous;
  });
  it('fails closed and only delegates with the worker token', async () => {
    const service = { applyPollingDelta: jest.fn() };
    const controller = new IxcInternalController(service as never);
    delete process.env.WORKER_API_TOKEN;
    expect(() => controller.apply('Bearer arbitrary', {})).toThrow('Token');
    process.env.WORKER_API_TOKEN = 'worker-secret';
    expect(() => controller.apply('Bearer wrong', {})).toThrow('Token');
    controller.apply('Bearer worker-secret', {
      tenantId: '10000000-0000-4000-8000-000000000001',
      delta: { externalProtocol: 'EXT' },
    });
    expect(service.applyPollingDelta).toHaveBeenCalledTimes(1);
  });
  it('compares external timestamps rather than local edits', async () => {
    const db = {
      providerIntegration: { findFirst: jest.fn().mockResolvedValue({ id: 'ixc' }) },
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order',
          sourceMetadata: { ixcUpdatedAt: '2026-11-04T10:00:00Z' },
        }),
        updateMany: jest.fn(),
      },
    };
    const service = new IxcService(db as never, {} as never, {} as never);
    expect(
      await service.applyPollingDelta('tenant', {
        externalProtocol: 'EXT',
        updatedAt: '2026-11-04T09:00:00Z',
      }),
    ).toMatchObject({ applied: false });
    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    db.providerIntegration.findFirst.mockResolvedValue(null);
    await expect(service.applyPollingDelta('tenant', { externalProtocol: 'EXT' })).rejects.toThrow(
      'inativa',
    );
  });
});
