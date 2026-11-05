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

describe('Attachment upload validation and storage', () => {
  const { mkdtempSync, rmSync, existsSync: fileExists } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  let folder: string;
  let previousRoot: string | undefined;
  let prisma: any;
  let service: ServiceOrdersService;
  beforeEach(() => {
    jest.restoreAllMocks();
    folder = mkdtempSync(join(tmpdir(), 'ajust-upload-'));
    previousRoot = process.env.UPLOAD_ROOT;
    process.env.UPLOAD_ROOT = folder;
    prisma = {
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', protocol: 'OS-1' }) },
      serviceOrderAttachment: {
        count: jest.fn().mockResolvedValue(10),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'attachment', ...data })),
      },
      serviceOrderOccurrence: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((run) => run(prisma)),
    };
    service = new ServiceOrdersService(
      prisma,
      { emitTenantEvent: jest.fn() } as never,
      {} as never,
    );
  });
  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previousRoot;
  });
  const file = (name: string, body: string) =>
    ({
      originalname: name,
      buffer: Buffer.from(body),
      size: body.length,
      mimetype: 'application/octet-stream',
    }) as Express.Multer.File;
  it('allows another batch after ten files, stores relative paths and explicit visibility', async () => {
    const [saved] = await service.uploadAttachments(
      'tenant',
      'order',
      'user',
      'analista',
      [file('note.txt', 'Nota técnica')],
      false,
    );
    expect(saved).toMatchObject({
      mimeType: 'text/plain',
      isInternal: false,
      sizeBytes: Buffer.byteLength('Nota técnica'),
    });
    expect(saved.storageKey).toMatch(/^service-orders\/order\//);
    expect(fileExists(join(folder, saved.storageKey))).toBe(true);
  });
  it('rejects forged content and the total quota before writing', async () => {
    await expect(
      service.uploadAttachments('tenant', 'order', 'user', 'analista', [
        file('fake.png', '<html>'),
      ]),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.serviceOrderAttachment.create).not.toHaveBeenCalled();
    prisma.serviceOrderAttachment.count.mockResolvedValue(100);
    await expect(
      service.uploadAttachments('tenant', 'order', 'user', 'analista', [file('note.txt', 'note')]),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.serviceOrderAttachment.create).not.toHaveBeenCalled();
  });
});
