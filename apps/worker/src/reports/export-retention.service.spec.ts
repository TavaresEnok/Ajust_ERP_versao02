import { unlink } from 'node:fs/promises';
import { ExportRetentionService } from './export-retention.service';
import { validatePathWithinBase } from '../path-security';

jest.mock('node:fs/promises', () => ({ unlink: jest.fn() }));
jest.mock('../path-security', () => ({
  validatePathWithinBase: jest.fn((_base: string, target: string) => `/safe/${target}`),
}));

function makePrisma(): any {
  return {
    reportExport: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('ExportRetentionService', () => {
  afterEach(() => {
    delete process.env.EXPORT_RETENTION_DAYS;
    delete process.env.UPLOAD_ROOT;
  });

  it('reports configured retention status with fallback for invalid value', () => {
    process.env.EXPORT_RETENTION_DAYS = '-1';
    expect(new ExportRetentionService(makePrisma()).getStatus()).toEqual(
      expect.objectContaining({ running: false, retentionDays: 30 }),
    );
    process.env.EXPORT_RETENTION_DAYS = '14.9';
    expect(new ExportRetentionService(makePrisma()).getStatus().retentionDays).toBe(14);
  });

  it('expires old exports, removes file and audits cleanup', async () => {
    process.env.EXPORT_RETENTION_DAYS = '7';
    process.env.UPLOAD_ROOT = '/uploads';
    const prisma = makePrisma();
    prisma.reportExport.findMany.mockResolvedValue([
      { id: 'export-1', tenantId: 'tenant-1', fileUrl: 'tenant/report.csv' },
    ]);
    (unlink as jest.Mock).mockResolvedValue(undefined);
    const service = new ExportRetentionService(prisma);

    await service.runOnce();

    expect(validatePathWithinBase).toHaveBeenCalledWith('/uploads', 'tenant/report.csv');
    expect(unlink).toHaveBeenCalledWith('/safe/tenant/report.csv');
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: { fileUrl: null, status: 'EXPIRED' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(service.getStatus()).toEqual(
      expect.objectContaining({ running: false, lastProcessed: 1, lastErrors: 0 }),
    );
  });

  it('ignores missing files but records other per-item errors', async () => {
    const prisma = makePrisma();
    prisma.reportExport.findMany.mockResolvedValue([
      { id: 'missing', tenantId: 'tenant-1', fileUrl: 'missing.csv' },
      { id: 'denied', tenantId: 'tenant-1', fileUrl: 'denied.csv' },
    ]);
    (unlink as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const service = new ExportRetentionService(prisma);

    await service.runOnce();

    expect(service.getStatus()).toEqual(
      expect.objectContaining({ lastProcessed: 1, lastErrors: 1, lastErrorMessage: 'denied' }),
    );
  });

  it('captures a global database failure and always releases running lock', async () => {
    const prisma = makePrisma();
    prisma.reportExport.findMany.mockRejectedValue(new Error('db unavailable'));
    const service = new ExportRetentionService(prisma);

    await service.runOnce();

    expect(service.getStatus()).toEqual(
      expect.objectContaining({ running: false, lastErrorMessage: 'db unavailable' }),
    );
  });
});
