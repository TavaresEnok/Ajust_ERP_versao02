import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, Inject
} from '@nestjs/common';
import { z } from 'zod';
import { WorkflowsService } from './workflows.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'condition', 'action']),
  subtype: z.string().min(1),
  config: z.record(z.any()),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
});

const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
});

const GovernanceSchema = z.object({
  ownerTeam: z.string().min(1).max(120).optional(),
  requiresApproval: z.boolean().optional(),
  changeTicketRequired: z.boolean().optional(),
  maxExecutionsPerHour: z.number().int().min(0).max(100000).optional(),
  stopOnFailure: z.boolean().optional(),
}).optional();

const DefinitionSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  governance: GovernanceSchema,
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  definition: DefinitionSchema,
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  definition: DefinitionSchema.optional(),
});

const RollbackSchema = z.object({
  version: z.number().int().positive(),
});

@Controller('workflows')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly svc: WorkflowsService) {}

  private tid(req: RequestWithAuth): string {
    return req.auth!.tenantId!;
  }

  @Get()
  list(@Req() req: RequestWithAuth) {
    return this.svc.list(this.tid(req));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithAuth) {
    return this.svc.findOne(this.tid(req), id);
  }

  @Post()
  create(@Body() body: any, @Req() req: RequestWithAuth) {
    const input = CreateWorkflowSchema.parse(body);
    return this.svc.create(this.tid(req), req.auth!.userId, input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithAuth) {
    const input = UpdateWorkflowSchema.parse(body);
    return this.svc.update(this.tid(req), req.auth!.userId, id, input);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Req() req: RequestWithAuth) {
    return this.svc.toggle(this.tid(req), req.auth!.userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithAuth) {
    return this.svc.remove(this.tid(req), req.auth!.userId, id);
  }

  @Post(':id/rollback')
  rollback(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithAuth) {
    const input = RollbackSchema.parse(body);
    return this.svc.rollbackToVersion(this.tid(req), req.auth!.userId, id, input.version);
  }
}
