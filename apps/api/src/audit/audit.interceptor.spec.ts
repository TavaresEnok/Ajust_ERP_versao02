import { of, lastValueFrom } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

function context(request: Record<string, unknown>): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('AuditInterceptor', () => {
  let prisma: any;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) } };
    interceptor = new AuditInterceptor(prisma);
  });

  it('does not audit safe methods', async () => {
    await lastValueFrom(
      interceptor.intercept(context({ method: 'GET', url: '/service-orders', headers: {} }), {
        handle: () => of({ ok: true }),
      }),
    );
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('audits authenticated service-order close and deeply redacts secrets', async () => {
    const response = await lastValueFrom(
      interceptor.intercept(
        context({
          method: 'PATCH',
          url: '/service-orders/order-1/transition?x=1',
          body: {
            toStatus: 'FECHADA',
            password: 'secret',
            nested: { apiKey: 'key', safe: 'visible' },
            items: [{ token: 'token', name: 'item' }],
          },
          auth: { tenantId: 'tenant-1', userId: 'user-1' },
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
        }),
        { handle: () => of({ statusCode: 204 }) },
      ),
    );

    expect(response).toEqual({ statusCode: 204 });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'OS_CLOSE',
        resourceType: 'service-orders',
        resourceId: 'order-1',
        metadata: expect.objectContaining({
          statusCode: 204,
          body: {
            toStatus: 'FECHADA',
            password: '[REDACTED]',
            nested: { apiKey: '[REDACTED]', safe: 'visible' },
            items: [{ token: '[REDACTED]', name: 'item' }],
          },
        }),
      }),
    });
  });

  it.each([
    ['POST', '/iam/users', 'CREATE_USER'],
    ['PATCH', '/iam/users/user-1', 'UPDATE_USER'],
    ['DELETE', '/iam/users/user-1', 'DELETE_USER'],
    ['POST', '/iam/tenants', 'CREATE_TENANT'],
    ['PATCH', '/iam/tenants/tenant-1', 'UPDATE_TENANT'],
    ['POST', '/knowledge/credentials', 'CREDENTIAL_ACCESS'],
    ['POST', '/auth/login', 'LOGIN'],
    ['POST', '/auth/logout', 'LOGOUT'],
  ])('maps %s %s to %s', async (method, url, expectedAction) => {
    await lastValueFrom(
      interceptor.intercept(
        context({
          method,
          url,
          body: {},
          auth: { tenantId: 'tenant-1', userId: 'user-1' },
          headers: {},
        }),
        { handle: () => of({ ok: true }) },
      ),
    );
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(expectedAction);
  });

  it('does not fail the request when audit persistence fails', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('db unavailable'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          context({
            method: 'POST',
            url: '/service-orders',
            body: {},
            auth: { tenantId: 'tenant-1', userId: 'user-1' },
            headers: {},
          }),
          { handle: () => of({ ok: true }) },
        ),
      ),
    ).resolves.toEqual({ ok: true });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
