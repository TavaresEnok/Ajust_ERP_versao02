import { AppController } from './app.controller';

function response(): any {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('AppController', () => {
  it('reports healthy database and readiness/liveness', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new AppController(prisma as any);
    const res = response();

    await expect(controller.health()).resolves.toEqual(
      expect.objectContaining({
        status: 'healthy',
        checks: expect.objectContaining({
          database: expect.objectContaining({ status: 'healthy' }),
        }),
      }),
    );
    await controller.ready(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ready: true, timestamp: expect.any(String) }),
    );
    await expect(controller.live()).resolves.toEqual(
      expect.objectContaining({ alive: true, uptime: expect.any(Number) }),
    );
  });

  it('reports degraded health and unavailable readiness without leaking database error', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('password leaked')) };
    const controller = new AppController(prisma as any);
    const res = response();

    const health = await controller.health();
    expect(health.status).toBe('degraded');
    expect(health.checks.database).toEqual({
      status: 'unhealthy',
      error: 'Database unavailable',
    });
    await controller.ready(res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ready: false, error: 'Database not ready' }),
    );
  });
});
