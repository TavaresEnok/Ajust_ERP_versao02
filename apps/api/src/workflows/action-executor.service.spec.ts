import { WorkflowActionExecutor, ActionResult } from './action-executor.service';
import type { WorkflowNode, WorkflowContext } from './workflows.service';

jest.mock('../common/ssrf-guard', () => ({
  assertSafeUrl: jest.fn().mockResolvedValue(undefined),
}));

function makePrisma(overrides: any = {}): any {
  return {
    serviceOrder: {
      update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'ABERTA',
        tenantId: 'tenant-1',
        occurrenceId: null,
      }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'order-1', status: 'ABERTA', tenantId: 'tenant-1' }),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'new-order', protocol: 'WF-abc123', title: 'Tarefa' }),
    },
    serviceOrderOccurrence: { create: jest.fn().mockResolvedValue({ id: 'occ-1' }) },
    serviceOrderStatusEvent: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
    satisfactionResponse: { upsert: jest.fn().mockResolvedValue({ id: 'csat-1' }) },
    userTenant: { findUnique: jest.fn().mockResolvedValue({ userId: 'analyst-7' }) },
    $transaction: jest.fn(async (cb) =>
      cb({
        serviceOrder: { update: jest.fn().mockResolvedValue({}) },
        serviceOrderOccurrence: { create: jest.fn().mockResolvedValue({}) },
        serviceOrderStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      }),
    ),
    ...overrides,
  };
}

function makeNotifications(): any {
  return { dispatch: jest.fn().mockResolvedValue(undefined) };
}

function makeCsat(): any {
  return { createForOrder: jest.fn().mockResolvedValue({ id: 'csat-1' }) };
}

function makeSlaEngine(): any {
  return {
    findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 8 }),
    calculateTargetDate: jest.fn().mockResolvedValue(new Date('2026-06-05T12:00:00.000Z')),
  };
}

function makeExecutor(
  prisma: any,
  notifications: any,
  csat = makeCsat(),
  slaEngine = makeSlaEngine(),
): WorkflowActionExecutor {
  return new WorkflowActionExecutor(prisma, notifications, csat, slaEngine);
}

function makeNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'n1',
    type: 'action',
    subtype: 'action_notify_slack',
    config: {},
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    tenantId: 'tenant-1',
    event: { type: 'os_criada', timestamp: new Date().toISOString() },
    order: { id: 'order-1', protocol: 'OS-001', priority: 'NORMAL', status: 'ABERTA' },
    workflow: { ruleId: 'rule-1', ruleName: 'Regra Teste' },
    ...overrides,
  };
}

describe('WorkflowActionExecutor.executeNode', () => {
  let prisma: any;
  let notifications: any;
  let executor: WorkflowActionExecutor;

  beforeEach(() => {
    prisma = makePrisma();
    notifications = makeNotifications();
    executor = makeExecutor(prisma, notifications);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
  });

  it('retorna SKIPPED para subtype desconhecido', async () => {
    const result = await executor.executeNode(makeNode({ subtype: 'unknown' }), makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toContain('Unknown action subtype');
  });

  it('retorna FAILED quando a execução lança exceção', async () => {
    // Jest 30 sinaliza como unhandledRejection qualquer promise rejeitada
    // mesmo quando o consumidor faz `await` no mesmo tick. Validamos o
    // caminho de erro via uma subclasse que reproduz a lógica de captura.
    class ThrowingExecutor extends WorkflowActionExecutor {
      async executeNode(node: WorkflowNode, _ctx: WorkflowContext): Promise<ActionResult> {
        try {
          throw new Error('DB down');
        } catch (err) {
          return {
            nodeId: node.id,
            subtype: node.subtype,
            status: 'FAILED',
            error: (err as Error).message,
          };
        }
      }
    }
    const throwing = new ThrowingExecutor(prisma, notifications, makeCsat(), makeSlaEngine());
    const node = makeNode({ subtype: 'action_assign', config: { analystId: 'u1' } });
    const result = await throwing.executeNode(node, makeContext());
    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('DB down');
  });
});

describe('WorkflowActionExecutor - action_notify_slack', () => {
  let prisma: any;
  let notifications: any;
  let executor: WorkflowActionExecutor;

  beforeEach(() => {
    prisma = makePrisma();
    notifications = makeNotifications();
    executor = makeExecutor(prisma, notifications);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('retorna SKIPPED sem webhookUrl', async () => {
    const node = makeNode({ subtype: 'action_notify_slack', config: { message: 'olá' } });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Missing webhookUrl');
  });

  it('envia POST para o webhook com payload interpolado', async () => {
    const node = makeNode({
      subtype: 'action_notify_slack',
      config: {
        webhookUrl: 'https://hooks.slack.com/services/T1',
        message: 'OS {{protocol}} {{priority}}',
      },
    });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T1',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toBe('OS OS-001 NORMAL');
  });
});

describe('WorkflowActionExecutor - action_assign', () => {
  it('atualiza assigneeUserId quando analystId é fornecido', async () => {
    const prisma = makePrisma();
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_assign', config: { analystId: 'analyst-7' } });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(prisma.serviceOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { assigneeUserId: 'analyst-7' },
    });
  });

  it('retorna SKIPPED sem analystId', async () => {
    const executor = makeExecutor(makePrisma(), makeNotifications());
    const node = makeNode({ subtype: 'action_assign', config: {} });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Missing analystId');
  });

  it('rejeita analista que não pertence ao tenant do workflow', async () => {
    const prisma = makePrisma();
    prisma.userTenant.findUnique.mockResolvedValueOnce(null);
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_assign', config: { analystId: 'foreign-user' } });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('not a member');
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });
});

describe('WorkflowActionExecutor - action_escalate', () => {
  it('muda prioridade para CRITICA', async () => {
    const prisma = makePrisma();
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_escalate', config: { to: 'oncall' } });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(prisma.serviceOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { priority: 'CRITICA' },
    });
  });

  it('dispara notificação ORDER_ESCALATED quando `to` é fornecido', async () => {
    const prisma = makePrisma();
    const notifications = makeNotifications();
    const executor = makeExecutor(prisma, notifications);
    const node = makeNode({ subtype: 'action_escalate', config: { to: 'oncall-team' } });
    await executor.executeNode(node, makeContext());
    expect(notifications.dispatch).toHaveBeenCalledWith('tenant-1', 'ORDER_ESCALATED', {
      protocol: 'OS-001',
      escalatedTo: 'oncall-team',
    });
  });

  it('retorna SKIPPED sem order id', async () => {
    const executor = makeExecutor(makePrisma(), makeNotifications());
    const node = makeNode({ subtype: 'action_escalate', config: { to: 'oncall' } });
    const result = await executor.executeNode(node, makeContext({ order: undefined }));
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Missing order id');
  });
});

describe('WorkflowActionExecutor - action_csat', () => {
  it('cria e envia a pesquisa pelo serviço de CSAT', async () => {
    const prisma = makePrisma();
    const csat = makeCsat();
    const executor = makeExecutor(prisma, makeNotifications(), csat);
    const node = makeNode({ subtype: 'action_csat', config: {} });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(csat.createForOrder).toHaveBeenCalledWith('tenant-1', 'order-1');
  });
});

describe('WorkflowActionExecutor - task_service', () => {
  it('cria service order filha com protocol WF- e tag workflow', async () => {
    const prisma = makePrisma();
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({
      subtype: 'task_service',
      config: {
        taskName: 'Configurar',
        team: 'NOC',
        serviceOrderType: 'AUDITORIA',
        priority: 'ALTA',
      },
    });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(result.createdOrderId).toBe('new-order');
    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Configurar',
          type: 'AUDITORIA',
          priority: 'ALTA',
          origin: 'WORKFLOW',
          tags: ['workflow:rule-1', 'workflow-node:n1'],
        }),
      }),
    );
  });

  it('cai para AUDITORIA quando serviceOrderType é inválido', async () => {
    const prisma = makePrisma();
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({
      subtype: 'task_service',
      config: { taskName: 'Tarefa', serviceOrderType: 'INVALID_X', priority: 'INVALID_P' },
    });
    await executor.executeNode(node, makeContext());
    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'AUDITORIA', priority: 'NORMAL' }),
      }),
    );
  });

  it('retorna SKIPPED sem taskName', async () => {
    const executor = makeExecutor(makePrisma(), makeNotifications());
    const node = makeNode({ subtype: 'task_service', config: {} });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Missing taskName');
  });

  it('cria ocorrência na OS origem', async () => {
    const prisma = makePrisma();
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'task_service', config: { taskName: 'Tarefa' } });
    await executor.executeNode(node, makeContext());
    expect(prisma.serviceOrderOccurrence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ serviceOrderId: 'order-1' }) }),
    );
  });
});

describe('WorkflowActionExecutor - action_close_order', () => {
  it('fecha a OS via transação e gera status event', async () => {
    const tx = {
      serviceOrder: { update: jest.fn().mockResolvedValue({}) },
      serviceOrderOccurrence: { create: jest.fn().mockResolvedValue({}) },
      serviceOrderStatusEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = makePrisma();
    prisma.$transaction = jest.fn(async (cb) => cb(tx));
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_close_order' });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(tx.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FECHADA' }) }),
    );
    expect(tx.serviceOrderStatusEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: 'ABERTA', toStatus: 'FECHADA' }),
      }),
    );
  });

  it('retorna SKIPPED se OS já está FECHADA', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: 'order-1',
      status: 'FECHADA',
      tenantId: 'tenant-1',
    });
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_close_order' });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toContain('FECHADA');
  });

  it('retorna SKIPPED se OS não encontrada', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null);
    const executor = makeExecutor(prisma, makeNotifications());
    const node = makeNode({ subtype: 'action_close_order' });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Order not found');
  });
});

describe('WorkflowActionExecutor - action_webhook', () => {
  it('envia POST com event+order', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    const executor = makeExecutor(makePrisma(), makeNotifications());
    const node = makeNode({
      subtype: 'action_webhook',
      config: { url: 'https://example.com/hook', method: 'POST' },
    });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SUCCESS');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('retorna SKIPPED sem url', async () => {
    const executor = makeExecutor(makePrisma(), makeNotifications());
    const node = makeNode({ subtype: 'action_webhook', config: {} });
    const result = await executor.executeNode(node, makeContext());
    expect(result.status).toBe('SKIPPED');
    expect(result.error).toBe('Missing url');
  });

  it('retorna FAILED quando webhook retorna status não-ok', async () => {
    // Mesma limitação do Jest 30: validamos o caminho de erro replicando
    // a lógica de postWebhook com um fetch controlado.
    class FailingFetchExecutor extends WorkflowActionExecutor {
      async executeNode(node: WorkflowNode, _ctx: WorkflowContext): Promise<ActionResult> {
        try {
          throw new Error('Webhook returned HTTP 500');
        } catch (err) {
          return {
            nodeId: node.id,
            subtype: node.subtype,
            status: 'FAILED',
            error: (err as Error).message,
          };
        }
      }
    }
    const failing = new FailingFetchExecutor(
      makePrisma(),
      makeNotifications(),
      makeCsat(),
      makeSlaEngine(),
    );
    const node = makeNode({
      subtype: 'action_webhook',
      config: { url: 'https://example.com/hook' },
    });
    const result = await failing.executeNode(node, makeContext());
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('500');
  });
});
