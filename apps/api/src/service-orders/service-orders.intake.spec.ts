import { ServiceOrdersService } from './service-orders.service';

describe('Occurrence intake with first order', () => {
  const input = () => ({
    tenantId: 'tenant',
    customerId: 'customer',
    provider: 'Nome informado',
    type: 'DNS',
    sector: 'NOC',
    origin: 'Solicitação',
    openedByName: 'Nome informado',
    analystResponsible: 'Nome informado',
    description: 'Verificar DNS',
    firstOrder: {
      type: 'DNS' as const,
      title: 'Verificar DNS',
      description: 'Verificar DNS',
      ownerUserId: 'owner',
      assigneeUserId: 'analyst',
    },
  });
  function fixture() {
    const tx = {
      occurrence: { create: jest.fn().mockResolvedValue({ id: 'occ', number: 'INC-1' }) },
      serviceOrder: { create: jest.fn().mockResolvedValue({ id: 'order', protocol: 'OS-1' }) },
    };
    const db = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ tradeName: 'MEGANET', legalName: 'Empresa' }),
      },
      userTenant: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'owner', user: { name: 'Abertura' } },
          { userId: 'actor', user: { name: 'Autor autenticado' } },
          { userId: 'analyst', user: { name: 'Analista' } },
        ]),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const service = new ServiceOrdersService(
      db as never,
      { emitTenantEvent: jest.fn() } as never,
      {
        findApplicablePolicy: jest.fn().mockResolvedValue({ hours: 4 }),
        calculateTargetDate: jest.fn().mockResolvedValue(new Date()),
      } as never,
      undefined,
    );
    jest.spyOn(service as any, 'buildProtocol').mockResolvedValue('OS-1');
    jest.spyOn(service as any, 'buildOccurrenceNumber').mockResolvedValue('INC-1');
    jest.spyOn(service as any, 'logAudit').mockResolvedValue(undefined);
    jest.spyOn(service, 'getOccurrenceById').mockResolvedValue({ id: 'occ' } as never);
    return { db, tx, service };
  }
  it('creates the occurrence and first order together, linking customer and responsible IDs', async () => {
    const { service, db, tx } = fixture();
    await service.createOccurrenceWithFirstOrder('actor', 'analista', input());
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.customer.findFirst.mock.calls[0][0].where).toEqual({
      id: 'customer',
      tenantId: 'tenant',
      deletedAt: null,
    });
    expect(tx.occurrence.create.mock.calls[0][0].data).toMatchObject({
      customerId: 'customer',
      provider: 'MEGANET',
      openedByName: 'Autor autenticado',
      analystResponsible: 'Analista',
    });
    expect(tx.serviceOrder.create.mock.calls[0][0].data).toMatchObject({
      occurrenceId: 'occ',
      ownerUserId: 'actor',
      ownerName: 'Autor autenticado',
      assigneeUserId: 'analyst',
      analystName: 'Analista',
      requester: 'MEGANET',
    });
  });
  it('rejects a provider outside the authenticated company before writing', async () => {
    const { service, db } = fixture();
    db.customer.findFirst.mockResolvedValue(null as never);
    await expect(
      service.createOccurrenceWithFirstOrder('actor', 'analista', input()),
    ).rejects.toThrow('Provedor não encontrado');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects assignees who are not operators of the company', async () => {
    const { service, db } = fixture();
    db.userTenant.findMany.mockResolvedValue([]);
    await expect(
      service.createOccurrenceWithFirstOrder('actor', 'analista', input()),
    ).rejects.toThrow('Selecione responsáveis');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
