import { AuditService } from './audit.service';

const createdAt = new Date('2026-06-05T12:00:00.000Z');

function makePrisma(): any {
  return {
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn(),
    },
  };
}

describe('AuditService', () => {
  let prisma: any;
  let service: AuditService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuditService(prisma);
  });

  it('requires tenant scope for logs, metrics and exports', async () => {
    await expect(service.getLogs({ tenantId: null })).rejects.toThrow('TenantId is required');
    await expect(service.getMetrics(null)).rejects.toThrow('TenantId is required');
    await expect(service.export(null)).rejects.toThrow('TenantId is required');
  });

  it('filters and paginates logs with hasMore', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
    prisma.auditLog.count.mockResolvedValue(12);
    const startDate = new Date('2026-06-01T00:00:00.000Z');
    const endDate = new Date('2026-06-05T23:59:59.000Z');

    const result = await service.getLogs({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'LOGIN',
      resourceType: 'auth',
      resourceId: 'login-1',
      startDate,
      endDate,
      limit: 5,
      offset: 5,
    });

    expect(result).toEqual(
      expect.objectContaining({ total: 12, limit: 5, offset: 5, hasMore: true }),
    );
    expect(prisma.auditLog.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          action: 'LOGIN',
          resourceType: 'auth',
          resourceId: 'login-1',
          createdAt: { gte: startDate, lte: endDate },
        },
        take: 5,
        skip: 5,
      }),
    );
  });

  it('maps metrics breakdowns', async () => {
    prisma.auditLog.count.mockResolvedValue(7);
    prisma.auditLog.groupBy
      .mockResolvedValueOnce([{ action: 'LOGIN', _count: { id: 3 } }])
      .mockResolvedValueOnce([{ actorUserId: 'user-1', _count: { id: 4 } }])
      .mockResolvedValueOnce([{ resourceType: 'auth', _count: { id: 5 } }]);

    const result = await service.getMetrics('tenant-1');

    expect(result).toEqual({
      totalLogsCount: 7,
      actionBreakdown: [{ action: 'LOGIN', count: 3 }],
      topUsers: [{ userId: 'user-1', count: 4 }],
      topResources: [{ resourceType: 'auth', count: 5 }],
    });
  });

  it('exports JSON and escapes CSV values', async () => {
    const log = {
      createdAt,
      action: 'LOGIN',
      actorUser: { email: 'user@example.com' },
      resourceType: 'auth',
      resourceId: null,
      ip: '127.0.0.1',
      userAgent: 'Browser "Quoted"',
    };
    prisma.auditLog.findMany.mockResolvedValue([log]);

    await expect(service.export('tenant-1', 'json')).resolves.toEqual([log]);
    const csv = await service.export('tenant-1', 'csv');

    expect(csv).toContain('Timestamp,Action,Actor Email');
    expect(csv).toContain('"Browser ""Quoted"""');
    expect(csv).toContain('"resourceType"'.replace('resourceType', 'auth'));
  });

  it('returns empty CSV for no logs', async () => {
    await expect(service.export('tenant-1', 'csv')).resolves.toBe('');
  });
});
