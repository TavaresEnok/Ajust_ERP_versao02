import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Priority, ServiceOrderStatus, ServiceOrderType } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    protocol: '2026100001',
    sourceSystem: 'ERP',
    type: ServiceOrderType.ROMPIMENTO,
    priority: Priority.NORMAL,
    status: ServiceOrderStatus.ABERTA,
    title: 'Test Order',
    description: 'Test description',
    requester: 'John',
    sector: 'TI',
    origin: 'Phone',
    ownerUserId: 'owner-1',
    ownerName: 'Owner',
    assigneeUserId: 'assignee-1',
    analystName: 'Analyst',
    deadlineAt: new Date(Date.now() + 86400000),
    resolvedAt: null,
    closedAt: null,
    canceledAt: null,
    reopenedCount: 0,
    tags: [],
    internalNotes: null,
    externalProtocol: null,
    occurrenceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('ServiceOrdersService — Integration (mocked Prisma)', () => {
  let service: ServiceOrdersService;
  let mockPrisma: any;
  let mockSlaEngine: any;
  let mockEvents: any;

  beforeEach(() => {
    mockPrisma = {
      serviceOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      serviceOrderOccurrence: { create: jest.fn() },
      serviceOrderApproval: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
      occurrence: { findFirst: jest.fn().mockResolvedValue({ id: 'occ-1' }), update: jest.fn() },
      userTenant: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'user-1', user: { name: 'Autor autenticado' } }]),
      },
    } as any;
    mockPrisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma));
    mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ max: null }]);

    mockSlaEngine = {
      findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 24, priority: Priority.NORMAL }),
      calculateTargetDate: jest.fn().mockReturnValue(new Date(Date.now() + 86400000)),
    } as any;

    mockEvents = {
      emitTenantEvent: jest.fn(),
    } as any;

    service = new ServiceOrdersService(mockPrisma, mockEvents, mockSlaEngine, undefined);
  });

  // ──────────────────────────────────────────────────────────────
  // transition
  // ──────────────────────────────────────────────────────────────

  describe('analyst personal listing', () => {
    it.each(['active', 'completed'] as const)(
      'combines %s work with personal scope, provider and pagination',
      async (situation) => {
        mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
        await service.list(
          'tenant-1',
          { situation, responsibleUserId: 'analyst-1', provider: 'MEGANET', limit: 8, offset: 8 },
          'analista',
        );
        expect(mockPrisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 8,
            skip: 8,
            where: expect.objectContaining({
              tenantId: 'tenant-1',
              deletedAt: null,
              AND: expect.arrayContaining([
                {
                  status:
                    situation === 'active'
                      ? { notIn: ['RESOLVIDA', 'FECHADA', 'CANCELADA'] }
                      : { in: ['RESOLVIDA', 'FECHADA'] },
                },
                { OR: [{ ownerUserId: 'analyst-1' }, { assigneeUserId: 'analyst-1' }] },
                {
                  OR: [
                    { requester: { equals: 'MEGANET', mode: 'insensitive' } },
                    { occurrence: { provider: { equals: 'MEGANET', mode: 'insensitive' } } },
                  ],
                },
              ]),
            }),
          }),
        );
      },
    );
    it('counts all matching pages without mixing analysts, and treats resolved as completed, not active or canceled', async () => {
      mockPrisma.tenant = {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'America/Fortaleza' }),
      };
      mockPrisma.serviceOrder.count.mockResolvedValue(0);
      mockPrisma.serviceOrder.groupBy = jest.fn().mockResolvedValue([]);
      const report = await service.summary(
        'tenant-1',
        { responsibleUserId: 'analyst-1', provider: 'MEGANET', deadline: 'overdue', limit: 8 },
        'analista',
      );
      const calls = mockPrisma.serviceOrder.count.mock.calls;
      expect(calls[0][0].where).toMatchObject({
        AND: [
          {
            tenantId: 'tenant-1',
            deletedAt: null,
            AND: expect.arrayContaining([
              { OR: [{ ownerUserId: 'analyst-1' }, { assigneeUserId: 'analyst-1' }] },
            ]),
          },
          { slaEligible: true, pausedAt: null },
        ],
      });
      expect(calls[0][0].take).toBeUndefined();
      expect(calls[1][0].where.AND[1].status.in).not.toContain('RESOLVIDA');
      expect(calls[2][0].where.AND[1].status.in).toEqual(['FECHADA', 'RESOLVIDA']);
      expect(report.total).toBe(0);
    });
    it('applies deadline and personal scope together before pagination', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
      mockPrisma.tenant = {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'America/Fortaleza' }),
      };
      await service.list(
        'tenant-1',
        {
          responsibleUserId: 'analyst-1',
          deadline: 'overdue',
          provider: 'MEGANET',
          limit: 8,
          offset: 8,
        },
        'analista',
      );
      const args = mockPrisma.serviceOrder.findMany.mock.calls[0][0];
      expect(args).toMatchObject({
        take: 8,
        skip: 8,
        where: {
          AND: [
            {
              tenantId: 'tenant-1',
              deletedAt: null,
              AND: expect.arrayContaining([
                { OR: [{ ownerUserId: 'analyst-1' }, { assigneeUserId: 'analyst-1' }] },
              ]),
            },
            { pausedAt: null, slaEligible: true, deadlineAt: { lt: expect.any(Date) } },
          ],
        },
      });
    });
    it('filters provider before pagination while preserving personal scope and provider search', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
      await service.list(
        'tenant-1',
        {
          responsibleUserId: 'analyst-1',
          provider: 'MEGANET',
          search: 'MEGANET',
          limit: 8,
          offset: 8,
        },
        'analista',
      );
      const args = mockPrisma.serviceOrder.findMany.mock.calls[0][0];
      expect(args.take).toBe(8);
      expect(args.skip).toBe(8);
      expect(args.where.tenantId).toBe('tenant-1');
      expect(args.where.AND).toEqual([
        { OR: [{ ownerUserId: 'analyst-1' }, { assigneeUserId: 'analyst-1' }] },
        {
          OR: [
            { requester: { equals: 'MEGANET', mode: 'insensitive' } },
            { occurrence: { provider: { equals: 'MEGANET', mode: 'insensitive' } } },
          ],
        },
      ]);
      expect(args.where.OR).toEqual(
        expect.arrayContaining([
          { requester: { contains: 'MEGANET', mode: 'insensitive' } },
          { occurrence: { provider: { contains: 'MEGANET', mode: 'insensitive' } } },
        ]),
      );
    });
    it('restricts owner/executor before pagination and preserves tenant and search filters', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
      await service.list(
        'tenant-1',
        {
          responsibleUserId: 'analyst-1',
          search: 'DNS',
          limit: 8,
          offset: 8,
        },
        'analista',
      );
      expect(mockPrisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            deletedAt: null,
            AND: [{ OR: [{ ownerUserId: 'analyst-1' }, { assigneeUserId: 'analyst-1' }] }],
            OR: expect.arrayContaining([{ title: { contains: 'DNS', mode: 'insensitive' } }]),
          }),
          take: 8,
          skip: 8,
        }),
      );
    });

    it('preserves the existing operation-wide listing when no personal filter is supplied', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
      await service.list('tenant-1', {}, 'analista');
      const { where } = mockPrisma.serviceOrder.findMany.mock.calls[0][0];
      expect(where).toEqual({ tenantId: 'tenant-1', deletedAt: null });
    });

    it('does not remove customer visibility restrictions when combined with personal scope', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([]);
      await service.list('tenant-1', { responsibleUserId: 'customer-1' }, 'cliente');
      expect(mockPrisma.serviceOrder.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: 'tenant-1',
        deletedAt: null,
        isCustomerVisible: true,
        AND: [{ OR: [{ ownerUserId: 'customer-1' }, { assigneeUserId: 'customer-1' }] }],
      });
    });
  });

  describe('transition', () => {
    it('ABERTA → EM_ANALISE deve criar ServiceOrderOccurrence e ServiceOrderStatusEvent', async () => {
      const order = makeOrder({ status: ServiceOrderStatus.ABERTA });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...order,
        status: ServiceOrderStatus.EM_ANALISE,
      });

      await service.transition('tenant-1', 'order-1', 'user-1', 'super_admin', {
        toStatus: ServiceOrderStatus.EM_ANALISE,
        reason: 'Inicio da analise',
      });

      expect(mockPrisma.serviceOrder.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.occurrences.create).toBeDefined();
      expect(updateCall.data.occurrences.create.actorUserId).toBe('user-1');
      expect(updateCall.data.occurrences.create.sourceSystem).toBe('ERP');
      expect(updateCall.data.occurrences.create.message).toContain(
        'Etapa alterada de Aberta para Em análise',
      );
      expect(updateCall.data.serviceOrderStatusEvents.create).toBeDefined();
      expect(updateCall.data.serviceOrderStatusEvents.create.tenantId).toBe('tenant-1');
      expect(updateCall.data.serviceOrderStatusEvents.create.fromStatus).toBe(
        ServiceOrderStatus.ABERTA,
      );
      expect(updateCall.data.serviceOrderStatusEvents.create.toStatus).toBe(
        ServiceOrderStatus.EM_ANALISE,
      );
      expect(updateCall.data.serviceOrderStatusEvents.create.actorUserId).toBe('user-1');
      expect(updateCall.data.serviceOrderStatusEvents.create.reason).toBe('Inicio da analise');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            actorUserId: 'user-1',
            action: 'OS_UPDATE',
            resourceType: 'service_order',
            resourceId: 'order-1',
          }),
        }),
      );

      expect(mockEvents.emitTenantEvent).toHaveBeenCalledWith(
        'tenant-1',
        'service_order.transitioned',
        expect.any(Object),
      );
    });

    it('ABERTA → FECHADA deve falhar (transicao nao permitida)', async () => {
      const order = makeOrder({ status: ServiceOrderStatus.ABERTA });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);

      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'super_admin', {
          toStatus: ServiceOrderStatus.FECHADA,
          reason: 'Tentativa invalida',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('preserva aprovação explicitamente exigida em uma ordem legada', async () => {
      const pastDeadline = new Date(Date.now() - 3600000);
      const order = makeOrder({
        status: ServiceOrderStatus.RESOLVIDA,
        priority: Priority.CRITICA,
        deadlineAt: pastDeadline,
        requiresApproval: true,
      });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrderApproval.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'super_admin', {
          toStatus: ServiceOrderStatus.FECHADA,
          reason: 'Tentativa sem aprovacao',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.serviceOrderApproval.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          serviceOrderId: 'order-1',
          status: { in: ['APPROVED', 'REJECTED'] },
        }),
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('permite ao analista concluir ordem crítica atrasada sem aprovação de rotina', async () => {
      const order = makeOrder({
        status: ServiceOrderStatus.RESOLVIDA,
        priority: Priority.CRITICA,
        deadlineAt: new Date(Date.now() - 3600000),
        requiresApproval: false,
      });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...order,
        status: ServiceOrderStatus.FECHADA,
      });
      const result = await service.transition('tenant-1', 'order-1', 'user-1', 'analista', {
        toStatus: ServiceOrderStatus.FECHADA,
        reason: 'Solução validada e registrada',
      });
      expect(result.status).toBe(ServiceOrderStatus.FECHADA);
      expect(mockPrisma.serviceOrderApproval.findFirst).not.toHaveBeenCalled();
    });

    it('FECHADA → EM_ANALISE deve reabrir e incrementar reopenedCount', async () => {
      const order = makeOrder({
        status: ServiceOrderStatus.FECHADA,
        reopenedCount: 0,
      });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...order,
        status: ServiceOrderStatus.EM_ANALISE,
        reopenedCount: 1,
      });

      await service.transition('tenant-1', 'order-1', 'user-1', 'super_admin', {
        toStatus: ServiceOrderStatus.EM_ANALISE,
        reason: 'Reabertura de OS',
      });

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.reopenedCount).toEqual({ increment: 1 });
      // Reabrir limpa as datas de conclusão (C-014).
      expect(updateCall.data.closedAt).toBeNull();
      expect(updateCall.data.resolvedAt).toBeNull();
      expect(updateCall.data.status).toBe(ServiceOrderStatus.EM_ANALISE);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OS_REOPEN',
          }),
        }),
      );
    });

    it('status origem e destino iguais → BadRequestException', async () => {
      const order = makeOrder({ status: ServiceOrderStatus.ABERTA });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);

      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'super_admin', {
          toStatus: ServiceOrderStatus.ABERTA,
          reason: 'Sem mudanca',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────────────

  describe('create', () => {
    const validInput = {
      tenantId: 'tenant-1',
      occurrenceId: 'occ-1',
      type: ServiceOrderType.ROMPIMENTO as ServiceOrderType,
      priority: Priority.NORMAL as Priority,
      title: 'Nova OS',
      description: 'Descricao da OS',
      requester: 'Cliente A',
      sector: 'TI',
      origin: 'Phone',
    };
    it('não permite criar O.S. sem uma ocorrência', async () => {
      await expect(
        service.create('user-1', 'super_admin', { ...validInput, occurrenceId: undefined }),
      ).rejects.toThrow('Novo atendimento');
      expect(mockPrisma.serviceOrder.create).not.toHaveBeenCalled();
    });

    it('deve criar uma OS com protocolo gerado', async () => {
      const year = new Date().getFullYear();
      mockPrisma.$queryRaw.mockResolvedValue([{ max: 100005 }]);
      const now = new Date();
      const deadline = new Date(now.getTime() + 86400000);
      mockSlaEngine.calculateTargetDate.mockReturnValue(deadline);
      mockPrisma.serviceOrder.create.mockResolvedValue(
        makeOrder({
          protocol: `${year}100006`,
          status: ServiceOrderStatus.ABERTA,
          ...validInput,
        }),
      );

      const result = await service.create('user-1', 'super_admin', validInput);

      expect(mockSlaEngine.findApplicablePolicy).toHaveBeenCalledWith(
        'tenant-1',
        Priority.NORMAL,
        ServiceOrderType.ROMPIMENTO,
      );
      expect(mockSlaEngine.calculateTargetDate).toHaveBeenCalledWith(
        expect.any(Date),
        24,
        'tenant-1',
      );

      expect(mockPrisma.serviceOrder.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.serviceOrder.create.mock.calls[0][0];
      expect(createCall.data.protocol).toBe(`${year}100006`);
      expect(createCall.data.tenantId).toBe('tenant-1');
      expect(createCall.data.type).toBe(ServiceOrderType.ROMPIMENTO);
      expect(createCall.data.priority).toBe(Priority.NORMAL);
      expect(createCall.data.status).toBe(ServiceOrderStatus.ABERTA);
      expect(createCall.data.occurrences.create).toBeDefined();
      expect(createCall.data.occurrences.create.actorUserId).toBe('user-1');
      expect(createCall.data.occurrences.create.message).toBe('OS criada manualmente no ERP.');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OS_CREATE',
            resourceType: 'service_order',
          }),
        }),
      );

      expect(mockEvents.emitTenantEvent).toHaveBeenCalledWith(
        'tenant-1',
        'service_order.created',
        expect.objectContaining({ orderId: 'order-1', protocol: `${year}100006` }),
      );
      expect(mockEvents.emitTenantEvent).toHaveBeenCalledWith(
        'tenant-1',
        'service_order_created',
        expect.objectContaining({ orderId: 'order-1', protocol: `${year}100006` }),
      );

      expect(result.protocol).toBe(`${year}100006`);
    });

    it('deve lancar erro se campos obrigatorios faltarem', async () => {
      mockPrisma.serviceOrder.count.mockResolvedValue(0);
      mockPrisma.serviceOrder.create.mockRejectedValue(
        new Error('Prisma validation: title is required'),
      );

      await expect(
        service.create('user-1', 'super_admin', {
          ...validInput,
          title: '' as any,
          description: '' as any,
        }),
      ).rejects.toThrow();
    });

    it('rejeita owner ou assignee que não pertence ao tenant', async () => {
      mockPrisma.userTenant.findMany.mockResolvedValueOnce([]);
      await expect(
        service.create('user-1', 'super_admin', {
          ...validInput,
          assigneeUserId: 'foreign-user',
        }),
      ).rejects.toThrow('Selecione responsáveis da equipe da Ajust.');
      expect(mockPrisma.serviceOrder.create).not.toHaveBeenCalled();
    });
  });

  describe('regras do atendimento', () => {
    const delayedCritical = () =>
      makeOrder({
        status: ServiceOrderStatus.RESOLVIDA,
        priority: Priority.CRITICA,
        deadlineAt: new Date(Date.now() - 3600000),
        requiresApproval: true,
        resolvedAt: new Date(Date.now() - 600000),
      });

    it('rejeição posterior anula a aprovação anterior', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(delayedCritical());
      mockPrisma.serviceOrderApproval.findFirst.mockResolvedValue({ status: 'REJECTED' });
      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'gerente', {
          toStatus: ServiceOrderStatus.FECHADA,
          reason: 'Fechar',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('considera somente decisões desta resolução', async () => {
      const order = delayedCritical();
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrderApproval.findFirst.mockResolvedValue({ status: 'APPROVED' });
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...order,
        status: ServiceOrderStatus.FECHADA,
      });
      await service.transition('tenant-1', 'order-1', 'user-1', 'gerente', {
        toStatus: ServiceOrderStatus.FECHADA,
        reason: 'Fechar',
      });
      expect(mockPrisma.serviceOrderApproval.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: { gte: order.resolvedAt } }),
        }),
      );
    });

    it('analista não aprova fechamento', async () => {
      await expect(
        service.approve('tenant-1', 'order-1', 'user-1', 'analista', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aprovação só é registrada com a O.S. resolvida', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(
        makeOrder({ status: ServiceOrderStatus.EM_ANALISE }),
      );
      await expect(
        service.approve('tenant-1', 'order-1', 'user-1', 'gerente', 'APPROVED'),
      ).rejects.toThrow(ConflictException);
    });

    it('não cria O.S. em ocorrência encerrada', async () => {
      mockPrisma.occurrence.findFirst.mockResolvedValue({
        id: 'occ-1',
        number: '2026260010',
        status: 'ENCERRADA',
      });
      const input = {
        tenantId: 'tenant-1',
        occurrenceId: 'occ-1',
        type: ServiceOrderType.ROMPIMENTO as ServiceOrderType,
        priority: Priority.NORMAL as Priority,
        title: 'Nova OS',
        description: 'Descricao da OS',
      };
      await expect(service.create('user-1', 'super_admin', input)).rejects.toThrow(
        'está encerrada',
      );
      expect(mockPrisma.serviceOrder.create).not.toHaveBeenCalled();
    });

    it('reabrir a O.S. reabre a ocorrência', async () => {
      const order = makeOrder({ status: ServiceOrderStatus.FECHADA, occurrenceId: 'occ-1' });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(order);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...order,
        status: ServiceOrderStatus.EM_ANALISE,
      });
      mockPrisma.serviceOrder.count.mockResolvedValue(1);
      mockPrisma.serviceProcessInstance = { count: jest.fn().mockResolvedValue(0) };
      mockPrisma.occurrence.updateMany = jest.fn();
      await service.transition('tenant-1', 'order-1', 'user-1', 'gerente', {
        toStatus: ServiceOrderStatus.EM_ANALISE,
        reason: 'Problema voltou',
      });
      expect(mockPrisma.occurrence.updateMany).toHaveBeenCalledWith({
        where: { id: 'occ-1', tenantId: 'tenant-1' },
        data: { status: 'EM_EXECUCAO', closedAt: null },
      });
    });
  });
});
