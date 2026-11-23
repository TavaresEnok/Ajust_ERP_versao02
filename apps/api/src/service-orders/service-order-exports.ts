import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
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

async function writeChunk(stream: ReturnType<typeof createWriteStream>, chunk: string) {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

export async function exportServiceOrdersCsv(params: {
  prisma: PrismaService;
  tenantId: string;
  authUserId: string;
  role: string;
  input: ListInput;
  where: Prisma.ServiceOrderWhereInput;
  orderBy: Prisma.ServiceOrderOrderByWithRelationInput[];
  logAudit: LogAuditFn;
  /** Sem limite por padrão (streaming em disco via cursor). Informe apenas se desejar limitar. */
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
    maxRows,
    batchSize = EXPORT_BATCH_SIZE,
  } = params;

  if (!ALLOWED_EXPORT_ROLES.includes(role)) {
    throw new ForbiddenException('Role is not allowed to export service orders.');
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

  const fileName = `service-orders-${new Date().toISOString().slice(0, 10)}-${reportExport.id.slice(0, 8)}.csv`;
  const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
  const exportDir = join(uploadRoot, 'reports', tenantId);
  let filePath = '';
  let exportedCount = 0;
  let truncated = false;

  try {
    await mkdir(exportDir, { recursive: true });
    filePath = join(exportDir, fileName);
    const stream = createWriteStream(filePath, { encoding: 'utf8' });

    try {
      await writeChunk(stream, CSV_HEADER.join(','));
      let cursorId: string | undefined;

      while (maxRows === undefined || exportedCount < maxRows) {
        const remaining = maxRows === undefined ? batchSize : maxRows - exportedCount;
        const probeExtra = maxRows !== undefined && remaining <= batchSize ? 1 : 0;
        const take = Math.min(batchSize, remaining) + probeExtra;

        const batch = await prisma.serviceOrder.findMany({
          where,
          orderBy,
          select: EXPORT_SELECT,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        });

        if (batch.length === 0) break;

        const sliceLimit = maxRows === undefined ? batch.length : Math.min(batch.length, remaining);
        if (maxRows !== undefined && batch.length > remaining) truncated = true;

        const lines: string[] = [];
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
          lines.push(line.map((value) => csvCell(value)).join(','));
        }

        if (lines.length > 0) {
          await writeChunk(stream, '\n' + lines.join('\n'));
        }

        exportedCount += sliceLimit;
        cursorId = batch[sliceLimit - 1]?.id;

        if (truncated || batch.length < take) break;
      }

      stream.end();
      await once(stream, 'finish');
    } catch (streamError) {
      stream.destroy();
      throw streamError;
    }

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
    filePath,
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
  const fileName = basename(safePath);

  await logAudit(tenantId, authUserId, 'EXPORT', 'report_export', report.id, {
    reportType: 'service_orders_csv',
    operation: 'download',
  });

  // Mantém `content` disponível para chamadores internos, mas o controller faz streaming por `filePath`.
  const content = await readFile(safePath, 'utf-8');
  return { fileName, filePath: safePath, content };
}
