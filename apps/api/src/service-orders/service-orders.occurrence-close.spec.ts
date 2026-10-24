import { Prisma } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';

describe('Occurrence closure', () => {
  function fixture() {
    const tx = {
      occurrence: {
        findFirst: jest.fn().mockResolvedValue({ id: 'occ', number: 'INC-1', processes: [] }),
        update: jest.fn().mockResolvedValue({ id: 'occ', number: 'INC-1' }),
      },
      serviceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const db = { $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)) };
    const events = { emitTenantEvent: jest.fn() };
    const service = new ServiceOrdersService(db as never, events as never, {} as never, undefined);
    const audit = jest.spyOn(service as any, 'logAudit').mockResolvedValue(undefined);
    jest.spyOn(service, 'getOccurrenceById').mockResolvedValue({ id: 'occ' } as never);
    return { tx, db, service, events, audit };
  }
  it.each(['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA'])(
    'blocks closure with a %s order and identifies it',
    async (status) => {
      const { service, tx, events, audit } = fixture();
      tx.serviceOrder.findMany.mockResolvedValue([
        { id: 'order', protocol: 'OS-123', status },
      ] as never);
      await expect(
        service.updateOccurrence('tenant', 'occ', 'actor', 'analista', { status: 'ENCERRADA' }),
      ).rejects.toThrow('OS-123');
      expect(tx.serviceOrder.findMany.mock.calls[0][0].where).toEqual({
        tenantId: 'tenant',
        occurrenceId: 'occ',
        deletedAt: null,
        status: { notIn: ['FECHADA', 'CANCELADA'] },
      });
      expect(tx.occurrence.update).not.toHaveBeenCalled();
      expect(tx.serviceOrder.update).not.toHaveBeenCalled();
      expect(tx.serviceOrder.updateMany).not.toHaveBeenCalled();
      expect(events.emitTenantEvent).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
    },
  );
  it('permits closure when there are no pending orders without changing the orders', async () => {
    const { service, tx, db } = fixture();
    await service.updateOccurrence('tenant', 'occ', 'actor', 'gerente', { status: 'ENCERRADA' });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.occurrence.update.mock.calls[0][0].data).toMatchObject({
      status: 'ENCERRADA',
      closedAt: expect.any(Date),
    });
    expect(tx.serviceOrder.updateMany).not.toHaveBeenCalled();
  });
  it('allows editing other occurrence data while orders are pending', async () => {
    const { service, tx } = fixture();
    await service.updateOccurrence('tenant', 'occ', 'actor', 'analista', {
      description: 'Descrição corrigida',
    });
    expect(tx.serviceOrder.findMany).not.toHaveBeenCalled();
    expect(tx.occurrence.update.mock.calls[0][0].data).toEqual({
      description: 'Descrição corrigida',
    });
  });
  it('clears the closure date when manually returning an occurrence to execution', async () => {
    const { service, tx } = fixture();
    await service.updateOccurrence('tenant', 'occ', 'actor', 'gerente', { status: 'EM_EXECUCAO' });
    expect(tx.occurrence.update.mock.calls[0][0].data.closedAt).toBeNull();
  });
  it('preserves the workflow authority for process-controlled occurrences', async () => {
    const { service, tx } = fixture();
    tx.occurrence.findFirst.mockResolvedValue({
      id: 'occ',
      number: 'INC-1',
      processes: [{ id: 'process' }],
    } as never);
    await expect(
      service.updateOccurrence('tenant', 'occ', 'actor', 'gerente', { status: 'ENCERRADA' }),
    ).rejects.toThrow('processos');
    expect(tx.occurrence.update).not.toHaveBeenCalled();
  });
  it('does not write for an occurrence outside the authenticated tenant', async () => {
    const { service, tx } = fixture();
    tx.occurrence.findFirst.mockResolvedValue(null as never);
    await expect(
      service.updateOccurrence('tenant', 'foreign-occ', 'actor', 'gerente', {
        status: 'ENCERRADA',
      }),
    ).rejects.toThrow('not found');
    expect(tx.occurrence.findFirst.mock.calls[0][0].where).toEqual({
      id: 'foreign-occ',
      tenantId: 'tenant',
      deletedAt: null,
    });
    expect(tx.occurrence.update).not.toHaveBeenCalled();
  });
});
