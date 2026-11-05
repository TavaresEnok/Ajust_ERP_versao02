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
