import {
  WorkflowsService,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from './workflows.service';

function makeService(): WorkflowsService {
  const mockPrisma = {} as any;
  const mockAudit = { log: jest.fn() } as any;
  const mockExecutor = {
    executeNode: jest.fn().mockResolvedValue({ nodeId: 'a', subtype: 'test', status: 'SUCCESS' }),
  } as any;
  return new WorkflowsService(mockPrisma, mockAudit, mockExecutor);
}

function makeTriggerNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: 'trigger',
    type: 'trigger',
    subtype: 'os_criada',
    config: {},
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeActionNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: 'action-1',
    type: 'action',
    subtype: 'action_notify_slack',
    config: { webhookUrl: 'https://hooks.slack.com/test', message: 'Test {{protocol}}' },
    position: { x: 100, y: 0 },
    ...overrides,
  };
}

function makeConditionNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: 'cond-1',
    type: 'condition',
    subtype: 'cond_no_analyst',
    config: { field: 'priority', operator: 'eq', value: 'CRITICA' },
    position: { x: 50, y: 0 },
    ...overrides,
  };
}

function makeEdge(source: string, target: string, label?: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target, label };
}

function makeDef(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowDefinition {
  return { nodes, edges };
}

describe('WorkflowsService - validateDefinition', () => {
  let svc: WorkflowsService;

  beforeEach(() => {
    svc = makeService();
  });

  it('rejeita definicao sem nodes', () => {
    expect(() => (svc as any).validateDefinition({ nodes: [], edges: [] })).toThrow(
      'Workflow must contain at least one node.',
    );
  });

  it('rejeita definicao sem trigger', () => {
    expect(() => (svc as any).validateDefinition(makeDef([makeActionNode()], []))).toThrow(
      'Workflow must contain exactly one trigger node.',
    );
  });

  it('rejeita definicao com mais de um trigger', () => {
    expect(() =>
      (svc as any).validateDefinition(
        makeDef([makeTriggerNode(), makeTriggerNode({ id: 'trigger-2' })], []),
      ),
    ).toThrow('Workflow must contain exactly one trigger node.');
  });

  it('rejeita definicao sem acao', () => {
    expect(() =>
      (svc as any).validateDefinition(makeDef([makeTriggerNode(), makeConditionNode()], [])),
    ).toThrow('Workflow must contain at least one action node.');
  });

  it('rejeita edge com no inexistente', () => {
    expect(() =>
      (svc as any).validateDefinition(
        makeDef([makeTriggerNode(), makeActionNode()], [makeEdge('trigger', 'action-2')]),
      ),
    ).toThrow('Workflow contains edges pointing to non-existent nodes.');
  });

  it('rejeita self-loop', () => {
    expect(() =>
      (svc as any).validateDefinition(
        makeDef([makeTriggerNode(), makeActionNode()], [makeEdge('trigger', 'trigger')]),
      ),
    ).toThrow('Workflow does not allow self-loop edges.');
  });

  it('aceita definicao valida com trigger + action + edge', () => {
    expect(() =>
      (svc as any).validateDefinition(
        makeDef([makeTriggerNode(), makeActionNode()], [makeEdge('trigger', 'action-1')]),
      ),
    ).not.toThrow();
  });

  it('rejeita condition node sem config field', () => {
    const cond = makeConditionNode({ subtype: 'cond_no_analyst', config: {} });
    const condWithField: WorkflowNode = {
      ...cond,
      subtype: 'cond_priority_check',
      config: {},
    };
    expect(() => (svc as any).validateNodeConfig(condWithField)).toThrow('requires config field');
  });

  it('rejeita action_notify_slack sem webhookUrl', () => {
    const node: WorkflowNode = {
      id: 'a1',
      type: 'action',
      subtype: 'action_notify_slack',
      config: { message: 'test' },
      position: { x: 0, y: 0 },
    };
    expect(() => (svc as any).validateNodeConfig(node)).toThrow(
      'requires config field "webhookUrl"',
    );
  });
});

describe('WorkflowsService - evaluateTrigger', () => {
  let svc: WorkflowsService;

  beforeEach(() => {
    svc = makeService();
  });

  it('dispara os_criada para evento order_created', () => {
    const node: WorkflowNode = {
      id: 't',
      type: 'trigger',
      subtype: 'os_criada',
      config: {},
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateTrigger(node, { type: 'order_created' })).toBe(true);
  });

  it('nao dispara os_criada para evento order_closed', () => {
    const node: WorkflowNode = {
      id: 't',
      type: 'trigger',
      subtype: 'os_criada',
      config: {},
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateTrigger(node, { type: 'order_closed' })).toBe(false);
  });

  it('dispara sla_breach para evento sla_breach', () => {
    const node: WorkflowNode = {
      id: 't',
      type: 'trigger',
      subtype: 'sla_breach',
      config: {},
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateTrigger(node, { type: 'sla_breach' })).toBe(true);
  });

  it('dispara os_critica para order_created e order_updated', () => {
    const node: WorkflowNode = {
      id: 't',
      type: 'trigger',
      subtype: 'os_critica',
      config: {},
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateTrigger(node, { type: 'order_created' })).toBe(true);
    expect((svc as any).evaluateTrigger(node, { type: 'order_updated' })).toBe(true);
    expect((svc as any).evaluateTrigger(node, { type: 'sla_breach' })).toBe(false);
  });
});

describe('WorkflowsService - evaluateCondition', () => {
  let svc: WorkflowsService;

  beforeEach(() => {
    svc = makeService();
  });

  it('eq retorna true quando valor igual', () => {
    const node: WorkflowNode = {
      id: 'c',
      type: 'condition',
      subtype: 'cond_priority_check',
      config: { field: 'priority', operator: 'eq', value: 'CRITICA' },
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateCondition(node, { priority: 'CRITICA' })).toBe(true);
  });

  it('eq retorna false quando valor diferente', () => {
    const node: WorkflowNode = {
      id: 'c',
      type: 'condition',
      subtype: 'cond_priority_check',
      config: { field: 'priority', operator: 'eq', value: 'CRITICA' },
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateCondition(node, { priority: 'BAIXA' })).toBe(false);
  });

  it('neq retorna true quando valor diferente', () => {
    const node: WorkflowNode = {
      id: 'c',
      type: 'condition',
      subtype: 'cond_priority_check',
      config: { field: 'status', operator: 'neq', value: 'FECHADA' },
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateCondition(node, { status: 'ABERTA' })).toBe(true);
  });

  it('contains retorna true quando substring presente', () => {
    const node: WorkflowNode = {
      id: 'c',
      type: 'condition',
      subtype: 'cond_priority_check',
      config: { field: 'title', operator: 'contains', value: 'lentidao' },
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateCondition(node, { title: 'Problema de lentidao na rede' })).toBe(
      true,
    );
  });

  it('sem field retorna true (pass-through)', () => {
    const node: WorkflowNode = {
      id: 'c',
      type: 'condition',
      subtype: 'cond_no_analyst',
      config: {},
      position: { x: 0, y: 0 },
    };
    expect((svc as any).evaluateCondition(node, {})).toBe(true);
  });
});

describe('WorkflowsService - governance', () => {
  it('bloqueia execução que exige aprovação ainda não concluída', async () => {
    const svc = makeService();
    await expect(
      (svc as any).getGovernanceBlockReason(
        't1',
        'r1',
        { requiresApproval: true },
        { approvalCompleted: false },
      ),
    ).resolves.toContain('approval');
  });

  it('bloqueia execução que exige ticket de mudança ausente', async () => {
    const svc = makeService();
    await expect(
      (svc as any).getGovernanceBlockReason('t1', 'r1', { changeTicketRequired: true }, {}),
    ).resolves.toContain('change ticket');
  });
});
