import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole } from '../common/role-utils';
import { OrderOperationsService } from './order-operations.service';

const command = z
  .object({
    action: z.enum([
      'start',
      'pause',
      'resume',
      'schedule',
      'unschedule',
      'assign',
      'finish',
      'reopen',
    ]),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().max(20000).default(''),
    assigneeUserId: z.string().uuid().optional(),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    outcome: z.string().max(200).optional(),
    evidence: z
      .record(z.string().min(1).max(300), z.string().trim().min(1).max(20000))
      .refine((value) => Object.keys(value).length <= 20, 'Limite de 20 evidências por etapa.')
      .optional(),
    change: z
      .object({
        impact: z.string().trim().min(3).max(4000),
        rollbackPlan: z.string().trim().min(3).max(4000),
      })
      .optional(),
  })
  .superRefine((input, ctx) => {
    if (input.action !== 'start' && input.reason.length < 3)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Informe uma justificativa ou resultado com pelo menos 3 caracteres.',
      });
  });
@Controller('service-orders')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class OrderOperationsController {
  constructor(@Inject(OrderOperationsService) private readonly service: OrderOperationsService) {}
  private scope(req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return req.auth!;
  }
  @Get('operational-alerts')
  alerts(@Req() req: RequestWithAuth) {
    const s = this.scope(req);
    return this.service.alerts(s.tenantId!);
  }
  @Post(':id/operations')
  run(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    const s = this.scope(req);
    return this.service.run(s.tenantId!, s.userId, s.role || '', id, command.parse(body));
  }
  @Post('occurrences/:id/close')
  close(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    const s = this.scope(req);
    const input = z
      .object({
        reason: z.string().trim().min(3).max(20000),
        orders: z
          .array(z.object({ id: z.string().uuid(), version: z.number().int().positive() }))
          .max(200),
      })
      .parse(body);
    return this.service.closeOccurrence(s.tenantId!, s.userId, s.role || '', id, input);
  }
}
