import { resolveCustomerLogin } from './customer-login';
describe('Customer document login', () => {
  const findMany = jest.fn();
  const prisma = { userTenant: { findMany } };
  beforeEach(() => findMany.mockReset());
  it('uses the customer registry with email and active membership restrictions', async () => {
    const membership = { tenantId: 'tenant', customer: { tenantId: 'tenant' } };
    findMany.mockResolvedValue([membership]);
    expect(
      await resolveCustomerLogin(prisma as never, '12.345.678/0001-99', 'CLIENT@EXAMPLE.COM'),
    ).toBe(membership);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customer: { deletedAt: null, taxId: { in: ['12345678000199', '12.345.678/0001-99'] } },
          user: { status: 'ACTIVE', deletedAt: null, email: 'client@example.com' },
          role: { code: 'cliente' },
          tenant: { status: 'ACTIVE', deletedAt: null },
        }),
        take: 2,
      }),
    );
  });
  it('rejects duplicate accounts and inconsistent customer tenancy', async () => {
    findMany.mockResolvedValue([{}, {}]);
    expect(await resolveCustomerLogin(prisma as never, '12345678000199')).toBeNull();
    findMany.mockResolvedValue([{ tenantId: 'one', customer: { tenantId: 'two' } }]);
    expect(await resolveCustomerLogin(prisma as never, '12345678000199')).toBeNull();
  });
});
