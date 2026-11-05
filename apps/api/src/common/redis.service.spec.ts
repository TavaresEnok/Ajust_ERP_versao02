import { RedisService } from './redis.service';
describe('Rate-limit windows', () => {
  const old = process.env.NODE_ENV;
  afterEach(() => {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
    jest.useRealTimers();
  });
  it('sets the increment and expiry atomically in Redis', async () => {
    const service = new RedisService();
    const client = { eval: jest.fn().mockResolvedValue(1) };
    Object.assign(service, { client, isConnected: true });
    expect(await service.incrEx('account', 60)).toBe(1);
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('EXPIRE'"), {
      keys: ['account'],
      arguments: ['60'],
    });
  });
  it('expires the local fallback window without extending it on every request', async () => {
    process.env.NODE_ENV = 'test';
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    const service = new RedisService();
    expect(await service.incrEx('k', 60)).toBe(1);
    jest.setSystemTime(59000);
    expect(await service.incrEx('k', 60)).toBe(2);
    jest.setSystemTime(62000);
    expect(await service.incrEx('k', 60)).toBe(1);
  });
  it('fails closed in production without shared storage', async () => {
    process.env.NODE_ENV = 'production';
    await expect(new RedisService().incrEx('k', 60)).rejects.toThrow('unavailable');
  });
});
