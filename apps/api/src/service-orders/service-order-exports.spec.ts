import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { exportServiceOrdersCsv } from './service-order-exports';
import type { PrismaService } from '../prisma/prisma.service';

describe('service-order-exports', () => {
  const makeRow = (id: string, protocol: string) => ({
    id,
    protocol,
    externalProtocol: null,
    title: `Ordem ${protocol}`,
    description: 'Teste',
    type: 'ROMPIMENTO',
    priority: 'NORMAL',
    status: 'ABERTA',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T10:00:00Z'),
    deadlineAt: new Date('2026-11-02T10:00:00Z'),
    resolvedAt: null,
    closedAt: null,
    owner: { name: 'Ana' },
    assignee: { name: 'Bruno' },
  });

  it('pagina por cursor com select enxuto e marca truncamento ao exceder o limite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ajust-csv-test-'));
    const previousRoot = process.env.UPLOAD_ROOT;
    process.env.UPLOAD_ROOT = dir;
    try {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([makeRow('id-1', 'OS-1'), makeRow('id-2', 'OS-2')])
        .mockResolvedValueOnce([makeRow('id-3', 'OS-3'), makeRow('id-4', 'OS-4')]);
      const create = jest.fn().mockResolvedValue({ id: '12345678-aaaa-bbbb-cccc-1234567890ab' });
      const update = jest.fn().mockResolvedValue({});
      const logAudit = jest.fn().mockResolvedValue(undefined);

      const prisma = {
        serviceOrder: { findMany },
        reportExport: { create, update },
      } as unknown as PrismaService;

      const result = await exportServiceOrdersCsv({
        prisma,
        tenantId: 'tenant-1',
        authUserId: 'user-1',
        role: 'gerente',
        input: {},
        where: { tenantId: 'tenant-1', deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        logAudit,
        maxRows: 3,
        batchSize: 2,
      });

      expect(result.rowCount).toBe(3);
      expect(result.truncated).toBe(true);
      expect(result.content.split('\n')).toHaveLength(4);
      expect(findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          take: 2,
          select: expect.objectContaining({ id: true, protocol: true }),
        }),
      );
      expect(findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          cursor: { id: 'id-2' },
          skip: 1,
          take: 2,
        }),
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED_TRUNCATED' }),
        }),
      );
    } finally {
      process.env.UPLOAD_ROOT = previousRoot;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('recusa exportação para papel cliente', async () => {
    await expect(
      exportServiceOrdersCsv({
        prisma: {} as PrismaService,
        tenantId: 't1',
        authUserId: 'u1',
        role: 'cliente',
        input: {},
        where: {},
        orderBy: [],
        logAudit: jest.fn(),
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
