import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';

function makeController() {
  const serviceOrders = { create: jest.fn().mockResolvedValue({ id: 'order-1' }) };
  const prisma = {
    tenant: {
      findFirst: jest.fn().mockResolvedValue({ id: tenantId }),
    },
  };
  const apiKeys = {
    validateKey: jest.fn().mockResolvedValue({ tenantId, keyId: 'key-1' }),
  };

  return {
    controller: new WebhookController(serviceOrders as any, prisma as any, apiKeys as any),
    serviceOrders,
    prisma,
    apiKeys,
  };
}

const validPayload = {
  title: 'Falha de conexão',
  description: 'Cliente sem conectividade.',
  requester: 'Chatbot',
};

describe('WebhookController', () => {
  const originalToken = process.env.CHAT_WEBHOOK_TOKEN;

  beforeEach(() => {
    process.env.CHAT_WEBHOOK_TOKEN = 'global-chat-token';
  });

  afterAll(() => {
    process.env.CHAT_WEBHOOK_TOKEN = originalToken;
  });

  it('aceita API Key e vincula o chamado ao tenant da chave', async () => {
    const { controller, apiKeys, prisma, serviceOrders } = makeController();

    await expect(
      controller.handleIncomingChat('Bearer ajust_valid', validPayload),
    ).resolves.toEqual({ id: 'order-1' });

    expect(apiKeys.validateKey).toHaveBeenCalledWith('ajust_valid');
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: tenantId }) }),
    );
    expect(serviceOrders.create).toHaveBeenCalledWith(
      null,
      'gerente',
      expect.objectContaining({ tenantId }),
    );
  });

  it('rejeita tentativa de usar API Key em outro tenant', async () => {
    const { controller } = makeController();

    await expect(
      controller.handleIncomingChat('Bearer ajust_valid', {
        ...validPayload,
        tenantId: otherTenantId,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exige tenantId quando usa o token global', async () => {
    const { controller } = makeController();

    await expect(
      controller.handleIncomingChat('Bearer global-chat-token', validPayload),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita credencial inválida', async () => {
    const { controller, apiKeys } = makeController();
    apiKeys.validateKey.mockResolvedValueOnce(null);

    await expect(
      controller.handleIncomingChat('Bearer invalid', validPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita tenant suspenso ou inexistente', async () => {
    const { controller, prisma } = makeController();
    prisma.tenant.findFirst.mockResolvedValueOnce(null);

    await expect(controller.handleIncomingChat('Bearer ajust_valid', validPayload)).rejects.toThrow(
      'Tenant is unavailable',
    );
  });
});
