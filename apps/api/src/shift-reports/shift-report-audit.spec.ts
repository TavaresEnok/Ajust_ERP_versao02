import { firstValueFrom, of } from 'rxjs';
import { AuditInterceptor } from '../audit/audit.interceptor';
describe('Private shift report audit', () => {
  it('does not duplicate draft bodies into general audit logs', async () => {
    const create = jest.fn();
    const interceptor = new AuditInterceptor({ auditLog: { create } } as never);
    const request = {
      method: 'POST',
      url: '/shift-reports',
      body: { content: 'PRIVATE DRAFT' },
      auth: { tenantId: 'ajust', userId: 'author' },
      headers: {},
    };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    const result = await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of({ id: 'report' }) }),
    );
    expect(result).toEqual({ id: 'report' });
    expect(create).not.toHaveBeenCalled();
  });
});
