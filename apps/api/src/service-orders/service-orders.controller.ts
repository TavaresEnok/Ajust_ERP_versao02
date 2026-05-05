import {
  BadRequestException,
  Body,
  Controller,
  UploadedFiles,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UseInterceptors,
  UseGuards,
  UnauthorizedException
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApprovalStatus,
  OccurrenceStatus,
  Priority,
  ServiceOrderStatus,
  ServiceOrderType
} from '@prisma/client';
import { z } from 'zod';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { ServiceOrdersService } from './service-orders.service';

const CreateOrderSchema = z.object({
  tenantId: z.string().uuid().optional(),
  occurrenceId: z.string().uuid().optional(),
  type: z.nativeEnum(ServiceOrderType),
  priority: z.nativeEnum(Priority),
  title: z.string().min(3),
  description: z.string().min(3),
  requester: z.string().optional(),
  sector: z.string().optional(),
  origin: z.string().optional(),
  ownerUserId: z.string().uuid().optional(),
  ownerName: z.string().min(2).optional(),
  assigneeUserId: z.string().uuid().optional(),
  analystName: z.string().min(2).optional(),
  deadlineAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  internalNotes: z.string().optional()
});

const UpdateOrderSchema = z.object({
  type: z.nativeEnum(ServiceOrderType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  requester: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  analystName: z.string().nullable().optional(),
  deadlineAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  internalNotes: z.string().nullable().optional()
});

const OccurrenceOrderSchema = z.object({
  type: z.nativeEnum(ServiceOrderType),
  status: z.nativeEnum(ServiceOrderStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(3),
  requester: z.string().optional(),
  sector: z.string().optional(),
  origin: z.string().optional(),
  analystName: z.string().min(2).optional(),
  deadlineAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  internalNotes: z.string().optional()
});

const CreateOccurrenceSchema = z.object({
  tenantId: z.string().uuid().optional(),
  provider: z.string().min(2),
  type: z.string().min(2),
  status: z.nativeEnum(OccurrenceStatus).optional(),
  sector: z.string().min(2),
  origin: z.string().min(2),
  openedByName: z.string().min(2),
  analystResponsible: z.string().min(2),
  description: z.string().min(3),
  createdAt: z.string().datetime().optional(),
  firstOrder: OccurrenceOrderSchema
});

const UpdateOccurrenceSchema = z.object({
  type: z.string().min(2).optional(),
  status: z.nativeEnum(OccurrenceStatus).optional(),
  sector: z.string().min(2).optional(),
  origin: z.string().min(2).optional(),
  analystResponsible: z.string().min(2).optional(),
  description: z.string().min(3).optional()
});

const ListOccurrencesSchema = z.object({
  provider: z.string().trim().min(2).optional(),
  search: z.string().trim().min(2).optional(),
  status: z.nativeEnum(OccurrenceStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeOrders: z.coerce.boolean().optional()
});

const CreateAnnotationSchema = z.object({
  message: z.string().trim().min(2).max(4000)
});

const TransitionSchema = z.object({
  toStatus: z.nativeEnum(ServiceOrderStatus),
  reason: z.string().min(3)
});

const ApprovalSchema = z.object({
  decision: z.nativeEnum(ApprovalStatus),
  reason: z.string().optional()
});

const ListSchema = z.object({
  status: z.nativeEnum(ServiceOrderStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(ServiceOrderType).optional(),
  search: z.string().trim().min(2).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'deadlineAt', 'protocol', 'priority', 'status']).optional(),
  orderDir: z.enum(['asc', 'desc']).optional()
});

const ExportHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

@Controller('service-orders')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ServiceOrdersController {
  constructor(@Inject(ServiceOrdersService) private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  async create(@Body() body: unknown, @Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = CreateOrderSchema.parse(body);

    return this.serviceOrdersService.create(req.auth.userId, req.auth.role || '', {
      ...input,
      tenantId: req.auth.tenantId
    });
  }

  @Get()
  async list(
    @Req() req: RequestWithAuth,
    @Query('status') status?: ServiceOrderStatus,
    @Query('priority') priority?: Priority,
    @Query('type') type?: ServiceOrderType,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDir') orderDir?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListSchema.parse({ status, priority, type, search, from, to, limit, offset, orderBy, orderDir });

    if (input.from && input.to && new Date(input.from).getTime() > new Date(input.to).getTime()) {
      throw new BadRequestException('from must be less than or equal to to.');
    }

    return this.serviceOrdersService.list(req.auth.tenantId, input);
  }

  @Get('summary')
  async summary(
    @Req() req: RequestWithAuth,
    @Query('status') status?: ServiceOrderStatus,
    @Query('priority') priority?: Priority,
    @Query('type') type?: ServiceOrderType,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDir') orderDir?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListSchema.parse({ status, priority, type, search, from, to, orderBy, orderDir });

    if (input.from && input.to && new Date(input.from).getTime() > new Date(input.to).getTime()) {
      throw new BadRequestException('from must be less than or equal to to.');
    }

    return this.serviceOrdersService.summary(req.auth.tenantId, input);
  }

  @Get('occurrences')
  async listOccurrences(
    @Req() req: RequestWithAuth,
    @Query('provider') provider?: string,
    @Query('search') search?: string,
    @Query('status') status?: OccurrenceStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeOrders') includeOrders?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListOccurrencesSchema.parse({
      provider,
      search,
      status,
      limit,
      offset,
      includeOrders
    });

    return this.serviceOrdersService.listOccurrences(req.auth.tenantId, input);
  }

  @Get('occurrences/:occurrenceId')
  async getOccurrenceById(
    @Req() req: RequestWithAuth,
    @Param('occurrenceId') occurrenceId: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.serviceOrdersService.getOccurrenceById(req.auth.tenantId, occurrenceId);
  }

  @Post('occurrences')
  async createOccurrence(@Body() body: unknown, @Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = CreateOccurrenceSchema.parse(body);

    return this.serviceOrdersService.createOccurrenceWithFirstOrder(req.auth.userId, req.auth.role || '', {
      ...input,
      tenantId: req.auth.tenantId
    });
  }

  @Patch('occurrences/:occurrenceId')
  async patchOccurrence(
    @Req() req: RequestWithAuth,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = UpdateOccurrenceSchema.parse(body);
    return this.serviceOrdersService.updateOccurrence(req.auth.tenantId, occurrenceId, req.auth.userId, req.auth.role || '', input);
  }

  @Post('occurrences/:occurrenceId/annotations')
  async annotateOccurrence(
    @Req() req: RequestWithAuth,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = CreateAnnotationSchema.parse(body);
    return this.serviceOrdersService.addOccurrenceAnnotation(
      req.auth.tenantId,
      occurrenceId,
      req.auth.userId,
      req.auth.role || '',
      input.message
    );
  }

  @Post('occurrences/:occurrenceId/orders')
  async createOrderInOccurrence(
    @Req() req: RequestWithAuth,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = OccurrenceOrderSchema.parse(body);
    return this.serviceOrdersService.createOrderInOccurrence(
      req.auth.tenantId,
      occurrenceId,
      req.auth.userId,
      req.auth.role || '',
      input
    );
  }

  @Get('export/csv')
  async exportCsv(
    @Req() req: RequestWithAuth,
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: ServiceOrderStatus,
    @Query('priority') priority?: Priority,
    @Query('type') type?: ServiceOrderType,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDir') orderDir?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ListSchema.parse({ status, priority, type, search, from, to, orderBy, orderDir });
    if (input.from && input.to && new Date(input.from).getTime() > new Date(input.to).getTime()) {
      throw new BadRequestException('from must be less than or equal to to.');
    }

    const csv = await this.serviceOrdersService.exportCsv(req.auth.tenantId, req.auth.userId, input);

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${csv.fileName}"`);
    res.setHeader('x-export-rows', String(csv.rowCount));
    res.setHeader('x-export-truncated', csv.truncated ? 'true' : 'false');

    return csv.content;
  }

  @Get('export/history')
  async exportHistory(
    @Req() req: RequestWithAuth,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ExportHistorySchema.parse({ limit, offset });
    return this.serviceOrdersService.listExportHistory(
      req.auth.tenantId,
      req.auth.role || '',
      input.limit || 20,
      input.offset || 0
    );
  }

  @Get('export/:exportId/download')
  async downloadExport(
    @Req() req: RequestWithAuth,
    @Res({ passthrough: true }) res: Response,
    @Param('exportId') exportId: string
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const result = await this.serviceOrdersService.downloadExportCsv(
      req.auth.tenantId,
      exportId,
      req.auth.userId,
      req.auth.role || ''
    );

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);

    return result.content;
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.serviceOrdersService.getById(req.auth.tenantId, id);
  }

  @Patch(':id')
  async patchOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = UpdateOrderSchema.parse(body);
    return this.serviceOrdersService.updateOrder(req.auth.tenantId, id, req.auth.userId, req.auth.role || '', input);
  }

  @Post(':id/annotations')
  async annotateOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = CreateAnnotationSchema.parse(body);
    return this.serviceOrdersService.addOrderAnnotation(
      req.auth.tenantId,
      id,
      req.auth.userId,
      req.auth.role || '',
      input.message
    );
  }

  @Patch(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = TransitionSchema.parse(body);

    return this.serviceOrdersService.transition(req.auth.tenantId, id, req.auth.userId, req.auth.role || '', input);
  }

  @Post(':id/approvals')
  async approve(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithAuth
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    const input = ApprovalSchema.parse(body);

    return this.serviceOrdersService.approve(
      req.auth.tenantId,
      id,
      req.auth.userId,
      req.auth.role || '',
      input.decision,
      input.reason
    );
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req: RequestWithAuth
  ) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');

    return this.serviceOrdersService.uploadAttachments(
      req.auth.tenantId,
      id,
      req.auth.userId,
      req.auth.role || '',
      files || []
    );
  }
}
