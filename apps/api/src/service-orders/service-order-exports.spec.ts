import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

  it('exporta múltiplos lotes em streaming por cursor sem limite artificial por padrão', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ajust-csv-unlimited-'));
    const previousRoot = process.env.UPLOAD_ROOT;
    process.env.UPLOAD_ROOT = dir;
    try {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([makeRow('id-1', 'OS-1'), makeRow('id-2', 'OS-2')])
        .mockResolvedValueOnce([makeRow('id-3', 'OS-3'), makeRow('id-4', 'OS-4')])
        .mockResolvedValueOnce([makeRow('id-5', 'OS-5')]);
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
        batchSize: 2,
      });

      expect(result.rowCount).toBe(5);
      expect(result.truncated).toBe(false);
      const written = await readFile(result.filePath, 'utf-8');
      expect(written.split('\n')).toHaveLength(6);
      expect(findMany).toHaveBeenCalledTimes(3);
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
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    } finally {
      process.env.UPLOAD_ROOT = previousRoot;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('suporta limite opcional maxRows e marca truncamento apenas quando informado', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ajust-csv-capped-'));
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
      const written = await readFile(result.filePath, 'utf-8');
      expect(written.split('\n')).toHaveLength(4);
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
