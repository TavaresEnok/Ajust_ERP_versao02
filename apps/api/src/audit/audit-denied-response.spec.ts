import { auditDeniedResponse } from './audit-denied-response';
describe('Denied request audit', () => {
  it.each([401, 403, 409, 429])(
    'records HTTP %s without body, query or forwarded IP',
    async (status) => {
      const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
      await auditDeniedResponse(
        prisma as never,
        {
          method: 'POST',
          url: '/knowledge/credentials/id/reveal?secret=private',
          ip: '192.0.2.1',
          headers: { 'x-forwarded-for': 'forged' },
          body: { currentPassword: 'private' },
          auth: { tenantId: 'tenant', userId: 'user' },
        } as never,
        status,
      );
      const data = prisma.auditLog.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        action: 'ACCESS_DENIED',
        ip: '192.0.2.1',
        metadata: { statusCode: status },
      });
      expect(JSON.stringify(data)).not.toMatch(/private|forged/);
    },
  );
  it('ignores successful responses', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    await auditDeniedResponse(prisma as never, {} as never, 200);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
