import { ServiceOrdersService } from './service-orders.service';

// Prazo da O.S.: o SLA do serviço do catálogo vence a política; sem ele, vale a política.
describe('prazo pelo serviço do catálogo', () => {
  const slaEngine = {
    findApplicablePolicy: jest.fn().mockResolvedValue({ id: 'p', hours: 48 }),
  };
  const prisma = { serviceCatalogItem: { findFirst: jest.fn() } };
  const service = new ServiceOrdersService(prisma as never, {} as never, slaEngine as never);
  const slaHoursFor = (catalogId?: string) =>
    (service as unknown as { slaHoursFor: (...a: unknown[]) => Promise<unknown> }).slaHoursFor(
      't1',
      'NORMAL',
      'INFRAESTRUTURA',
      catalogId,
    );

  it('usa as horas do serviço quando ele tem SLA', async () => {
    prisma.serviceCatalogItem.findFirst.mockResolvedValueOnce({ slaHours: 72 });
    await expect(slaHoursFor('c1')).resolves.toEqual({
      hours: 72,
      source: 'catalog',
      confirmed: true,
    });
    expect(prisma.serviceCatalogItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', tenantId: 't1' } }),
    );
  });

  it('serviço sem SLA ou O.S. sem serviço usa a política', async () => {
    prisma.serviceCatalogItem.findFirst.mockResolvedValueOnce({ slaHours: null });
    await expect(slaHoursFor('c2')).resolves.toEqual({
      hours: 48,
      source: 'policy',
      confirmed: true,
    });
    await expect(slaHoursFor()).resolves.toEqual({ hours: 48, source: 'policy', confirmed: true });
  });

  it('serviço de outra empresa ou inexistente é recusado', async () => {
    prisma.serviceCatalogItem.findFirst.mockResolvedValueOnce(null);
    await expect(slaHoursFor('x')).rejects.toThrow('Serviço do catálogo não encontrado.');
  });
});
