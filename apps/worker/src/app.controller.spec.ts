import { AppController } from './app.controller';

describe('AppController', () => {
  it('exposes basic health and protected operational status/actions', async () => {
    const ixc = {
      getStatus: jest.fn().mockReturnValue({ running: false, lastProcessed: 2 }),
      runOnce: jest.fn().mockResolvedValue(undefined),
    };
    const retention = {
      getStatus: jest.fn().mockReturnValue({ running: false, lastProcessed: 1 }),
      runOnce: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AppController(ixc as any, retention as any);

    expect(controller.health()).toEqual(
      expect.objectContaining({ service: 'worker', status: 'ok', timestamp: expect.any(String) }),
    );
    expect(controller.status()).toEqual(
      expect.objectContaining({
        ixcReconciliation: { running: false, lastProcessed: 2 },
        exportRetention: { running: false, lastProcessed: 1 },
      }),
    );
    await expect(controller.triggerReconcile()).resolves.toEqual(
      expect.objectContaining({ ok: true, lastProcessed: 2 }),
    );
    await expect(controller.triggerExportCleanup()).resolves.toEqual(
      expect.objectContaining({ ok: true, lastProcessed: 1 }),
    );
    expect(ixc.runOnce).toHaveBeenCalled();
    expect(retention.runOnce).toHaveBeenCalled();
  });
});
