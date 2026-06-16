import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      occurrence: { findFirst: jest.fn() },
      userTenant: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

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
        `Status alterado de ABERTA para EM_ANALISE`,
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

    it('RESOLVIDA → FECHADA com ordem CRITICA atrasada deve falhar sem aprovacao', async () => {
      const pastDeadline = new Date(Date.now() - 3600000);
      const order = makeOrder({
        status: ServiceOrderStatus.RESOLVIDA,
        priority: Priority.CRITICA,
        deadlineAt: pastDeadline,
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
        where: {
          serviceOrderId: 'order-1',
          status: 'APPROVED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
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
      expect(updateCall.data.reopenedCount).toBe(1);
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
      type: ServiceOrderType.ROMPIMENTO as ServiceOrderType,
      priority: Priority.NORMAL as Priority,
      title: 'Nova OS',
      description: 'Descricao da OS',
      requester: 'Cliente A',
      sector: 'TI',
      origin: 'Phone',
    };

    it('deve criar uma OS com protocolo gerado', async () => {
      mockPrisma.serviceOrder.count.mockResolvedValue(5);
      const now = new Date();
      const deadline = new Date(now.getTime() + 86400000);
      mockSlaEngine.calculateTargetDate.mockReturnValue(deadline);
      mockPrisma.serviceOrder.create.mockResolvedValue(
        makeOrder({
          protocol: '2026100006',
          status: ServiceOrderStatus.ABERTA,
          ...validInput,
        }),
      );

      const result = await service.create('user-1', 'super_admin', validInput);

      expect(mockPrisma.serviceOrder.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });

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
      expect(createCall.data.protocol).toBe('2026100006');
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
        expect.objectContaining({ orderId: 'order-1', protocol: '2026100006' }),
      );
      expect(mockEvents.emitTenantEvent).toHaveBeenCalledWith(
        'tenant-1',
        'service_order_created',
        expect.objectContaining({ orderId: 'order-1', protocol: '2026100006' }),
      );

      expect(result.protocol).toBe('2026100006');
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
      ).rejects.toThrow('must belong');
      expect(mockPrisma.serviceOrder.create).not.toHaveBeenCalled();
    });
  });
});
