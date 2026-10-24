export type FlowNode = {
  id: string;
  name: string;
  kind: 'task' | 'fork' | 'join' | 'end';
  orderKey: string;
  sector: string;
  roles: string[];
  serviceType: string;
  slaMinutes: number;
  requiredFields: string[];
  routes: Record<string, string>;
  closeOn: string[];
  waitFor: string[];
  position: { x: number; y: number };
  assigneeUserId?: string;
};
export type FlowDefinition = {
  engineVersion: 2;
  code: string;
  name: string;
  version: number;
  description: string;
  sourceTypes: string[];
  start: string;
  maxVisits: number;
  nodes: FlowNode[];
};
export type FlowTemplate = {
  id: string;
  code: string;
  version: number;
  definition: FlowDefinition;
  draft?: FlowDefinition | null;
  publishedAt: string | null;
};
export type FlowOrder = {
  pausedAt?: string | null;
  scheduledAt?: string | null;
  id: string;
  protocol: string;
  title: string;
  status: string;
  parentOrderId?: string | null;
  sector?: string;
  analystName?: string;
  deadlineAt?: string;
  processInstanceId?: string;
  assigneeUserId?: string | null;
  occurrences?: { id: string; message: string; createdAt: string; sourceAuthorName?: string }[];
};
export type FlowStep = {
  id: string;
  nodeId: string;
  attempt: number;
  status: string;
  orderId?: string;
  outcome?: string;
  evidence: Record<string, string>;
  enteredAt: string;
  completedAt?: string;
  dueAt?: string;
};
export type FlowInstance = {
  id: string;
  version: number;
  engineVersion: number;
  rootOrderId: string;
  templateCode: string;
  templateVersion: number;
  status: string;
  definition: FlowDefinition;
  state: {
    mode?: string;
    demoId?: string;
    sourceInstanceId?: string;
    error?: string;
    sourceStatus?: string;
    originalSourceType?: string;
    classificationBasis?: string;
    classificationReviewed?: boolean;
    successorId?: string;
  };
  occurrence: {
    id: string;
    provider: string;
    number: string;
    description: string;
    customerId?: string;
  };
  orders?: FlowOrder[];
  links?: { orderKey: string; order: FlowOrder }[];
  steps: FlowStep[];
  events?: {
    id: string;
    type: string;
    status: string;
    attempts: number;
    error?: string;
    createdAt: string;
  }[];
};
export const flowStatuses: Record<string, string> = {
  HISTORICAL: 'Histórico de origem',
  ACTIVE: 'Em execução',
  WAITING: 'Aguardando',
  PAUSED: 'Pausado',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  FAILED: 'Falha — requer retomada',
  SUPERSEDED: 'Iteração anterior',
};

export type TrackingStatus = 'ACTIVE' | 'COMPLETED' | 'WAITING' | 'FAILED' | 'PENDING' | 'CANCELED';
export function trackingSteps(instance: FlowInstance) {
  if (['HISTORICAL', 'SUPERSEDED'].includes(instance.status)) return [];
  const latest = new Map<string, FlowStep>();
  for (const step of instance.steps) {
    const previous = latest.get(step.nodeId);
    if (
      !previous ||
      step.attempt > previous.attempt ||
      (step.attempt === previous.attempt && step.enteredAt > previous.enteredAt)
    )
      latest.set(step.nodeId, step);
  }
  return [...latest.values()].map((step) => ({
    ...step,
    displayStatus: (step.status === 'ACTIVE' &&
    instance.links?.some((l) => l.order.id === step.orderId && l.order.pausedAt)
      ? 'WAITING'
      : ['ACTIVE', 'WAITING'].includes(step.status) && instance.status === 'FAILED'
        ? 'FAILED'
        : ['ACTIVE', 'WAITING'].includes(step.status) &&
            ['PAUSED', 'WAITING'].includes(instance.status)
          ? 'WAITING'
          : ['ACTIVE', 'WAITING'].includes(step.status) && instance.status === 'CANCELED'
            ? 'CANCELED'
            : ['ACTIVE', 'COMPLETED', 'WAITING', 'FAILED', 'CANCELED'].includes(step.status)
              ? step.status
              : 'PENDING') as TrackingStatus,
  }));
}

// Pure preview: it never creates orders, changes a status or sends notifications.
export function simulateFlow(
  definition: FlowDefinition,
  decisions: { nodeId: string; outcome: string }[],
) {
  const active = new Set<string>();
  const completed = new Set<string>();
  const queue = [definition.start];
  let index = 0;
  let count = 0;
  while (queue.length && count++ < 200) {
    const id = queue.shift()!;
    const node = definition.nodes.find((n) => n.id === id);
    if (!node) continue;
    if (node.kind === 'task') {
      const decision = decisions[index];
      if (decision?.nodeId === id && node.routes[decision.outcome]) {
        index++;
        completed.add(id);
        active.delete(id);
        queue.push(node.routes[decision.outcome]);
      } else active.add(id);
    } else if (node.kind === 'join') {
      if (node.waitFor.every((n) => completed.has(n))) {
        active.delete(id);
        completed.add(id);
        queue.push(...Object.values(node.routes));
      } else active.add(id);
    } else {
      completed.add(id);
      if (node.kind !== 'end') queue.push(...Object.values(node.routes));
    }
    // Replay choices for parallel tasks which were already waiting when selected.
    const pending = decisions[index];
    if (pending && active.has(pending.nodeId)) {
      active.delete(pending.nodeId);
      queue.unshift(pending.nodeId);
    }
  }
  return { active: [...active], completed: [...completed], limited: count >= 200 };
}
