import { SentryService } from './sentry.service';

describe('SentryService', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  it('warns when production has no DSN and logs local captures', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SENTRY_DSN;
    const service = new SentryService();
    service.captureException(new Error('boom'), { orderId: '1' });
    service.captureMessage('message', 'warning');
    service.setUser('user-1');
    service.clearUser();
    service.addBreadcrumb('orders', 'created');

    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Captured Exception:', 'boom');
    expect(console.error).toHaveBeenCalledWith('Context:', { orderId: '1' });
    expect(console.log).toHaveBeenCalledWith('[WARNING] message');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('uses configured DSN paths for captures and user context', () => {
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://dsn.local/1';
    const service = new SentryService();
    service.captureException(new Error('boom'), { orderId: '1' });
    service.captureMessage('message', 'error', { orderId: '1' });
    service.setUser('user-1', 'user@example.com', 'user');
    service.clearUser();
    service.addBreadcrumb('orders', 'created', 'info', { id: '1' });

    expect(console.log).toHaveBeenCalledWith(
      '✅ Sentry error tracking initialized for production environment',
    );
    expect(console.error).toHaveBeenCalledWith('Exception (would send to Sentry):', 'boom', {
      orderId: '1',
    });
    expect(console.debug).toHaveBeenCalledTimes(3);
  });
});
