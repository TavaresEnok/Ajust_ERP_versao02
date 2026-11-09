import { LifecycleOutboxService, EffectRunner } from './lifecycle-outbox.service';

describe('Lifecycle outbox delivery', () => {
  const services: LifecycleOutboxService[] = [];
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    services.forEach((s) => s.onModuleDestroy());
    services.length = 0;
    jest.useRealTimers();
  });

  function setup() {
    const row: any = {
      id: 'event',
      orderId: 'order',
      processedAt: null,
      claimedAt: null,
      claimToken: null,
      attempts: 0,
      completedEffects: [],
      availableAt: new Date(),
      createdAt: new Date(),
    };
    const delegate = {
      findMany: jest.fn(async () =>
        row.processedAt || row.availableAt > new Date() ? [] : [{ ...row }],
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (Object.entries(where).some(([key, value]) => row[key] !== value)) return { count: 0 };
        for (const [key, value] of Object.entries(data))
          row[key] =
            key === 'attempts' ? row.attempts + (value as { increment: number }).increment : value;
        return { count: 1 };
      }),
    };
    const create = (handler: (_event: any, effect: EffectRunner) => Promise<void>) => {
      const service = new LifecycleOutboxService({ serviceOrderLifecycleEvent: delegate } as never);
      service.start(handler);
      services.push(service);
      return service;
    };
    return { row, delegate, create };
  }

  it('recovers after a restart without repeating completed effects', async () => {
    const { create, row } = setup();
    const audit = jest.fn();
    const notify = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined);
    const handler = async (_: unknown, effect: EffectRunner) => {
      await effect('audit', audit);
      await effect('notify', notify);
    };
    const first = create(handler);
    await first.deliver();
    first.onModuleDestroy();
    expect(row.completedEffects).toEqual(['audit']);
    expect(row.processedAt).toBeNull();
    jest.setSystemTime(Date.now() + 11_000);
    await create(handler).deliver();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(row.processedAt).toBeInstanceOf(Date);
  });

  it('only one replica claims the same event', async () => {
    const { create, row } = setup();
    const action = jest.fn();
    const handler = async (_: unknown, effect: EffectRunner) => effect('action', action);
    await Promise.all([create(handler).deliver(), create(handler).deliver()]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(row.attempts).toBe(1);
  });

  it('does not discard an event after five failures', async () => {
    const { create, row } = setup();
    row.attempts = 10;
    await create(async () => {
      throw new Error('unavailable');
    }).deliver();
    expect(row.attempts).toBe(11);
    expect(row.processedAt).toBeNull();
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(row.claimToken).toBeNull();
  });

  it('does not publish effects after losing the event lease', async () => {
    const { create, delegate } = setup();
    delegate.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const action = jest.fn();
    await create(async (_, effect) => effect('action', action)).deliver();
    expect(action).not.toHaveBeenCalled();
  });
});
