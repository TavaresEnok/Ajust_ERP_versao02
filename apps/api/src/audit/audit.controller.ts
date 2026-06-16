import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, UseGuards, Req, Res, Inject } from '@nestjs/common';
import { z } from 'zod';
import { Response } from 'express';
import { AuditAction } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertManagerRole } from '../common/role-utils';

const LogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  resourceType: z.string().min(1).max(80).optional(),
  resourceId: z.string().min(1).max(120).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const MetricsQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

const ExportQuerySchema = MetricsQuerySchema.extend({
  format: z.enum(['json', 'csv']).default('json'),
});

@ApiTags('Auditoria')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('audit')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get('logs')
  async getLogs(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    const parsed = LogsQuerySchema.parse(req.query);
    return this.auditService.getLogs({
      tenantId: req.auth!.tenantId,
      userId: parsed.userId,
      action: parsed.action,
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      limit: parsed.limit,
      offset: parsed.offset,
    });
  }

  @Get('metrics')
  async getMetrics(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    const parsed = MetricsQuerySchema.parse(req.query);
    return this.auditService.getMetrics(
      req.auth!.tenantId,
      parsed.startDate ? new Date(parsed.startDate) : undefined,
      parsed.endDate ? new Date(parsed.endDate) : undefined,
    );
  }

  @Get('export')
  async export(@Req() req: RequestWithAuth, @Res() res: Response) {
    assertManagerRole(req.auth);
    const parsed = ExportQuerySchema.parse(req.query);
    const data = await this.auditService.export(
      req.auth!.tenantId,
      parsed.format,
      parsed.startDate ? new Date(parsed.startDate) : undefined,
      parsed.endDate ? new Date(parsed.endDate) : undefined,
    );

    if (parsed.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-${new Date().toISOString()}.csv"`,
      );
      res.send(data);
    } else {
      res.json(data);
    }
  }
}
