import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService - Optimistic Concurrency Control (OS-01 & SEC-01)', () => {
  let service: ServiceOrdersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      serviceOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const mockEventsGateway: any = {
      emitTenantEvent: jest.fn(),
    };

    service = new ServiceOrdersService(
      mockPrisma,
      mockEventsGateway,
      null as any, // csatService
      null as any, // workflowsService
      null as any, // slaEngine
      null as any, // osProcessTemplateService
    );
  });

  describe('updateOrder with Optimistic Concurrency', () => {
    it('succeeds and increments version when expectedVersion matches current version', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        protocol: 'OS-2026-100',
        version: 3,
      });

      mockPrisma.serviceOrder.update.mockResolvedValue({
        id: 'order-1',
        protocol: 'OS-2026-100',
        title: 'Novo Título',
        version: 4,
        occurrences: [],
        attachments: [],
      });

      const result = await service.updateOrder(
        'tenant-1',
        'order-1',
        'user-1',
        'analista',
        {
          title: 'Novo Título',
          expectedVersion: 3,
        },
      );

      expect(result.version).toBe(4);
      expect(mockPrisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', version: 3 },
          data: expect.objectContaining({
            title: 'Novo Título',
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('rejects with ConflictException (409) when expectedVersion does not match current version', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        protocol: 'OS-2026-100',
        version: 5, // Order was already updated to v5
      });

      await expect(
        service.updateOrder('tenant-1', 'order-1', 'user-1', 'analista', {
          title: 'Alteração Concorrente',
          expectedVersion: 4, // Client has stale v4
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('catches Prisma P2025 (atomic race condition) and throws ConflictException', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        protocol: 'OS-2026-100',
        version: 2,
      });

      // Simulate concurrent update committing exactly between findFirst and update
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        {
          code: 'P2025',
          clientVersion: '6.19.2',
        },
      );
      mockPrisma.serviceOrder.update.mockRejectedValue(p2025Error);

      await expect(
        service.updateOrder('tenant-1', 'order-1', 'user-1', 'analista', {
          title: 'Edição Simultânea',
          expectedVersion: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transition with Optimistic Concurrency', () => {
    it('succeeds and increments version when transitioning with matching expectedVersion', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'ABERTA',
        priority: 'NORMAL',
        version: 1,
        reopenedCount: 0,
        resolvedAt: null,
        closedAt: null,
        canceledAt: null,
      });

      mockPrisma.serviceOrder.update.mockResolvedValue({
        id: 'order-1',
        status: 'EM_ANALISE',
        version: 2,
        occurrences: [],
      });

      const result = await service.transition('tenant-1', 'order-1', 'user-1', 'analista', {
        toStatus: 'EM_ANALISE',
        reason: 'Iniciando análise técnica',
        expectedVersion: 1,
      });

      expect(result.version).toBe(2);
      expect(mockPrisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', version: 1 },
          data: expect.objectContaining({
            status: 'EM_ANALISE',
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('rejects status transition with ConflictException when expectedVersion is stale', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'ABERTA',
        priority: 'NORMAL',
        version: 3, // Already v3
      });

      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'analista', {
          toStatus: 'EM_ANALISE',
          reason: 'Tentativa concorrente',
          expectedVersion: 2, // Stale v2
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('catches Prisma P2025 during transition and throws ConflictException', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'ABERTA',
        priority: 'NORMAL',
        version: 1,
      });

      const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.2',
      });
      mockPrisma.serviceOrder.update.mockRejectedValue(p2025Error);

      await expect(
        service.transition('tenant-1', 'order-1', 'user-1', 'analista', {
          toStatus: 'EM_ANALISE',
          reason: 'Corrida de transição',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
