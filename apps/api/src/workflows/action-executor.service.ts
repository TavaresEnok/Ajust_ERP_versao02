import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assertSafeUrl } from '../common/ssrf-guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CsatService } from '../csat/csat.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import type { WorkflowNode, WorkflowContext } from './workflows.service';
import { Priority, ServiceOrderStatus, ServiceOrderType } from '@prisma/client';

export interface ActionResult {
  nodeId: string;
  subtype: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
  createdOrderId?: string;
  createdOrderProtocol?: string;
}

@Injectable()
export class WorkflowActionExecutor {
  private readonly logger = new Logger(WorkflowActionExecutor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(CsatService) private readonly csat: CsatService,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
  ) {}

  async executeNode(node: WorkflowNode, ctx: WorkflowContext): Promise<ActionResult> {
    const base = { nodeId: node.id, subtype: node.subtype, status: 'SUCCESS' as const };

    try {
      switch (node.subtype) {
        case 'action_notify_slack':
          return await this.execNotifySlack(node, ctx, base);
        case 'action_assign':
          return await this.execAssign(node, ctx, base);
        case 'action_escalate':
          return await this.execEscalate(node, ctx, base);
        case 'action_webhook':
          return await this.execWebhook(node, ctx, base);
        case 'action_csat':
          return await this.execCsat(node, ctx, base);
        case 'task_service':
          return await this.execTaskService(node, ctx, base);
        case 'action_close_order':
          return await this.execCloseOrder(ctx, base);
        default:
          return { ...base, status: 'SKIPPED', error: `Unknown action subtype: ${node.subtype}` };
      }
    } catch (err) {
      return { ...base, status: 'FAILED', error: (err as Error).message };
    }
  }

  private async execNotifySlack(
    node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    const webhookUrl = node.config?.webhookUrl as string;
    const message = node.config?.message as string;
    if (!webhookUrl) return { ...base, status: 'SKIPPED', error: 'Missing webhookUrl' };

    const body = JSON.stringify({
      text: this.interpolate(message, ctx),
      attachments: [
        {
          title: `O.S. ${ctx.order?.protocol || 'N/A'}`,
          fields: [
            { title: 'Evento', value: ctx.event.type, short: true },
            { title: 'Prioridade', value: ctx.order?.priority || '-', short: true },
            { title: 'Status', value: ctx.order?.status || '-', short: true },
          ],
        },
      ],
    });

    await this.postWebhook(webhookUrl, body);
    return base;
  }

  private async execAssign(
    node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    const analystId = node.config?.analystId as string;
    if (!analystId) return { ...base, status: 'SKIPPED', error: 'Missing analystId' };
    if (!ctx.order?.id) return { ...base, status: 'SKIPPED', error: 'Missing order id' };

    const [order, membership] = await Promise.all([
      this.prisma.serviceOrder.findFirst({
        where: { id: ctx.order.id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: analystId, tenantId: ctx.tenantId } },
        select: { userId: true },
      }),
    ]);
    if (!order) throw new Error('Order not found in workflow tenant');
    if (!membership) throw new Error('Assignee is not a member of workflow tenant');

    await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: { assigneeUserId: analystId },
    });
    return base;
  }

  private async execEscalate(
    node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    const to = node.config?.to as string;
    if (!ctx.order?.id) return { ...base, status: 'SKIPPED', error: 'Missing order id' };

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: ctx.order.id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new Error('Order not found in workflow tenant');

    await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: { priority: 'CRITICA' },
    });

    if (to) {
      await this.notifications.dispatch(ctx.tenantId, 'ORDER_ESCALATED', {
        protocol: ctx.order?.protocol || '-',
        escalatedTo: to,
      });
    }
    return base;
  }

  private async execWebhook(
    node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    const url = node.config?.url as string;
    const method = (node.config?.method as string) || 'POST';
    if (!url) return { ...base, status: 'SKIPPED', error: 'Missing url' };

    const body = JSON.stringify({
      event: ctx.event.type,
      tenantId: ctx.tenantId,
      order: ctx.order,
    });

    await this.postWebhook(url, body, method);
    return base;
  }

  private async execCsat(
    _node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    if (!ctx.order?.id) return { ...base, status: 'SKIPPED', error: 'Missing order id' };
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: ctx.order.id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new Error('Order not found in workflow tenant');

    await this.csat.createForOrder(ctx.tenantId, order.id);
    this.logger.log(`CSAT created for order ${ctx.order.protocol}`);
    return base;
  }

  private async execTaskService(
    node: WorkflowNode,
    ctx: WorkflowContext,
    base: ActionResult,
  ): Promise<ActionResult> {
    const taskName = node.config?.taskName as string;
    const team = node.config?.team as string;
    if (!taskName) return { ...base, status: 'SKIPPED', error: 'Missing taskName' };
    const configuredType = String(node.config?.serviceOrderType || 'AUDITORIA').toUpperCase();
    const configuredPriority = String(node.config?.priority || 'NORMAL').toUpperCase();
    const validType = (Object.values(ServiceOrderType) as string[]).includes(configuredType)
      ? (configuredType as ServiceOrderType)
      : 'AUDITORIA';
    const validPriority = (Object.values(Priority) as string[]).includes(configuredPriority)
      ? (configuredPriority as Priority)
      : 'NORMAL';

    const sourceOrder =
      typeof ctx.order?.id === 'string'
        ? await this.prisma.serviceOrder.findFirst({
            where: { id: ctx.order.id, tenantId: ctx.tenantId, deletedAt: null },
            select: { id: true, occurrenceId: true },
          })
        : null;
    if (typeof ctx.order?.id === 'string' && !sourceOrder) {
      throw new Error('Order not found in workflow tenant');
    }

    const policy = await this.slaEngine.findApplicablePolicy(
      ctx.tenantId,
      validPriority,
      validType,
    );
    const deadlineAt = await this.slaEngine.calculateTargetDate(
      new Date(),
      policy.hours,
      ctx.tenantId,
    );

    const created = await this.prisma.serviceOrder.create({
      data: {
        tenantId: ctx.tenantId,
        occurrenceId: sourceOrder?.occurrenceId ?? undefined,
        type: validType,
        priority: validPriority,
        status: 'ABERTA',
        protocol: `WF-${randomUUID().slice(0, 12)}`,
        title: taskName,
        description: `Tarefa criada automaticamente por workflow "${ctx.workflow?.ruleName || 'N/A'}". Time: ${team || 'N/A'}. Origem: O.S. ${ctx.order?.protocol || 'N/A'}.`,
        requester: typeof ctx.order?.requester === 'string' ? ctx.order.requester : undefined,
        sector: typeof ctx.order?.sector === 'string' ? ctx.order.sector : undefined,
        origin: 'WORKFLOW',
        deadlineAt,
        tags: [`workflow:${ctx.workflow?.ruleId || 'unknown'}`, `workflow-node:${node.id}`],
        internalNotes: `Workflow ${ctx.workflow?.ruleName || '-'} (${ctx.workflow?.ruleId || '-'}) · Node ${node.id}`,
        occurrences: {
          create: {
            sourceSystem: 'ERP',
            message: `Criada automaticamente por workflow. O.S origem: ${ctx.order?.protocol || '-'}`,
          },
        },
      },
      select: {
        id: true,
        protocol: true,
        title: true,
      },
    });

    if (sourceOrder) {
      await this.prisma.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: sourceOrder.id,
          sourceSystem: 'ERP',
          message: `Workflow criou O.S filha ${created.protocol} (${created.title}).`,
        },
      });
    }

    return {
      ...base,
      status: 'SUCCESS',
      error: undefined,
      createdOrderId: created.id,
      createdOrderProtocol: created.protocol,
    };
  }

  private async execCloseOrder(ctx: WorkflowContext, base: ActionResult): Promise<ActionResult> {
    if (!ctx.order?.id) return { ...base, status: 'SKIPPED', error: 'Missing order id' };
    const current = await this.prisma.serviceOrder.findFirst({
      where: { id: ctx.order.id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, status: true, tenantId: true },
    });
    if (!current) return { ...base, status: 'SKIPPED', error: 'Order not found' };
    if (
      current.status === ServiceOrderStatus.FECHADA ||
      current.status === ServiceOrderStatus.CANCELADA
    ) {
      return { ...base, status: 'SKIPPED', error: `Order already ${current.status}` };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const previousNotes =
        typeof (ctx.order as Record<string, unknown> | undefined)?.internalNotes === 'string'
          ? String((ctx.order as Record<string, unknown>).internalNotes)
          : '';
      const autoCloseNote = `${ctx.workflow?.ruleName || 'Workflow'} executou fechamento automático em ${now.toISOString()}.`;
      await tx.serviceOrder.update({
        where: { id: current.id },
        data: {
          status: ServiceOrderStatus.FECHADA,
          resolvedAt: now,
          closedAt: now,
          internalNotes: previousNotes ? `${previousNotes}\n${autoCloseNote}` : autoCloseNote,
        },
      });
      await tx.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: current.id,
          sourceSystem: 'ERP',
          message: `O.S fechada automaticamente pelo workflow "${ctx.workflow?.ruleName || '-'}".`,
        },
      });
      await tx.serviceOrderStatusEvent.create({
        data: {
          tenantId: current.tenantId,
          serviceOrderId: current.id,
          fromStatus: current.status,
          toStatus: ServiceOrderStatus.FECHADA,
          reason: 'workflow_auto_close',
          metadata: {
            workflowRuleId: ctx.workflow?.ruleId || null,
            workflowRuleName: ctx.workflow?.ruleName || null,
            eventType: ctx.event.type,
          },
        },
      });
    });

    return base;
  }

  private interpolate(template: string, ctx: WorkflowContext): string {
    return template
      .replace(/\{\{protocol\}\}/g, ctx.order?.protocol || '-')
      .replace(/\{\{status\}\}/g, ctx.order?.status || '-')
      .replace(/\{\{priority\}\}/g, ctx.order?.priority || '-')
      .replace(/\{\{event\}\}/g, ctx.event.type);
  }

  private async postWebhook(url: string, body: string, method = 'POST'): Promise<void> {
    await assertSafeUrl(url);
    const normalizedMethod = method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(normalizedMethod)) {
      throw new Error(`Webhook method not allowed: ${method}`);
    }
    try {
      const response = await fetch(url, {
        method: normalizedMethod,
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Webhook returned HTTP ${response.status}`);
      }
    } catch (err) {
      this.logger.warn(`Webhook failed: ${url} — ${(err as Error).message}`);
      throw err;
    }
  }
}
