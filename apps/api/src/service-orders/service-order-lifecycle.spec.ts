import { ForbiddenException } from '@nestjs/common';
import {
  assertTransition,
  hasCurrentApproval,
  needsClosingApproval,
  statusDates,
} from './service-order-rules';
import { ServiceOrderLifecycleService } from './service-order-lifecycle.service';
import { occurrenceStatusFor } from './occurrence-sync';
import { ServiceOrdersService } from './service-orders.service';

const past = new Date(Date.now() - 3_600_000);
const future = new Date(Date.now() + 86_400_000);

describe('regras do ciclo de vida da O.S.', () => {
  it('reabrir limpa datas de conclusão e conta a reabertura (C-014)', () => {
    const resolved = {
      status: 'RESOLVIDA' as const,
      resolvedAt: past,
      closedAt: null,
      canceledAt: null,
    };
    expect(statusDates(resolved, 'EM_ANALISE')).toEqual({
      resolvedAt: null,
      closedAt: null,
      reopenedCount: { increment: 1 },
    });
    const open = { status: 'ABERTA' as const, resolvedAt: null, closedAt: null, canceledAt: null };
    expect(statusDates(open, 'EM_ANALISE')).toEqual({});
    expect(statusDates(resolved, 'FECHADA')).toMatchObject({ resolvedAt: past });
  });

  it('mensagem de transição inválida em português, com as opções', () => {
    expect(() => assertTransition('ABERTA', 'FECHADA')).toThrow(
      'Não é possível passar de Aberta para Fechada. A partir de Aberta: Em análise, Cancelada.',
    );
  });

  it('aprovação só vale para alta/crítica atrasada que exige aprovação', () => {
    expect(
      needsClosingApproval({ requiresApproval: true, priority: 'CRITICA', deadlineAt: past }),
    ).toBe(true);
    expect(
      needsClosingApproval({ requiresApproval: true, priority: 'NORMAL', deadlineAt: past }),
    ).toBe(false);
    expect(
      needsClosingApproval({ requiresApproval: true, priority: 'ALTA', deadlineAt: future }),
    ).toBe(false);
    expect(
      needsClosingApproval({ requiresApproval: false, priority: 'ALTA', deadlineAt: past }),
    ).toBe(false);
  });

  it('considera só a decisão mais recente desde a resolução', async () => {
    const db = {
      serviceOrderApproval: { findFirst: jest.fn().mockResolvedValue({ status: 'REJECTED' }) },
    };
    await expect(hasCurrentApproval(db, { id: 'o', resolvedAt: past })).resolves.toBe(false);
    expect(db.serviceOrderApproval.findFirst.mock.calls[0][0].where.createdAt).toEqual({
      gte: past,
    });
  });
});

describe('ServiceOrdersService.updateOrder — prazo (C-005/C-025)', () => {
  function setup(role: string, extra: Record<string, unknown> = {}, audit: unknown[] = []) {
    const order = {
      id: 'o1',
      protocol: '2026100001',
      version: 3,
      type: 'ROMPIMENTO',
      priority: 'NORMAL',
      status: 'EM_ANALISE',
      createdAt: past,
      deadlineAt: future,
      originalDeadlineAt: null,
      pausedAt: null,
      slaEligible: true,
      sourceMetadata: null,
      ...extra,
    } as any;
    const prisma: any = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({ ...order, version: 4 }),
      },
      userTenant: { findMany: jest.fn().mockResolvedValue([]) },
      slaAuditEvent: {
        create: jest.fn(),
        // Eventos de SLA já gravados para a O.S. (prazo gerencial, retomadas, reaberturas).
        findFirst: jest.fn(
          async ({ where }: any) => audit.find((e: any) => e.eventType === where.eventType) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) =>
          audit.filter((e: any) => where.eventType.in.includes(e.eventType)),
        ),
      },
      serviceProcessStep: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const sla: any = {
      findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 8 }),
      calculateTargetDate: jest.fn().mockResolvedValue(new Date(Date.now() + 8 * 3_600_000)),
      calculateBusinessPauseDuration: jest.fn().mockResolvedValue(90),
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    const service = new ServiceOrdersService(prisma, { emitTenantEvent: jest.fn() } as any, sla);
    const run = (patch: Record<string, unknown>) =>
      service.updateOrder('t', 'o1', 'u1', role, { expectedVersion: 3, ...patch } as any);
    return { prisma, sla, run, order };
  }
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString();

  it('analista não muda o prazo', async () => {
    const { run } = setup('analista');
    await expect(run({ deadlineAt: nextWeek, deadlineReason: 'cliente pediu' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('reenviar o mesmo prazo (formulário completo) não conta como mudança', async () => {
    const { run, prisma, order } = setup('analista');
    await run({ deadlineAt: order.deadlineAt.toISOString(), title: 'Novo título' });
    expect(prisma.slaAuditEvent.create).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.update.mock.calls[0][0].data.deadlineAt).toBeUndefined();
  });

  it('gerente precisa de motivo e de data futura', async () => {
    const { run } = setup('gerente');
    await expect(run({ deadlineAt: nextWeek })).rejects.toThrow('motivo');
    await expect(
      run({ deadlineAt: new Date(Date.now() - 86_400_000).toISOString(), deadlineReason: 'erro' }),
    ).rejects.toThrow('futuro');
  });

  it('gerente com motivo grava auditoria de SLA e guarda o prazo original', async () => {
    const { run, prisma, order } = setup('gerente');
    await run({ deadlineAt: nextWeek, deadlineReason: 'Janela de manutenção do provedor' });
    const data = prisma.serviceOrder.update.mock.calls[0][0].data;
    expect(data.originalDeadlineAt).toEqual(order.deadlineAt);
    expect(prisma.slaAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'DEADLINE_CHANGED',
        reason: 'Janela de manutenção do provedor',
      }),
    });
  });

  it('corrigir o tipo recalcula o prazo a partir da abertura', async () => {
    const { run, prisma, sla, order } = setup('analista');
    await run({ type: 'DNS' });
    expect(sla.findApplicablePolicy).toHaveBeenCalledWith('t', 'NORMAL', 'DNS');
    expect(sla.calculateTargetDate).toHaveBeenCalledWith(order.createdAt, 8, 't');
    expect(prisma.slaAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'RECALCULATED' }),
    });
  });

  it('prazo próprio do serviço do catálogo não é recalculado pela política', async () => {
    const { run, prisma, sla } = setup('analista', {
      sourceMetadata: { slaSource: 'catalog', slaHours: 8 },
    });
    await run({ priority: 'ALTA' });
    expect(sla.calculateTargetDate).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.update.mock.calls[0][0].data.deadlineAt).toBeUndefined();
    expect(prisma.slaAuditEvent.create).not.toHaveBeenCalled();
  });

  it('prazo definido pela gestão não é sobrescrito ao mudar a prioridade', async () => {
    const { run, prisma, sla } = setup('analista', {}, [{ eventType: 'DEADLINE_CHANGED' }]);
    await run({ priority: 'BAIXA' });
    expect(sla.calculateTargetDate).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.update.mock.calls[0][0].data.deadlineAt).toBeUndefined();
  });

  it('recalcular devolve o tempo útil já parado em pausas e reaberturas', async () => {
    const { run, sla, order } = setup('analista', {}, [
      { eventType: 'RESUMED', metadata: { pausedBusinessMinutes: 120 }, createdAt: past },
      { eventType: 'REOPENED', metadata: { pausedBusinessMinutes: 60 }, createdAt: past },
      // Retomada antiga: só guarda o início da pausa; a duração útil é recalculada (90 min).
      { eventType: 'RESUMED', metadata: { pausedAt: past.toISOString() }, createdAt: past },
    ]);
    await run({ type: 'DNS' });
    expect(sla.calculateTargetDate).toHaveBeenCalledWith(order.createdAt, 8 + 270 / 60, 't');
  });

  it('recalcula também com a O.S. pausada e sincroniza o prazo da etapa do fluxo', async () => {
    const { run, prisma, sla } = setup('analista', { pausedAt: past });
    await run({ priority: 'CRITICA' });
    expect(sla.findApplicablePolicy).toHaveBeenCalledWith('t', 'CRITICA', 'ROMPIMENTO');
    const deadlineAt = prisma.serviceOrder.update.mock.calls[0][0].data.deadlineAt;
    expect(deadlineAt).toBeInstanceOf(Date);
    expect(prisma.serviceProcessStep.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't', orderId: 'o1', status: 'ACTIVE' },
      data: { dueAt: deadlineAt },
    });
  });
});

describe('ServiceOrderLifecycleService', () => {
  it('fechar dispara auditoria, CSAT, workflow e sincroniza a ocorrência', async () => {
    const order = {
      id: 'o1',
      tenantId: 't',
      protocol: 'P',
      occurrenceId: 'occ',
      processInstanceId: null,
      status: 'FECHADA',
    };
    const prisma: any = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceProcessInstance: { count: jest.fn().mockResolvedValue(0) },
      occurrence: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    const csat = { createForOrder: jest.fn() };
    const workflows = { executeForEvent: jest.fn().mockResolvedValue([]) };
    const legacyTemplates = { executeForOrder: jest.fn() };
    const lifecycle = new ServiceOrderLifecycleService(
      prisma,
      { emitTenantEvent: jest.fn() } as any,
      csat as any,
      undefined,
      legacyTemplates as any,
      workflows as any,
    );
    await lifecycle.afterStatusChange({
      tenantId: 't',
      orderId: 'o1',
      from: 'RESOLVIDA',
      to: 'FECHADA',
      actorId: 'u1',
      source: 'operations',
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('OS_CLOSE');
    expect(csat.createForOrder).toHaveBeenCalledWith('t', 'o1', false);
    expect(legacyTemplates.executeForOrder).not.toHaveBeenCalled();
    expect(workflows.executeForEvent).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ type: 'order_closed' }),
      { eventKey: undefined, throwOnFailure: false },
    );
    expect(prisma.occurrence.updateMany).toHaveBeenCalledWith({
      where: { id: 'occ', tenantId: 't' },
      data: { status: 'ENCERRADA', closedAt: expect.any(Date) },
    });
  });

  it('resolver não manda pesquisa (só o fechamento efetivo)', async () => {
    const prisma: any = {
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'o1', occurrenceId: null }) },
      auditLog: { create: jest.fn() },
    };
    const csat = { createForOrder: jest.fn() };
    await new ServiceOrderLifecycleService(
      prisma,
      { emitTenantEvent: jest.fn() } as any,
      csat as any,
    ).afterStatusChange({
      tenantId: 't',
      orderId: 'o1',
      from: 'EM_ANALISE',
      to: 'RESOLVIDA',
      actorId: 'u1',
      source: 'transition',
    });
    expect(csat.createForOrder).not.toHaveBeenCalled();
  });
});

describe('OrderOperationsService.finish (C-013/C-039)', () => {
  async function finish(order: Record<string, unknown>, approval: unknown = null) {
    const { OrderOperationsService } = await import('./order-operations.service');
    const tx: any = {
      serviceOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      serviceOrderOccurrence: { create: jest.fn() },
      serviceOrderStatusEvent: { create: jest.fn() },
      changeRequest: { updateMany: jest.fn() },
    };
    const prisma: any = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        findUnique: jest.fn().mockResolvedValue({ status: 'RESOLVIDA' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        count: jest.fn().mockResolvedValue(1),
      },
      serviceOrderApproval: { findFirst: jest.fn().mockResolvedValue(approval) },
      serviceProcessInstance: { count: jest.fn().mockResolvedValue(0) },
      occurrence: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    const lifecycle = { afterStatusChange: jest.fn() };
    const service = new OrderOperationsService(prisma, {} as any, {} as any, lifecycle as any);
    await service.run('t', 'u1', 'analista', 'o1', {
      action: 'finish',
      expectedVersion: 2,
      reason: 'Link normalizado',
    });
    return { tx, lifecycle };
  }
  const base = {
    id: 'o1',
    tenantId: 't',
    version: 2,
    status: 'EM_ANALISE',
    priority: 'CRITICA',
    requiresApproval: true,
    deadlineAt: past,
    resolvedAt: null,
    closedAt: null,
    canceledAt: null,
    pausedAt: null,
    processInstanceId: null,
    occurrenceId: null,
    changeRequestId: null,
  };

  it('crítica atrasada sem aprovação fica resolvida aguardando a gestão', async () => {
    const { tx, lifecycle } = await finish(base);
    expect(tx.serviceOrder.updateMany.mock.calls[0][0].data.status).toBe('RESOLVIDA');
    expect(tx.serviceOrderOccurrence.create.mock.calls[0][0].data.message).toContain(
      'aguardando aprovação gerencial',
    );
    expect(lifecycle.afterStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'EM_ANALISE', to: 'RESOLVIDA', source: 'operations' }),
    );
  });

  it('sem exigência de aprovação fecha e dispara os efeitos', async () => {
    const { tx } = await finish({ ...base, requiresApproval: false });
    expect(tx.serviceOrder.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'FECHADA',
      closedAt: expect.any(Date),
    });
  });
});

describe('abertura principal dispara workflow order_created (C-010)', () => {
  it('createOccurrenceWithFirstOrder chama afterOrderCreated', async () => {
    const created = { id: 'o1', tenantId: 't', protocol: 'P', occurrenceId: 'occ' };
    const tx: any = {
      occurrence: { create: jest.fn().mockResolvedValue({ id: 'occ', number: 'N' }) },
      serviceOrder: { create: jest.fn().mockResolvedValue(created) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ max: null }]),
    };
    const prisma: any = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ tradeName: 'Prov', legalName: 'Prov' }),
      },
      userTenant: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'u1', user: { name: 'Autor autenticado' } }]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ max: null }]),
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      auditLog: { create: jest.fn() },
      occurrence: { findFirst: jest.fn().mockResolvedValue({ id: 'occ', serviceOrders: [] }) },
    };
    const sla: any = {
      findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 8 }),
      calculateTargetDate: jest.fn().mockResolvedValue(future),
    };
    const lifecycle = { afterOrderCreated: jest.fn(), afterStatusChange: jest.fn() };
    const service = new ServiceOrdersService(
      prisma,
      { emitTenantEvent: jest.fn() } as any,
      sla,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      lifecycle as any,
    );
    await service.createOccurrenceWithFirstOrder('u1', 'analista', {
      tenantId: 't',
      customerId: 'c1',
      provider: 'Prov',
      type: 'ROMPIMENTO',
      sector: 'NOC',
      origin: 'Telefone',
      openedByName: 'Equipe',
      analystResponsible: 'Equipe',
      description: 'Sem link',
      firstOrder: { type: 'ROMPIMENTO', description: 'Sem link' },
    } as any);
    expect(lifecycle.afterOrderCreated).toHaveBeenCalledWith(created, 'u1', expect.any(Object));
  });

  it('data retroativa é só da gestão', async () => {
    const service = new ServiceOrdersService(
      {
        customer: { findFirst: jest.fn().mockResolvedValue({ tradeName: 'P' }) },
        userTenant: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ userId: 'u1', user: { name: 'Autor autenticado' } }]),
        },
      } as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.createOccurrenceWithFirstOrder('u1', 'analista', {
        tenantId: 't',
        customerId: 'c1',
        createdAt: past.toISOString(),
        firstOrder: { type: 'ROMPIMENTO', description: 'x' },
      } as any),
    ).rejects.toThrow('Só a gestão registra atendimento com data retroativa.');
  });
});

describe('Aguardando terceiros pausa o SLA (C-030)', () => {
  function setup(order: Record<string, unknown>) {
    const prisma: any = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({ ...order, id: 'o1' }),
      },
      slaAuditEvent: { create: jest.fn() },
    };
    const sla: any = {
      calculateBusinessPauseDuration: jest.fn().mockResolvedValue(120),
      calculateTargetDate: jest.fn().mockResolvedValue(new Date('2030-01-01T02:00:00Z')),
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    const lifecycle = { afterStatusChange: jest.fn() };
    const service = new ServiceOrdersService(
      prisma,
      {} as any,
      sla,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      lifecycle as any,
    );
    return { prisma, sla, service };
  }
  const base = {
    id: 'o1',
    tenantId: 't',
    version: 1,
    processInstanceId: null,
    priority: 'NORMAL',
    requiresApproval: false,
    slaEligible: true,
    deadlineAt: new Date('2030-01-01T00:00:00Z'),
    originalDeadlineAt: null,
    resolvedAt: null,
    closedAt: null,
    canceledAt: null,
  };

  it('ao entrar, pausa e registra auditoria', async () => {
    const { prisma, service } = setup({ ...base, status: 'EM_ANALISE', pausedAt: null });
    await service.transition('t', 'o1', 'u1', 'analista', {
      toStatus: 'AG_TERCEIROS' as never,
      reason: 'Operadora de trânsito',
      expectedVersion: 1,
    });
    const data = prisma.serviceOrder.update.mock.calls[0][0].data;
    expect(data.pausedAt).toBeInstanceOf(Date);
    expect(data.pauseReason).toBe('Aguardando terceiros: Operadora de trânsito');
    expect(prisma.slaAuditEvent.create.mock.calls[0][0].data.eventType).toBe('PAUSED');
  });

  it('ao sair, retoma e estende o prazo pelo tempo útil parado', async () => {
    const { prisma, service, sla } = setup({
      ...base,
      status: 'AG_TERCEIROS',
      pausedAt: new Date('2029-12-31T20:00:00Z'),
      pauseReason: 'Aguardando terceiros: Operadora',
    });
    await service.transition('t', 'o1', 'u1', 'analista', {
      toStatus: 'EM_ANALISE' as never,
      reason: 'Operadora respondeu',
      expectedVersion: 1,
    });
    expect(sla.calculateTargetDate).toHaveBeenCalledWith(base.deadlineAt, 2, 't');
    const data = prisma.serviceOrder.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ pausedAt: null, pauseReason: null });
    expect(prisma.slaAuditEvent.create.mock.calls[0][0].data.eventType).toBe('RESUMED');
  });

  it('pausa manual anterior não é desfeita ao sair', async () => {
    const { prisma, service } = setup({
      ...base,
      status: 'AG_TERCEIROS',
      pausedAt: new Date(),
      pauseReason: 'Cliente pediu para aguardar',
    });
    await service.transition('t', 'o1', 'u1', 'analista', {
      toStatus: 'EM_ANALISE' as never,
      reason: 'x',
      expectedVersion: 1,
    });
    expect(prisma.serviceOrder.update.mock.calls[0][0].data.pausedAt).toBeUndefined();
  });

  it('não resolve nem fecha com pausa manual ativa: pede para retomar antes', async () => {
    const { prisma, service } = setup({
      ...base,
      status: 'EM_ANALISE',
      pausedAt: new Date(),
      pauseReason: 'Cliente pediu para aguardar',
    });
    await expect(
      service.transition('t', 'o1', 'u1', 'analista', {
        toStatus: 'RESOLVIDA' as never,
        reason: 'Resolvido',
        expectedVersion: 1,
      }),
    ).rejects.toThrow('Retome a O.S. antes de encerrar.');
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('reabrir estende o prazo pelo tempo útil em que ficou encerrada', async () => {
    const resolvedAt = new Date('2029-12-31T22:00:00Z');
    const { prisma, service, sla } = setup({
      ...base,
      status: 'RESOLVIDA',
      pausedAt: null,
      resolvedAt,
    });
    await service.transition('t', 'o1', 'u1', 'gerente', {
      toStatus: 'EM_ANALISE' as never,
      reason: 'Cliente relatou que voltou a falhar',
      expectedVersion: 1,
    });
    expect(sla.calculateBusinessPauseDuration.mock.calls[0].slice(0, 1)).toEqual([resolvedAt]);
    expect(sla.calculateTargetDate).toHaveBeenCalledWith(base.deadlineAt, 2, 't');
    const data = prisma.serviceOrder.update.mock.calls[0][0].data;
    expect(data.deadlineAt).toEqual(new Date('2030-01-01T02:00:00Z'));
    expect(data.originalDeadlineAt).toEqual(base.deadlineAt);
    expect(prisma.slaAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      eventType: 'REOPENED',
      metadata: expect.objectContaining({ pausedBusinessMinutes: 120 }),
    });
  });

  it('O.S. com fluxo não reabre pela transição manual (a etapa precisa ser recriada)', async () => {
    const { prisma, service } = setup({
      ...base,
      status: 'FECHADA',
      pausedAt: null,
      processInstanceId: 'p1',
      closedAt: new Date(),
    });
    prisma.serviceProcessStep = { count: jest.fn().mockResolvedValue(0) };
    await expect(
      service.transition('t', 'o1', 'u1', 'gerente', {
        toStatus: 'EM_ANALISE' as never,
        reason: 'Reabrir',
        expectedVersion: 1,
      }),
    ).rejects.toThrow('Reabrir O.S.');
  });

  it('anotação de transição é interna (não aparece no portal do cliente)', async () => {
    const { prisma, service } = setup({ ...base, status: 'EM_ANALISE', pausedAt: null });
    await service.transition('t', 'o1', 'u1', 'analista', {
      toStatus: 'AG_CAMPO' as never,
      reason: 'Equipe a caminho',
      expectedVersion: 1,
    });
    expect(
      prisma.serviceOrder.update.mock.calls[0][0].data.occurrences.create.isCustomerVisible,
    ).toBe(false);
  });
});

describe('estado da ocorrência a partir das O.S. (occurrenceStatusFor)', () => {
  const o = (status: string, pausedAt: Date | null = null) => ({ status, pausedAt }) as any;
  it('encerrada sem O.S. abertas nem fluxo em andamento', () => {
    expect(occurrenceStatusFor([], 0)).toBe('ENCERRADA');
    expect(occurrenceStatusFor([], 1)).toBe('EM_EXECUCAO');
  });
  it('aberta enquanto ninguém começou', () => {
    expect(occurrenceStatusFor([o('ABERTA'), o('ABERTA')], 1)).toBe('ABERTA');
  });
  it('pendente quando tudo o que falta depende de outro', () => {
    expect(occurrenceStatusFor([o('RESOLVIDA'), o('AG_TERCEIROS')], 1)).toBe('PENDENTE');
    expect(occurrenceStatusFor([o('EM_ANALISE', past)], 1)).toBe('PENDENTE');
  });
  it('em execução com trabalho em andamento', () => {
    expect(occurrenceStatusFor([o('EM_ANALISE'), o('RESOLVIDA')], 1)).toBe('EM_EXECUCAO');
    expect(occurrenceStatusFor([o('ABERTA'), o('AG_CAMPO')], 1)).toBe('EM_EXECUCAO');
  });
});

describe('aprovação gerencial do fechamento', () => {
  it('atraso é medido na entrega: resolvida no prazo e fechada depois não exige aprovação', () => {
    const base = { requiresApproval: true, priority: 'ALTA' as const, deadlineAt: past };
    expect(needsClosingApproval({ ...base, resolvedAt: new Date(past.getTime() - 1) })).toBe(false);
    expect(needsClosingApproval({ ...base, resolvedAt: new Date() })).toBe(true);
  });

  function setup(processInstanceId: string | null, openSteps = 0) {
    const order = { id: 'o1', tenantId: 't', status: 'RESOLVIDA', processInstanceId };
    const prisma: any = {
      serviceOrder: { findFirst: jest.fn().mockResolvedValue(order) },
      serviceOrderApproval: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      serviceProcessStep: { count: jest.fn().mockResolvedValue(openSteps) },
      auditLog: { create: jest.fn() },
    };
    const service = new ServiceOrdersService(
      prisma,
      { emitTenantEvent: jest.fn() } as any,
      {} as any,
    );
    const transition = jest.spyOn(service, 'transition').mockResolvedValue({} as never);
    return { service, transition, prisma };
  }

  it('aprovar fecha a O.S. na hora', async () => {
    const { service, transition } = setup(null);
    await service.approve('t', 'o1', 'g1', 'gerente', 'APPROVED' as never, 'Ok');
    expect(transition).toHaveBeenCalledWith('t', 'o1', 'g1', 'gerente', {
      toStatus: 'FECHADA',
      reason: 'Ok',
    });
  });

  it('com entregas paralelas abertas, a O.S. fecha sozinha depois (não fecha agora)', async () => {
    const { service, transition } = setup('p1', 2);
    await service.approve('t', 'o1', 'g1', 'gerente', 'APPROVED' as never);
    expect(transition).not.toHaveBeenCalled();
  });

  it('recusar mantém a O.S. resolvida', async () => {
    const { service, transition } = setup(null);
    await service.approve('t', 'o1', 'g1', 'gerente', 'REJECTED' as never, 'Faltou evidência');
    expect(transition).not.toHaveBeenCalled();
  });

  it('retoma fechamento sem duplicar aprovação quando aprovação anterior já foi gravada', async () => {
    const { service, transition, prisma } = setup(null);
    prisma.serviceOrderApproval.findFirst.mockResolvedValueOnce({
      id: 'a-prev',
      status: 'APPROVED',
    });
    const approval = await service.approve('t', 'o1', 'g1', 'gerente', 'APPROVED' as never, 'Ok');
    expect(approval).toEqual({ id: 'a-prev', status: 'APPROVED' });
    expect(prisma.serviceOrderApproval.create).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith('t', 'o1', 'g1', 'gerente', {
      toStatus: 'FECHADA',
      reason: 'Ok',
    });
  });
});
