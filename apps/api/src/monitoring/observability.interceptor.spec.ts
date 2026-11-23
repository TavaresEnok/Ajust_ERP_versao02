import { lastValueFrom, of, throwError } from 'rxjs';
import { ObservabilityInterceptor } from './observability.interceptor';

function context(request: any, response: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
}

describe('ObservabilityInterceptor', () => {
  it('records successful request with authenticated user', async () => {
    const metrics = { recordHttpRequest: jest.fn() };
    const logger = { logHttpRequest: jest.fn(), error: jest.fn() };
    const interceptor = new ObservabilityInterceptor(metrics as any, logger as any);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          context(
            { method: 'GET', path: '/orders', auth: { userId: 'user-1' } },
            { statusCode: 201 },
          ),
          { handle: () => of({ ok: true }) },
        ),
      ),
    ).resolves.toEqual({ ok: true });

    expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/orders',
      201,
      expect.any(Number),
    );
    expect(logger.logHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/orders',
      201,
      expect.any(Number),
      'user-1',
    );
  });

  it('records error request and anonymous user', async () => {
    const metrics = { recordHttpRequest: jest.fn() };
    const logger = { logHttpRequest: jest.fn(), error: jest.fn() };
    const interceptor = new ObservabilityInterceptor(metrics as any, logger as any);
    const error = Object.assign(new Error('denied'), { status: 403 });

    await expect(
      lastValueFrom(
        interceptor.intercept(context({ method: 'POST', path: '/orders' }, { statusCode: 200 }), {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toThrow('denied');

    expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/orders',
      403,
      expect.any(Number),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'POST /orders - Status: 403',
      error,
      'HTTP',
      expect.objectContaining({ userId: 'anonymous' }),
    );
  });

  it('normaliza UUIDs e usa o template de rota para evitar explosão de cardinalidade', async () => {
    const metrics = { recordHttpRequest: jest.fn() };
    const logger = { logHttpRequest: jest.fn(), error: jest.fn() };
    const interceptor = new ObservabilityInterceptor(metrics as any, logger as any);

    await lastValueFrom(
      interceptor.intercept(
        context(
          {
            method: 'GET',
            baseUrl: '/service-orders',
            route: { path: '/:id' },
            path: '/service-orders/123e4567-e89b-12d3-a456-426614174000',
          },
          { statusCode: 200 },
        ),
        { handle: () => of({ ok: true }) },
      ),
    );
    await lastValueFrom(
      interceptor.intercept(
        context(
          {
            method: 'GET',
            path: '/service-orders/123e4567-e89b-12d3-a456-426614174000/attachments/42',
          },
          { statusCode: 200 },
        ),
        { handle: () => of({ ok: true }) },
      ),
    );

    expect(metrics.recordHttpRequest).toHaveBeenNthCalledWith(
      1,
      'GET',
      '/service-orders/:id',
      200,
      expect.any(Number),
    );
    expect(metrics.recordHttpRequest).toHaveBeenNthCalledWith(
      2,
      'GET',
      '/service-orders/:id/attachments/:id',
      200,
      expect.any(Number),
    );
  });

  it('works without optional observability services', async () => {
    const interceptor = new ObservabilityInterceptor();
    await expect(
      lastValueFrom(
        interceptor.intercept(context({ method: 'GET', path: '/' }, {}), {
          handle: () => of('ok'),
        }),
      ),
    ).resolves.toBe('ok');
  });
});
