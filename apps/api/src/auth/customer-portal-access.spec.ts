import { customerPortalRequestAllowed as allowed } from './customer-portal-access';
describe('customer portal API boundary', () => {
  it('allows only scoped reads, personal notes and own account operations', () => {
    expect(allowed('GET', '/customer-portal', 't1')).toBe(true);
    expect(allowed('GET', '/customer-portal/orders/abc-123', 't1')).toBe(true);
    expect(allowed('GET', '/customer-portal/agenda/', 't1')).toBe(true);
    expect(allowed('POST', '/knowledge/notes', 't1')).toBe(true);
    expect(allowed('PATCH', '/auth/me', 't1')).toBe(true);
    expect(allowed('GET', '/iam/tenants/t1/logo', 't1')).toBe(true);
  });
  it.each([
    '/service-orders',
    '/customers',
    '/calendar/events/all',
    '/reports/operational-health',
    '/reports/service-types',
    '/knowledge/credentials',
    '/iam/users',
    '/auth/socket-token',
    '/auth/sessions/user/abc-123',
    '/iam/tenants/t2/logo',
  ])('blocks tenant-wide endpoint %s even if legacy controller allows cliente', (path) => {
    expect(allowed('GET', path, 't1')).toBe(false);
  });
  it('blocks mutations to attendance and unknown endpoints', () => {
    expect(allowed('POST', '/customer-portal', 't1')).toBe(false);
    expect(allowed('PATCH', '/customer-portal/orders/abc-123', 't1')).toBe(false);
    expect(allowed('GET', '/customer-portal/anything', 't1')).toBe(false);
  });
});
