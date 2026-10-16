import { NotFoundException } from '@nestjs/common';
import { Priority, ServiceOrderType } from '@prisma/client';
import { ServiceCatalogService } from './service-catalog.service';

describe('ServiceCatalogService', () => {
  let svc: ServiceCatalogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      serviceCatalogItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    svc = new ServiceCatalogService(mockPrisma);
  });

  describe('list', () => {
    it('retorna itens existentes do catálogo', async () => {
      const items = [
        {
          id: 'item-1',
          tenantId: 'tenant-1',
          name: 'Servidor DNS Recursivo',
          category: ServiceOrderType.DNS,
          active: true,
        },
      ];
      mockPrisma.serviceCatalogItem.findMany.mockResolvedValueOnce(items);

      const result = await svc.list('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('DNS');
    });

    it('faz seed automático caso a lista esteja vazia', async () => {
      mockPrisma.serviceCatalogItem.findMany
        .mockResolvedValueOnce([]) // primeira chamada vazia
        .mockResolvedValueOnce([{ id: 'seed-1', name: 'DNS Recursivo' }]); // chamada após seed
      mockPrisma.serviceCatalogItem.create.mockResolvedValue({});

      const result = await svc.list('tenant-1');
      expect(mockPrisma.serviceCatalogItem.create).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('cria novo serviço especializado', async () => {
      const input = {
        name: 'Cluster Proxmox VE',
        category: ServiceOrderType.PROXMOX,
        description: 'Cluster HA com ZFS',
        estimatedMinutes: 240,
        defaultPriority: Priority.ALTA,
        checklist: ['Checagem de CPU', 'Configuração de ZFS'],
      };

      mockPrisma.serviceCatalogItem.create.mockResolvedValue({ id: 'prox-1', ...input });

      const result = await svc.create('tenant-1', input);
      expect(result.id).toBe('prox-1');
      expect(mockPrisma.serviceCatalogItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Cluster Proxmox VE',
          category: 'PROXMOX',
        }),
      });
    });
  });

  describe('getById', () => {
    it('lanca NotFoundException quando id nao existe', async () => {
      mockPrisma.serviceCatalogItem.findFirst.mockResolvedValue(null);
      await expect(svc.getById('tenant-1', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
