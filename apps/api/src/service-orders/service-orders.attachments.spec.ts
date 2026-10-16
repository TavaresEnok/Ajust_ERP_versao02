import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService - Attachment Security (SEC-01 & SEC-02)', () => {
  let service: ServiceOrdersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      serviceOrder: {
        findFirst: jest.fn(),
      },
      serviceOrderAttachment: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const mockEventsGateway = {
      emitTenantEvent: jest.fn(),
    } as any;

    service = new ServiceOrdersService(
      mockPrisma,
      mockEventsGateway,
      {} as any, // CsatService
      {} as any, // WorkflowsService
      {} as any, // SlaEngineService
      {} as any, // OsProcessTemplateService
    );
  });

  it('permite download de anexo válido pertencente ao tenant do usuário', async () => {
    mockPrisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: 'order-1',
      tenantId: 'tenant-1',
      isCustomerVisible: true,
    });

    mockPrisma.serviceOrderAttachment.findFirst.mockResolvedValueOnce({
      id: 'att-1',
      serviceOrderId: 'order-1',
      fileName: 'evidencia_bgp.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      storageKey: 'service-orders/order-1/evidencia_bgp.pdf',
      isInternal: false,
    });

    // Mock existsSync
    jest.spyOn(require('node:fs'), 'existsSync').mockReturnValueOnce(true);

    const result = await service.downloadAttachment(
      'tenant-1',
      'order-1',
      'att-1',
      'user-1',
      'analista',
    );

    expect(result.fileName).toBe('evidencia_bgp.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(1024);
  });

  it('rejeita download se a ordem pertencer a outro tenant (SEC-01: Isolamento Multi-Tenant)', async () => {
    // Ordem não encontrada para tenant-2
    mockPrisma.serviceOrder.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.downloadAttachment('tenant-2', 'order-1', 'att-1', 'user-2', 'analista'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejeita download se cliente tentar acessar anexo interno (SEC-02)', async () => {
    mockPrisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: 'order-1',
      tenantId: 'tenant-1',
      isCustomerVisible: true,
    });

    mockPrisma.serviceOrderAttachment.findFirst.mockResolvedValueOnce({
      id: 'att-internal',
      serviceOrderId: 'order-1',
      fileName: 'credenciais_mikrotik.txt',
      mimeType: 'text/plain',
      sizeBytes: 256,
      storageKey: 'service-orders/order-1/credenciais_mikrotik.txt',
      isInternal: true,
    });

    await expect(
      service.downloadAttachment('tenant-1', 'order-1', 'att-internal', 'user-cliente', 'cliente'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita tentativa de Path Traversal no storageKey (SEC-02)', async () => {
    mockPrisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: 'order-1',
      tenantId: 'tenant-1',
      isCustomerVisible: true,
    });

    mockPrisma.serviceOrderAttachment.findFirst.mockResolvedValueOnce({
      id: 'att-malicious',
      serviceOrderId: 'order-1',
      fileName: 'passwd',
      mimeType: 'text/plain',
      sizeBytes: 512,
      storageKey: '../../../../../../etc/passwd',
      isInternal: false,
    });

    await expect(
      service.downloadAttachment('tenant-1', 'order-1', 'att-malicious', 'user-1', 'analista'),
    ).rejects.toThrow(ForbiddenException);
  });
});
