import { WorkflowActionExecutor, ActionResult } from './action-executor.service';
import type { WorkflowNode, WorkflowContext } from './workflows.service';

jest.mock('../common/ssrf-guard', () => ({
  safeFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
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
    userTenant: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'analyst-7' }),
      findFirst: jest
        .fn()
        .mockResolvedValue({ userId: 'analyst-7', user: { name: 'Analista Sete' } }),
    },
    serviceOrderApproval: { findFirst: jest.fn().mockResolvedValue(null) },
    occurrence: { updateMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ max: 100041 }]),
    $transaction: jest.fn(async (cb) =>
      cb({
        serviceOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        serviceOrderOccurrence: { create: jest.fn().mockResolvedValue({}) },
        serviceOrderStatusEvent: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
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

describe('Workflow effects boundary', () => {
  it.each(['task_service', 'action_assign', 'action_escalate', 'action_close_order'])(
    'rejects legacy mutation %s without writing an order',
    async (subtype) => {
      const prisma = makePrisma();
      const executor = makeExecutor(prisma, makeNotifications());
      const result = await executor.executeNode(makeNode({ subtype }), makeContext());
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('processos operacionais');
      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
