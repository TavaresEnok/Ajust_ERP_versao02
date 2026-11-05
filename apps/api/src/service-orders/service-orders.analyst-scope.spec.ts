import { ServiceOrderType } from '@prisma/client';
import { ServiceOrdersController } from './service-orders.controller';
import type { RequestWithAuth } from '../common/request-with-auth';

describe('ServiceOrdersController personal scope', () => {
  const list = jest.fn().mockResolvedValue([]);
  const controller = new ServiceOrdersController({ list } as never);
  const req = {
    auth: { tenantId: 'tenant-1', userId: 'authenticated-analyst', role: 'analista' },
    query: { responsibleUserId: 'someone-else', userId: 'someone-else' },
  } as unknown as RequestWithAuth;

  beforeEach(() => list.mockClear());

  it('resolves the personal user ID from the authenticated context, not the URL', async () => {
    await controller.list(req, 'mine');
    expect(list).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        responsibleUserId: 'authenticated-analyst',
      }),
      'analista',
    );
  });

  it('keeps explicit operation scope without impersonating another user', async () => {
    await controller.list(req, 'operation');
    expect(list).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        responsibleUserId: undefined,
      }),
      'analista',
    );
  });

  it('rejects unknown scope values', async () => {
    await expect(controller.list(req, 'another-user')).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
  });
});

describe('Manual occurrence customer identity', () => {
  const create = jest.fn().mockResolvedValue({ id: 'created' });
  const controller = new ServiceOrdersController({
    createOccurrenceWithFirstOrder: create,
  } as never);
  const req = {
    auth: { tenantId: 'tenant-1', userId: 'analyst', role: 'analista' },
  } as RequestWithAuth;
  const body = {
    provider: 'Provedor',
    type: 'Suporte',
    sector: 'NOC',
    origin: 'Telefone',
    openedByName: 'Analista',
    analystResponsible: 'Analista',
    description: 'Ocorrência',
    firstOrder: { type: Object.values(ServiceOrderType)[0], description: 'Atendimento' },
  };
  beforeEach(() => create.mockClear());
  it('rejects a manual opening containing only the provider name', async () => {
    await expect(controller.createOccurrence(body, req)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it('passes the stable customer identity and authenticated tenant to intake', async () => {
    const customerId = '10000000-0000-4000-8000-000000000001';
    await controller.createOccurrence({ ...body, customerId }, req);
    expect(create).toHaveBeenCalledWith(
      'analyst',
      'analista',
      expect.objectContaining({ customerId, tenantId: 'tenant-1' }),
    );
  });
});
