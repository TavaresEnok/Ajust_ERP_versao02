import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { validatePathWithinBase } from '../common/path-security';
import { PrismaService } from '../prisma/prisma.service';
import { compactRecord, csvCell } from './service-orders.helpers';
import type {
  CsvExportResult,
  ExportDownloadResult,
  ExportHistoryItem,
  ListInput,
} from './service-orders.types';

export const EXPORT_MAX_ROWS = 10000;
export const EXPORT_BATCH_SIZE = 1000;

const ALLOWED_EXPORT_ROLES = ['super_admin', 'gerente', 'analista'];

const CSV_HEADER = [
  'protocol',
  'externalProtocol',
  'title',
  'description',
  'type',
  'priority',
  'status',
  'createdAt',
  'updatedAt',
  'deadlineAt',
  'resolvedAt',
  'closedAt',
  'ownerName',
  'assigneeName',
];

const EXPORT_SELECT = {
  id: true,
  protocol: true,
  externalProtocol: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deadlineAt: true,
  resolvedAt: true,
  closedAt: true,
  owner: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.ServiceOrderSelect;

type LogAuditFn = (
  tenantId: string,
  actorUserId: string | null,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) => Promise<void>;

export async function exportServiceOrdersCsv(params: {
  prisma: PrismaService;
  tenantId: string;
  authUserId: string;
  role: string;
  input: ListInput;
  where: Prisma.ServiceOrderWhereInput;
  orderBy: Prisma.ServiceOrderOrderByWithRelationInput[];
  logAudit: LogAuditFn;
  maxRows?: number;
  batchSize?: number;
}): Promise<CsvExportResult> {
  const {
    prisma,
    tenantId,
    authUserId,
    role,
    input,
    where,
    orderBy,
    logAudit,
    maxRows = EXPORT_MAX_ROWS,
    batchSize = EXPORT_BATCH_SIZE,
  } = params;

  if (!ALLOWED_EXPORT_ROLES.includes(role)) {
    throw new ForbiddenException('Role is not allowed to export service orders.');
  }

  const csvLines = [CSV_HEADER.join(',')];
  let exportedCount = 0;
  let truncated = false;
  let cursorId: string | undefined;

  while (exportedCount < maxRows) {
    const remaining = maxRows - exportedCount;
    const take = Math.min(batchSize, remaining) + (remaining <= batchSize ? 1 : 0);
    const batch = await prisma.serviceOrder.findMany({
      where,
      orderBy,
      select: EXPORT_SELECT,
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (batch.length === 0) break;

    const sliceLimit = Math.min(batch.length, remaining);
    if (batch.length > remaining) truncated = true;

    for (let i = 0; i < sliceLimit; i++) {
      const row = batch[i];
      const line = [
        row.protocol,
        row.externalProtocol,
        row.title,
        row.description,
        row.type,
        row.priority,
        row.status,
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
        row.deadlineAt.toISOString(),
        row.resolvedAt?.toISOString() || '',
        row.closedAt?.toISOString() || '',
        row.owner?.name || '',
        row.assignee?.name || '',
      ];
      csvLines.push(line.map((value) => csvCell(value)).join(','));
    }

    exportedCount += sliceLimit;
    cursorId = batch[sliceLimit - 1]?.id;

    if (truncated || batch.length < take) break;
  }

  const filters = compactRecord(input);
  const reportExport = await prisma.reportExport.create({
    data: {
      tenantId,
      actorUserId: authUserId,
      reportType: 'service_orders_csv',
      filters: filters as Prisma.InputJsonValue,
      status: 'PROCESSING',
    },
  });

  const content = csvLines.join('\n');
  const fileName = `service-orders-${new Date().toISOString().slice(0, 10)}-${reportExport.id.slice(0, 8)}.csv`;
  const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
  const exportDir = join(uploadRoot, 'reports', tenantId);
  let filePath = '';
  try {
    await mkdir(exportDir, { recursive: true });
    filePath = join(exportDir, fileName);
    await writeFile(filePath, content, 'utf-8');

    await prisma.reportExport.update({
      where: { id: reportExport.id },
      data: {
        fileUrl: filePath,
        status: truncated ? 'COMPLETED_TRUNCATED' : 'COMPLETED',
      },
    });
  } catch {
    await prisma.reportExport.update({
      where: { id: reportExport.id },
      data: {
        status: 'FAILED',
      },
    });
    throw new BadRequestException('Failed to persist CSV export.');
  }

  await logAudit(tenantId, authUserId, 'EXPORT', 'report_export', reportExport.id, {
    reportType: 'service_orders_csv',
    filters,
    rowCount: exportedCount,
    truncated,
    operation: 'create',
  });

  return {
    fileName,
    content,
    rowCount: exportedCount,
    truncated,
  };
}

export async function listServiceOrderExportHistory(
  prisma: PrismaService,
  tenantId: string,
  role: string,
  limit = 20,
  offset = 0,
): Promise<ExportHistoryItem[]> {
  if (!ALLOWED_EXPORT_ROLES.includes(role)) {
    throw new ForbiddenException('Role is not allowed to read export history.');
  }

  const rows = await prisma.reportExport.findMany({
    where: {
      tenantId,
      reportType: 'service_orders_csv',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    reportType: row.reportType,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    fileAvailable: Boolean(row.fileUrl),
    actor: row.actorUser
      ? {
          id: row.actorUser.id,
          name: row.actorUser.name,
          email: row.actorUser.email,
        }
      : null,
  }));
}

export async function downloadServiceOrderExportCsv(params: {
  prisma: PrismaService;
  tenantId: string;
  exportId: string;
  authUserId: string;
  role: string;
  logAudit: LogAuditFn;
}): Promise<ExportDownloadResult> {
  const { prisma, tenantId, exportId, authUserId, role, logAudit } = params;
  if (!ALLOWED_EXPORT_ROLES.includes(role)) {
    throw new ForbiddenException('Role is not allowed to download exports.');
  }

  const report = await prisma.reportExport.findFirst({
    where: {
      id: exportId,
      tenantId,
      reportType: 'service_orders_csv',
    },
    select: {
      id: true,
      fileUrl: true,
    },
  });

  if (!report || !report.fileUrl) {
    throw new NotFoundException('Export file not found.');
  }

  const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
  const safePath = validatePathWithinBase(uploadRoot, report.fileUrl);

  const content = await readFile(safePath, 'utf-8');
  const fileName = basename(safePath);

  await logAudit(tenantId, authUserId, 'EXPORT', 'report_export', report.id, {
    reportType: 'service_orders_csv',
    operation: 'download',
  });

  return { fileName, content };
}
