import { Injectable, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

interface AuditFilter {
  tenantId: string | null;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private buildWhere(
    tenantId: string,
    opts: {
      userId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (opts.userId) where.actorUserId = opts.userId;
    if (opts.action) where.action = opts.action as AuditAction;
    if (opts.resourceType) where.resourceType = opts.resourceType;
    if (opts.resourceId) where.resourceId = opts.resourceId;

    if (opts.startDate || opts.endDate) {
      where.createdAt = {};
      if (opts.startDate) where.createdAt.gte = opts.startDate;
      if (opts.endDate) where.createdAt.lte = opts.endDate;
    }

    return where;
  }

  async getLogs(filters: AuditFilter) {
    const {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    if (!tenantId) throw new Error('TenantId is required');

    const where = this.buildWhere(tenantId, {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
    });

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actorUser: { select: { id: true, email: true } },
          tenant: { select: { id: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getMetrics(tenantId: string | null, startDate?: Date, endDate?: Date) {
    if (!tenantId) throw new Error('TenantId is required');

    const where = this.buildWhere(tenantId, { startDate, endDate });

    const [totalLogsCount, actionBreakdown, topUsers, topResources] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorUserId'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalLogsCount,
      actionBreakdown: actionBreakdown.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
      topUsers: topUsers.map((u) => ({
        userId: u.actorUserId,
        count: u._count.id,
      })),
      topResources: topResources.map((r) => ({
        resourceType: r.resourceType,
        count: r._count.id,
      })),
    };
  }

  async export(
    tenantId: string | null,
    format: 'json' | 'csv' = 'json',
    startDate?: Date,
    endDate?: Date,
  ) {
    if (!tenantId) throw new Error('TenantId is required');

    const where = this.buildWhere(tenantId, { startDate, endDate });

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: { select: { email: true } },
      },
    });

    if (format === 'csv') {
      return this.convertToCSV(logs);
    }

    return logs;
  }

  private convertToCSV(
    logs: Array<{
      createdAt: Date;
      action: string;
      actorUser?: { email: string } | null;
      resourceType: string;
      resourceId?: string | null;
      ip?: string | null;
      userAgent?: string | null;
    }>,
  ): string {
    if (logs.length === 0) return '';

    const headers = [
      'Timestamp',
      'Action',
      'Actor Email',
      'Resource Type',
      'Resource ID',
      'IP',
      'User Agent',
    ];
    const rows = logs.map((log) => [
      log.createdAt,
      log.action,
      log.actorUser?.email || 'unknown',
      log.resourceType,
      log.resourceId || '-',
      log.ip,
      log.userAgent,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}
