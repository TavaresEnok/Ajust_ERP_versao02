import { ForbiddenException } from '@nestjs/common';
import { RequestWithAuth } from '../common/request-with-auth';
import { OrderOperationsController } from './order-operations.controller';

describe('OrderOperationsController: início sem justificativa', () => {
  const request = {
    auth: { tenantId: 'ajust', userId: 'analyst', role: 'analista' },
  } as RequestWithAuth;
  const service = { run: jest.fn().mockResolvedValue({ status: 'EM_ANALISE' }) };
  const controller = new OrderOperationsController(service as never);
  beforeEach(() => service.run.mockClear());

  it.each([undefined, '', '  '])('permite iniciar sem justificativa (%s)', async (reason) => {
    await expect(
      controller.run(request, 'order', { action: 'start', expectedVersion: 1, reason }),
    ).resolves.toEqual({ status: 'EM_ANALISE' });
    expect(service.run).toHaveBeenCalledWith('ajust', 'analyst', 'analista', 'order', {
      action: 'start',
      expectedVersion: 1,
      reason: '',
    });
  });
  it.each(['pause', 'resume', 'schedule', 'unschedule', 'assign', 'finish', 'reopen'])(
    'mantém o registro obrigatório para %s',
    (action) => {
      expect(() => controller.run(request, 'order', { action, expectedVersion: 1 })).toThrow();
      expect(service.run).not.toHaveBeenCalled();
    },
  );
  it('aceita o resultado técnico no encerramento', async () => {
    await controller.run(request, 'order', {
      action: 'finish',
      expectedVersion: 1,
      reason: 'DNS validado com o provedor.',
    });
    expect(service.run).toHaveBeenCalled();
  });
  it('preserva evidências separadas e rejeita campos vazios', async () => {
    await controller.run(request, 'order', {
      action: 'finish',
      expectedVersion: 1,
      reason: 'Registro da etapa',
      evidence: { Diagnóstico: ' Falha DNS ', Testes: 'Consulta corrigida' },
    });
    expect(service.run).toHaveBeenLastCalledWith(
      'ajust',
      'analyst',
      'analista',
      'order',
      expect.objectContaining({
        evidence: { Diagnóstico: 'Falha DNS', Testes: 'Consulta corrigida' },
      }),
    );
    service.run.mockClear();
    expect(() =>
      controller.run(request, 'order', {
        action: 'finish',
        expectedVersion: 1,
        reason: 'Registro da etapa',
        evidence: { Diagnóstico: ' ' },
      }),
    ).toThrow();
    expect(service.run).not.toHaveBeenCalled();
  });
  it('não permite iniciar sem versão nem com perfil de cliente', () => {
    expect(() => controller.run(request, 'order', { action: 'start' })).toThrow();
    expect(() =>
      controller.run({ auth: { ...request.auth, role: 'cliente' } } as RequestWithAuth, 'order', {
        action: 'start',
        expectedVersion: 1,
      }),
    ).toThrow(ForbiddenException);
    expect(service.run).not.toHaveBeenCalled();
  });
});
