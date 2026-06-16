import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrometheusService } from '../monitoring/prometheus.service';
import { TenantIsolationGuard } from './tenant-isolation.guard';

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('TenantIsolationGuard', () => {
  const prometheus = {
    recordTenantIsolationViolation: jest.fn(),
  };
  let guard: TenantIsolationGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TenantIsolationGuard(prometheus as unknown as PrometheusService);
  });

  it('requires a tenant anchored in the authenticated token', () => {
    const context = makeContext({ auth: undefined, query: {}, body: {} });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects tenantId supplied through query parameters and records the violation', () => {
    const context = makeContext({
      auth: { userId: 'user-1', sessionId: 'session-1', tenantId: 'tenant-1', role: 'admin' },
      query: { tenantId: 'tenant-2' },
      body: {},
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(prometheus.recordTenantIsolationViolation).toHaveBeenCalledTimes(1);
  });

  it('rejects tenantId in ordinary request bodies', () => {
    const context = makeContext({
      auth: { userId: 'user-1', sessionId: 'session-1', tenantId: 'tenant-1', role: 'admin' },
      query: {},
      body: { tenantId: 'tenant-2' },
      method: 'PATCH',
      path: '/service-orders/order-1',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows the explicitly scoped IAM user creation contract', () => {
    const context = makeContext({
      auth: { userId: 'user-1', sessionId: 'session-1', tenantId: 'tenant-1', role: 'admin' },
      query: {},
      body: { tenantId: 'tenant-2' },
      method: 'POST',
      path: '/iam/users',
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
