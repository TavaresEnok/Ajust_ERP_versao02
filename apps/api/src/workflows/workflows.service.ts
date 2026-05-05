import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  subtype: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  governance?: {
    ownerTeam?: string;
    requiresApproval?: boolean;
    changeTicketRequired?: boolean;
    maxExecutionsPerHour?: number;
    stopOnFailure?: boolean;
  };
  versions?: Array<{
    version: number;
    createdAt: string;
    createdBy?: string | null;
    name: string;
    description?: string;
    definition: Omit<WorkflowDefinition, 'versions'>;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

@Injectable()
export class WorkflowsService {
  private get db(): DB {
    // Cast to any until Prisma client is regenerated with the WorkflowRule model
    return this.prisma as DB;
  }

  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(tenantId: string) {
    return this.db.workflowRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const rule = await this.db.workflowRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Workflow not found');
    return rule;
  }

  async create(tenantId: string, _userId: string, data: {
    name: string;
    description?: string;
    enabled?: boolean;
    definition: WorkflowDefinition;
  }) {
    this.validateDefinition(data.definition);
    const created = await this.db.workflowRule.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? true,
        definition: data.definition as any,
      },
    });
    await this.audit.log(tenantId, _userId, 'OS_UPDATE', 'workflow_rule', created.id, {
      op: 'create',
      name: created.name,
      enabled: created.enabled,
      governance: data.definition?.governance || {},
    });
    return created;
  }

  async update(tenantId: string, actorUserId: string, id: string, data: {
    name?: string;
    description?: string;
    enabled?: boolean;
    definition?: WorkflowDefinition;
  }) {
    const current = await this.findOne(tenantId, id);
    if (data.definition !== undefined) {
      this.validateDefinition(data.definition);
    }
    const nextDefinition = data.definition !== undefined
      ? this.withVersionHistory(current, data.definition, actorUserId)
      : undefined;

    const updated = await this.db.workflowRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(nextDefinition !== undefined && { definition: nextDefinition as any }),
      },
    });
    const diff = this.buildWorkflowDiff(current, updated);
    if (Object.keys(diff).length > 0) {
      await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'workflow_rule', id, {
        op: 'update',
        diff,
      });
    }
    return updated;
  }

  async remove(tenantId: string, actorUserId: string, id: string) {
    const current = await this.findOne(tenantId, id);
    const deleted = await this.db.workflowRule.delete({ where: { id } });
    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'workflow_rule', id, {
      op: 'delete',
      name: current.name,
    });
    return deleted;
  }

  async toggle(tenantId: string, actorUserId: string, id: string) {
    const rule = await this.findOne(tenantId, id);
    const toggled = await this.db.workflowRule.update({
      where: { id },
      data: { enabled: !rule.enabled },
    });
    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'workflow_rule', id, {
      op: 'toggle',
      enabled: toggled.enabled,
    });
    return toggled;
  }

  async rollbackToVersion(
    tenantId: string,
    actorUserId: string,
    id: string,
    version: number
  ) {
    const current = await this.findOne(tenantId, id);
    const def = (current.definition || {}) as WorkflowDefinition;
    const versions = Array.isArray(def.versions) ? def.versions : [];
    const selected = versions.find((v) => v.version === version);
    if (!selected) {
      throw new BadRequestException(`Version ${version} not found for workflow ${id}.`);
    }

    const restored = this.withVersionHistory(
      current,
      {
        nodes: selected.definition.nodes || [],
        edges: selected.definition.edges || [],
        governance: selected.definition.governance || {},
      },
      actorUserId
    );

    const updated = await this.db.workflowRule.update({
      where: { id },
      data: { definition: restored as any },
    });

    await this.audit.log(tenantId, actorUserId, 'OS_UPDATE', 'workflow_rule', id, {
      op: 'rollback',
      restoredVersion: version,
    });

    return updated;
  }

  /**
   * Execute all enabled workflows for a tenant when an event fires.
   * Returns list of triggered workflow names.
   */
  async executeForEvent(tenantId: string, event: {
    type: 'order_created' | 'order_updated' | 'order_closed' | 'sla_breach';
    order?: Record<string, any>;
  }): Promise<string[]> {
    let rules: any[] = [];
    try {
      rules = await this.db.workflowRule.findMany({
        where: { tenantId, enabled: true },
      });
    } catch {
      // Table may not exist yet before migration — fail silently
      return [];
    }

    const triggered: string[] = [];

    for (const rule of rules) {
      const def = rule.definition as unknown as WorkflowDefinition;
      const triggerNode = def.nodes?.find((n: WorkflowNode) => n.type === 'trigger');
      if (!triggerNode) continue;

      if (!this.evaluateTrigger(triggerNode, event)) continue;
      const executedActions = this.evaluateGraph(def, event.order || {});
      if (executedActions === 0) continue;

      await this.db.workflowRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });

      triggered.push(rule.name);
    }

    return triggered;
  }

  private evaluateTrigger(node: WorkflowNode, event: { type: string }): boolean {
    const triggerMap: Record<string, string[]> = {
      'start_implantacao': ['order_created', 'order_updated'],
      'start_os_criada': ['order_created'],
      'os_criada':    ['order_created'],
      'os_fechada':   ['order_closed'],
      'os_atualizada':['order_updated'],
      'sla_breach':   ['sla_breach'],
      'os_critica':   ['order_created', 'order_updated'],
    };
    return (triggerMap[node.subtype] || []).includes(event.type);
  }

  private evaluateGraph(def: WorkflowDefinition, order: Record<string, any>): number {
    const trigger = def.nodes.find((n) => n.type === 'trigger');
    if (!trigger) return 0;

    const edgesBySource = new Map<string, WorkflowEdge[]>();
    const incomingByTarget = new Map<string, WorkflowEdge[]>();
    for (const edge of def.edges || []) {
      const list = edgesBySource.get(edge.source) || [];
      list.push(edge);
      edgesBySource.set(edge.source, list);

      const incoming = incomingByTarget.get(edge.target) || [];
      incoming.push(edge);
      incomingByTarget.set(edge.target, incoming);
    }

    let actionCount = 0;
    const queue = [trigger.id];
    const executed = new Set<string>();
    const deliveredTokens = new Map<string, Set<string>>();
    const readyGate = new Set<string>([trigger.id]);
    deliveredTokens.set(trigger.id, new Set(['__start__']));

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      const node = def.nodes.find((n) => n.id === currentId);
      if (!node) continue;
      if (executed.has(currentId)) continue;

      const incoming = incomingByTarget.get(currentId) || [];
      const arrived = deliveredTokens.get(currentId) || new Set<string>();
      const isJoinGateway = node.type === 'condition' && node.subtype === 'gateway_parallel_join';
      const joinReady = incoming.length <= 1 || arrived.size >= incoming.length;
      const passThroughReady = incoming.length === 0 || arrived.size > 0;
      const canExecute = readyGate.has(currentId) || (isJoinGateway ? joinReady : passThroughReady);
      if (!canExecute) continue;
      executed.add(currentId);

      if (node.type === 'action') {
        actionCount += 1;
      }

      const outgoing = edgesBySource.get(currentId) || [];
      if (outgoing.length === 0) continue;

      if (node.type === 'condition') {
        if (node.subtype === 'gateway_parallel') {
          for (const edge of outgoing) {
            const targetTokens = deliveredTokens.get(edge.target) || new Set<string>();
            targetTokens.add(currentId);
            deliveredTokens.set(edge.target, targetTokens);
            queue.push(edge.target);
          }
          continue;
        }
        const result = this.evaluateCondition(node, order);
        const label = result ? 'true' : 'false';
        const branch = outgoing.find((e) => (e.label || '').toLowerCase() === label);
        if (branch) {
          const targetTokens = deliveredTokens.get(branch.target) || new Set<string>();
          targetTokens.add(currentId);
          deliveredTokens.set(branch.target, targetTokens);
          queue.push(branch.target);
        }
        continue;
      }

      for (const edge of outgoing) {
        const targetTokens = deliveredTokens.get(edge.target) || new Set<string>();
        targetTokens.add(currentId);
        deliveredTokens.set(edge.target, targetTokens);
        queue.push(edge.target);
      }
    }

    return actionCount;
  }

  private evaluateCondition(node: WorkflowNode, order: Record<string, any>): boolean {
    const { field, operator, value } = node.config || {};
    if (!field) return true;
    const actual = order[field];
    switch (operator) {
      case 'eq':       return actual === value;
      case 'neq':      return actual !== value;
      case 'contains': return String(actual ?? '').includes(value);
      default:         return true;
    }
  }

  private validateDefinition(def: WorkflowDefinition): void {
    const nodes = def?.nodes || [];
    const edges = def?.edges || [];

    if (nodes.length === 0) {
      throw new BadRequestException('Workflow must contain at least one node.');
    }

    const triggers = nodes.filter((n) => n.type === 'trigger');
    if (triggers.length !== 1) {
      throw new BadRequestException('Workflow must contain exactly one trigger node.');
    }

    const actions = nodes.filter((n) => n.type === 'action');
    if (actions.length === 0) {
      throw new BadRequestException('Workflow must contain at least one action node.');
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException('Workflow contains edges pointing to non-existent nodes.');
      }
      if (edge.source === edge.target) {
        throw new BadRequestException('Workflow does not allow self-loop edges.');
      }
    }

    const outBySource = new Map<string, WorkflowEdge[]>();
    const inByTarget = new Map<string, WorkflowEdge[]>();
    for (const edge of edges) {
      const list = outBySource.get(edge.source) || [];
      list.push(edge);
      outBySource.set(edge.source, list);

      const incoming = inByTarget.get(edge.target) || [];
      incoming.push(edge);
      inByTarget.set(edge.target, incoming);
    }

    for (const node of nodes) {
      const outgoing = outBySource.get(node.id) || [];
      const incoming = inByTarget.get(node.id) || [];
      if (node.type === 'condition') {
        if (node.subtype === 'gateway_parallel') {
          if (incoming.length !== 1) {
            throw new BadRequestException(`Parallel split gateway "${node.id}" must have exactly 1 incoming branch.`);
          }
          if (outgoing.length < 2) {
            throw new BadRequestException(`Parallel gateway "${node.id}" must have at least 2 outgoing branches.`);
          }
          continue;
        }
        if (node.subtype === 'gateway_parallel_join') {
          if (incoming.length < 2) {
            throw new BadRequestException(`Parallel join gateway "${node.id}" must have at least 2 incoming branches.`);
          }
          if (outgoing.length !== 1) {
            throw new BadRequestException(`Parallel join gateway "${node.id}" must have exactly 1 outgoing branch.`);
          }
          continue;
        }
        if (outgoing.length > 2) {
          throw new BadRequestException(`Condition node "${node.id}" must have at most 2 branches.`);
        }
        const labels = new Set(outgoing.map((e) => (e.label || '').toLowerCase()).filter(Boolean));
        if (outgoing.length === 2 && (!labels.has('true') || !labels.has('false'))) {
          throw new BadRequestException(`Condition node "${node.id}" with 2 branches must use labels "true" and "false".`);
        }
      } else if (outgoing.length > 1) {
        throw new BadRequestException(`Node "${node.id}" must have at most one outgoing edge.`);
      }

      this.validateNodeConfig(node);
    }
  }

  private validateNodeConfig(node: WorkflowNode): void {
    const cfg = node.config || {};
    const requireFields = (fields: string[]) => {
      for (const field of fields) {
        const value = cfg[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          throw new BadRequestException(`Node "${node.id}" requires config field "${field}".`);
        }
      }
    };

    if (node.type === 'condition') {
      if (node.subtype === 'cond_no_analyst' || node.subtype === 'gateway_parallel' || node.subtype === 'gateway_parallel_join') return;
      requireFields(['field', 'operator', 'value']);
      return;
    }

    if (node.type === 'action') {
      const requiredByAction: Record<string, string[]> = {
        action_notify_slack: ['webhookUrl', 'message'],
        action_assign: ['analystId'],
        action_escalate: ['to'],
        action_webhook: ['url', 'method'],
        action_csat: ['delay'],
        task_service: ['taskName', 'team'],
      };
      const fields = requiredByAction[node.subtype];
      if (fields) requireFields(fields);
    }
  }

  private buildWorkflowDiff(before: any, after: any): Record<string, unknown> {
    const beforeDef = before?.definition || {};
    const afterDef = after?.definition || {};
    const diff: Record<string, unknown> = {};

    if (before?.name !== after?.name) diff.name = { from: before?.name, to: after?.name };
    if (before?.description !== after?.description) diff.description = { from: before?.description, to: after?.description };
    if (before?.enabled !== after?.enabled) diff.enabled = { from: before?.enabled, to: after?.enabled };

    const beforeNodes = Array.isArray(beforeDef.nodes) ? beforeDef.nodes.length : 0;
    const afterNodes = Array.isArray(afterDef.nodes) ? afterDef.nodes.length : 0;
    if (beforeNodes !== afterNodes) diff.nodesCount = { from: beforeNodes, to: afterNodes };

    const beforeEdges = Array.isArray(beforeDef.edges) ? beforeDef.edges.length : 0;
    const afterEdges = Array.isArray(afterDef.edges) ? afterDef.edges.length : 0;
    if (beforeEdges !== afterEdges) diff.edgesCount = { from: beforeEdges, to: afterEdges };

    const beforeGov = JSON.stringify(beforeDef.governance || {});
    const afterGov = JSON.stringify(afterDef.governance || {});
    if (beforeGov !== afterGov) diff.governance = {
      from: beforeDef.governance || {},
      to: afterDef.governance || {},
    };

    return diff;
  }

  private withVersionHistory(current: any, next: WorkflowDefinition, actorUserId: string | null): WorkflowDefinition {
    const currentDef = (current?.definition || {}) as WorkflowDefinition;
    const existingVersions = Array.isArray(currentDef.versions) ? currentDef.versions : [];
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map((v) => v.version)) + 1
      : 1;

    type WorkflowVersionEntry = NonNullable<WorkflowDefinition['versions']>[number];
    const snapshot: WorkflowVersionEntry = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      createdBy: actorUserId,
      name: current?.name || 'workflow',
      description: current?.description || undefined,
      definition: {
        nodes: currentDef.nodes || [],
        edges: currentDef.edges || [],
        governance: currentDef.governance || {},
      },
    };

    const versions = [...existingVersions, snapshot].slice(-20);
    return {
      ...next,
      versions,
    };
  }
}
