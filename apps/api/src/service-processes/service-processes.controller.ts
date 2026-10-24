import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { ServiceProcessesService } from './service-processes.service';

@Controller('service-processes')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ServiceProcessesController {
  constructor(@Inject(ServiceProcessesService) private readonly service: ServiceProcessesService) {}
  private scope(req: RequestWithAuth) {
    this.service.assertRole(req.auth!.role || '');
    return { tenantId: req.auth!.tenantId!, actorId: req.auth!.userId, role: req.auth!.role || '' };
  }
  @Get('templates')
  templates(@Req() req: RequestWithAuth) {
    return this.service.templates(this.scope(req).tenantId);
  }
  @Get('assignees')
  assignees(@Req() req: RequestWithAuth) {
    return this.service.assignees(this.scope(req).tenantId);
  }
  @Put('templates')
  save(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const s = this.scope(req);
    const v = z
      .object({ definition: z.unknown(), expectedVersion: z.number().int().min(0) })
      .parse(body);
    return this.service.saveTemplate(
      s.tenantId,
      s.actorId,
      s.role,
      v.definition,
      v.expectedVersion,
    );
  }
  @Get()
  list(@Req() req: RequestWithAuth) {
    return this.service.list(this.scope(req).tenantId);
  }
  @Get(':id')
  find(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.find(this.scope(req).tenantId, id);
  }
  @Post()
  start(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const s = this.scope(req);
    const v = z
      .object({
        occurrenceId: z.string().uuid(),
        templateCode: z.string(),
        initialOrderId: z.string().uuid().optional(),
      })
      .parse(body);
    return this.service.start(s.tenantId, s.actorId, s.role, v);
  }
  @Post(':id/actions')
  act(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    const s = this.scope(req);
    const v = z
      .object({
        expectedVersion: z.number().int().positive(),
        action: z.enum(['advance', 'pause', 'resume', 'cancel', 'reopen', 'assign']),
        assigneeUserId: z.string().uuid().optional(),
        outcome: z.string().max(200).optional(),
        reason: z.string().trim().min(3).max(2000),
        evidence: z
          .record(z.string().max(8000))
          .refine((x) => Object.keys(x).length <= 30)
          .optional(),
      })
      .parse(body);
    return this.service.act(s.tenantId, s.actorId, s.role, id, v);
  }
}
