import { OperationalProcessesService } from './operational-processes.service';

/** Fechamento pela tela de processos tem os mesmos efeitos do resto (C-013/C-032/C-035). */
describe('fila de eventos do motor de processos', () => {
  function setup(attempts: number) {
    const event = {
      id: 'e1',
      tenantId: 't1',
      eventKey: 'i1:s1:o1:closed',
      status: 'PENDING',
      attempts,
      payload: { id: 'o1', previousStatus: 'EM_ANALISE', status: 'FECHADA' },
    };
    const prisma: any = {
      serviceProcessEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      workflowExecutionLog: { count: jest.fn().mockResolvedValue(0) },
    };
    const workflows: any = { executeForEvent: jest.fn().mockResolvedValue([]) };
    const lifecycle: any = { afterStatusChange: jest.fn() };
    const service = new OperationalProcessesService(prisma, workflows, lifecycle);
    return { service, prisma, workflows, lifecycle };
  }

  it('primeira entrega roda os efeitos de fechamento sem duplicar o workflow', async () => {
    const { service, lifecycle, workflows } = setup(0);
    await service.deliverEvents();
    expect(lifecycle.afterStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        from: 'EM_ANALISE',
        to: 'FECHADA',
        source: 'process',
        workflows: false,
      }),
    );
    expect(workflows.executeForEvent).toHaveBeenCalledTimes(1);
  });

  it('nova tentativa retoma efeitos pendentes pelo outbox e reenvia workflows', async () => {
    const { service, lifecycle, workflows } = setup(1);
    await service.deliverEvents();
    expect(lifecycle.afterStatusChange).toHaveBeenCalledTimes(1);
    expect(workflows.executeForEvent).toHaveBeenCalledTimes(1);
  });
});
