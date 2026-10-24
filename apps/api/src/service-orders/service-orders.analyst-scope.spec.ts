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
