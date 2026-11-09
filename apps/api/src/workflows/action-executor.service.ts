import { Inject, Injectable, Logger } from '@nestjs/common';
import { assertSafeUrl, safeFetch } from '../common/ssrf-guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CsatService } from '../csat/csat.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import type { WorkflowNode, WorkflowContext } from './workflows.service';
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
    if (
      ['task_service', 'action_close_order', 'action_assign', 'action_escalate'].includes(
        node.subtype,
      )
    ) {
      return {
        ...base,
        status: 'FAILED',
        error:
          'Esta ação pertence aos processos operacionais. Workflows executam somente notificações, webhooks e CSAT.',
      };
    }

    try {
      switch (node.subtype) {
        case 'action_notify_slack':
          return await this.execNotifySlack(node, ctx, base);
        case 'action_webhook':
          return await this.execWebhook(node, ctx, base);
        case 'action_csat':
          return await this.execCsat(node, ctx, base);
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

    await this.postWebhook(webhookUrl, body, 'POST', this.deliveryKey(node, ctx));
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

    await this.postWebhook(url, body, method, this.deliveryKey(node, ctx));
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
      select: { id: true, status: true },
    });
    if (!order) throw new Error('Order not found in workflow tenant');
    if (order.status !== 'FECHADA')
      return { ...base, status: 'SKIPPED', error: 'CSAT aguarda o fechamento efetivo da O.S.' };

    await this.csat.createForOrder(ctx.tenantId, order.id, !!ctx.eventKey);
    this.logger.log(`CSAT created for order ${ctx.order.protocol}`);
    return base;
  }

  private interpolate(template: string, ctx: WorkflowContext): string {
    return template
      .replace(/\{\{protocol\}\}/g, ctx.order?.protocol || '-')
      .replace(/\{\{status\}\}/g, ctx.order?.status || '-')
      .replace(/\{\{priority\}\}/g, ctx.order?.priority || '-')
      .replace(/\{\{event\}\}/g, ctx.event.type);
  }

  private deliveryKey(node: WorkflowNode, ctx: WorkflowContext) {
    return ctx.eventKey ? `${ctx.eventKey}:${ctx.workflow?.ruleId || ''}:${node.id}` : undefined;
  }

  private async postWebhook(
    url: string,
    body: string,
    method = 'POST',
    deliveryKey?: string,
  ): Promise<void> {
    await assertSafeUrl(url);
    const normalizedMethod = method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(normalizedMethod)) {
      throw new Error(`Webhook method not allowed: ${method}`);
    }
    try {
      const response = await safeFetch(url, {
        method: normalizedMethod,
        headers: {
          'content-type': 'application/json',
          ...(deliveryKey ? { 'idempotency-key': deliveryKey } : {}),
        },
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
