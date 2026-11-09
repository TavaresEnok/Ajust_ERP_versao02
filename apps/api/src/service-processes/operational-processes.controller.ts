import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { OperationalProcessesService } from './operational-processes.service';
import { validateOperational } from './operational-definition';

@Controller('service-processes/operational')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class OperationalProcessesController {
  constructor(
    @Inject(OperationalProcessesService) private readonly service: OperationalProcessesService,
  ) {}
  private scope(req: RequestWithAuth, manager = false) {
    if (manager) assertManagerRole(req.auth);
    else assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return { tenantId: req.auth!.tenantId!, actorId: req.auth!.userId, role: req.auth!.role! };
  }
  @Get('templates') templates(@Req() req: RequestWithAuth) {
    return this.service.templates(this.scope(req).tenantId);
  }
  @Get('assignees') assignees(@Req() req: RequestWithAuth) {
    return this.service.assignees(this.scope(req).tenantId);
  }
  @Put('templates') save(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const s = this.scope(req, true);
    const input = z
      .object({
        definition: z.unknown(),
        expectedVersion: z.number().int().min(0),
        publish: z.boolean(),
      })
      .parse(body);
    return this.service.save(s.tenantId, s.actorId, { ...input, definition: input.definition });
  }
  @Post('validate') validate(@Req() req: RequestWithAuth, @Body() body: unknown) {
    this.scope(req);
    return validateOperational(body);
  }
  @Get() list(@Req() req: RequestWithAuth) {
    return this.service.list(this.scope(req).tenantId);
  }
  @Post() start(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const s = this.scope(req);
    const input = z.object({ orderId: z.string().uuid(), templateCode: z.string() }).parse(body);
    return this.service.start(s.tenantId, s.actorId, input.orderId, input.templateCode);
  }
  @Get(':id') find(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.find(this.scope(req).tenantId, id);
  }
  @Post(':id/demo') demonstrate(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const s = this.scope(req, true);
    const input = z.object({ expectedVersion: z.number().int().positive() }).parse(body);
    return this.service.demonstrate(s.tenantId, s.actorId, id, input.expectedVersion);
  }
  @Post(':id/activate') activate(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const s = this.scope(req, true);
    const input = z.object({ expectedVersion: z.number().int().positive() }).parse(body);
    return this.service.activateSource(s.tenantId, s.actorId, id, input.expectedVersion);
  }
  @Post(':id/actions') act(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const s = this.scope(req);
    const input = z
      .object({
        expectedVersion: z.number().int().positive(),
        action: z.enum(['advance', 'assign', 'pause', 'resume', 'cancel', 'reopen', 'retry']),
        stepId: z.string().uuid().optional(),
        outcome: z.string().max(200).optional(),
        evidence: z
          .record(z.string(), z.string().max(8000))
          .refine((x) => Object.keys(x).length <= 20)
          .optional(),
        assigneeUserId: z.string().uuid().optional(),
        reason: z.string().trim().min(3).max(2000),
      })
      .strict()
      .parse(body);
    return this.service.act(s.tenantId, s.actorId, s.role, id, input);
  }
  @Post(':id/events/retry')
  retryEvents(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    const s = this.scope(req, true);
    const input = z.object({ reason: z.string().trim().min(3).max(2000) }).parse(body);
    return this.service.retryEvents(s.tenantId, s.actorId, id, input.reason);
  }
}
