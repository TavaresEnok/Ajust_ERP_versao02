import { SessionRetentionService } from './session-retention.service';
describe('Session retention', () => {
  it('removes only old expired/revoked sessions in bounded batches, rechecking their eligibility', async () => {
    const prisma = {
      session: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'old' }])
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    expect(
      await new SessionRetentionService(prisma as never).runOnce(new Date('2026-11-04T12:00:00Z')),
    ).toEqual({ removed: 1 });
    const where = prisma.session.deleteMany.mock.calls[0][0].where;
    expect(where).toEqual({
      id: { in: ['old'] },
      OR: [
        { expiresAt: { lt: new Date('2026-10-05T12:00:00Z') } },
        { revokedAt: { lt: new Date('2026-10-05T12:00:00Z') } },
      ],
    });
    expect(prisma.session.findMany.mock.calls[0][0].take).toBe(500);
  });
});

describe('SessionRetentionService.purgeLifecycleEvents', () => {
  it('apaga só eventos processados antes do corte, em lotes', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = { serviceOrderLifecycleEvent: { findMany, deleteMany } };
    const service = new SessionRetentionService(prisma as never);
    const now = new Date('2026-11-09T00:00:00Z');
    await expect(service.purgeLifecycleEvents(now)).resolves.toEqual({ removed: 2 });
    const cutoff = new Date(now.getTime() - 90 * 86400000);
    expect(findMany.mock.calls[0][0].where).toEqual({ processedAt: { lt: cutoff } });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { processedAt: { lt: cutoff }, id: { in: ['a', 'b'] } },
    });
  });
});
