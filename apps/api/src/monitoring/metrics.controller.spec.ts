import { MetricsController } from './metrics.controller';
describe('Metrics authentication', () => {
  const previous = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = previous;
  });
  it.each(['production', 'development', 'test', 'staging'])(
    'requires authentication in %s',
    async (environment) => {
      process.env.NODE_ENV = environment;
      const metrics = { getMetrics: jest.fn() };
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
      await new MetricsController(metrics as never, {} as never, {} as never).metrics(
        response as never,
        { headers: {} } as never,
      );
      expect(response.status).toHaveBeenCalledWith(401);
      expect(metrics.getMetrics).not.toHaveBeenCalled();
    },
  );
});
