import { CustomersController } from './customers.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../common/request-with-auth';

describe('Customer registration tenant scope', () => {
  const request = (role = 'gerente') =>
    ({ auth: { tenantId: 'ajust-workspace', userId: 'manager', role } }) as RequestWithAuth;
  it('always anchors listing to the authenticated workspace', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const controller = new CustomersController({
      customer: { findMany },
    } as unknown as PrismaService);
    await controller.list(request());
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'ajust-workspace', deletedAt: null },
      orderBy: { tradeName: 'asc' },
    });
  });
  it('does not expose another workspace through a known customer UUID', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const controller = new CustomersController({
      customer: { findFirst },
    } as unknown as PrismaService);
    await expect(controller.find(request(), 'foreign-id')).rejects.toThrow(
      'Cliente não encontrado',
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'ajust-workspace', deletedAt: null, id: 'foreign-id' },
      }),
    );
    const nested = findFirst.mock.calls[0][0].include.occurrences;
    expect(nested.where).toEqual({
      tenantId: 'ajust-workspace',
      deletedAt: null,
    });
    expect(nested.include.serviceOrders.where).toEqual(
      expect.objectContaining({
        tenantId: 'ajust-workspace',
        deletedAt: null,
      }),
    );
    // Both ERP-native and imported records belong in the provider's attendance view.
    expect(nested.where).not.toHaveProperty('sourceSystem');
    expect(nested.include.serviceOrders.where).not.toHaveProperty('sourceSystem');
    expect(nested.include.serviceOrders.where).not.toHaveProperty('externalProtocol');
  });
  it('does not grant client users access to the consultancy customer directory', () => {
    const controller = new CustomersController({} as PrismaService);
    expect(() => controller.list(request('cliente'))).toThrow();
  });
});
