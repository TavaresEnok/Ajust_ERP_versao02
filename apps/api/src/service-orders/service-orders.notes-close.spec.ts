import { ServiceOrdersService } from './service-orders.service';
describe('Order annotation corrections and historical completion', () => {
  function fixture() {
    const tx = {
      serviceOrderOccurrence: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrder: { findFirstOrThrow: jest.fn().mockResolvedValue({ protocol: 'OS-1' }) },
      occurrenceAnnotation: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      ...tx,
      serviceOrder: { ...tx.serviceOrder, findFirst: jest.fn() },
      serviceProcessInstance: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    return {
      tx,
      prisma,
      service: new ServiceOrdersService(prisma as never, {} as never, {} as never, undefined),
    };
  }
  it('restricts edits to manual notes by their original author in the authenticated tenant', async () => {
    const { service, tx } = fixture();
    tx.serviceOrderOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.editOrderAnnotation('tenant', 'order', 'note', 'actor', 'analista', 'Correção', 1),
    ).rejects.toThrow();
    expect(tx.serviceOrderOccurrence.findFirst.mock.calls[0][0].where).toMatchObject({
      actorUserId: 'actor',
      editable: true,
      serviceOrder: { tenantId: 'tenant', deletedAt: null },
    });
    expect(tx.serviceOrderOccurrence.updateMany).not.toHaveBeenCalled();
  });
  it('updates the mirror and preserves the prior message in audit', async () => {
    const { service, tx } = fixture();
    tx.serviceOrderOccurrence.findFirst.mockResolvedValue({
      id: 'note',
      message: 'Anterior',
      version: 1,
      mirroredAnnotationId: 'mirror',
    });
    await service.editOrderAnnotation(
      'tenant',
      'order',
      'note',
      'actor',
      'analista',
      'Correção',
      1,
    );
    expect(tx.occurrenceAnnotation.updateMany).toHaveBeenCalledWith({
      where: { id: 'mirror', tenantId: 'tenant', actorUserId: 'actor' },
      data: { message: '[O.S OS-1] Correção' },
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.metadata.previousMessage).toBe('Anterior');
  });
  it('rejects a concurrent update without changing the mirror', async () => {
    const { service, tx } = fixture();
    tx.serviceOrderOccurrence.findFirst.mockResolvedValue({
      id: 'note',
      message: 'Anterior',
      version: 2,
    });
    tx.serviceOrderOccurrence.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.editOrderAnnotation('tenant', 'order', 'note', 'actor', 'analista', 'Correção', 1),
    ).rejects.toThrow('A anotação mudou');
    expect(tx.occurrenceAnnotation.updateMany).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'only allows ordinary transitions for an archived process with no active work (%s)',
    async (archived) => {
      const { service, prisma } = fixture();
      prisma.serviceOrder.findFirst.mockResolvedValue({
        id: 'order',
        tenantId: 'tenant',
        status: 'ABERTA',
        processInstanceId: 'process',
      });
      prisma.serviceProcessInstance.findFirst.mockResolvedValue(
        archived ? { id: 'process' } : null,
      );
      await expect(
        service.transition('tenant', 'order', 'actor', 'analista', {
          toStatus: 'ABERTA' as never,
          reason: 'Teste',
        }),
      ).rejects.toThrow(
        archived
          ? 'Source and destination statuses are equal.'
          : 'Esta O.S. pertence a um processo.',
      );
      expect(prisma.serviceProcessInstance.findFirst.mock.calls[0][0].where).toMatchObject({
        tenantId: 'tenant',
        status: 'HISTORICAL',
        engineVersion: 2,
        steps: { none: { status: { in: ['ACTIVE', 'WAITING'] } } },
      });
    },
  );
});
