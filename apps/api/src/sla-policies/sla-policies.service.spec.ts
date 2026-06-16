import { SlaPoliciesService } from './sla-policies.service';

function makePrisma() {
  return {
    slaPolicy: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'policy-1', ...data })),
      update: jest.fn().mockResolvedValue({ id: 'policy-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('SlaPoliciesService', () => {
  it('normaliza política base sem tipo de serviço', async () => {
    const prisma = makePrisma();
    const service = new SlaPoliciesService(prisma as any);

    await service.create('tenant-1', {
      priority: 'ALTA',
      serviceOrderType: null,
      hours: 8,
      isOverride: false,
    });

    expect(prisma.slaPolicy.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        priority: 'ALTA',
        serviceOrderType: null,
        hours: 8,
        isOverride: false,
        active: true,
      },
    });
  });

  it('exige tipo de serviço para override', async () => {
    const service = new SlaPoliciesService(makePrisma() as any);

    await expect(
      service.create('tenant-1', {
        priority: 'NORMAL',
        hours: 8,
        isOverride: true,
      }),
    ).rejects.toThrow('require a serviceOrderType');
  });

  it('rejeita política equivalente duplicada', async () => {
    const prisma = makePrisma();
    prisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'existing' });
    const service = new SlaPoliciesService(prisma as any);

    await expect(
      service.create('tenant-1', {
        priority: 'CRITICA',
        hours: 4,
      }),
    ).rejects.toThrow('equivalent SLA policy already exists');
  });

  it('retorna not found ao remover política inexistente', async () => {
    const prisma = makePrisma();
    prisma.slaPolicy.deleteMany.mockResolvedValueOnce({ count: 0 });
    const service = new SlaPoliciesService(prisma as any);

    await expect(service.remove('tenant-1', 'missing')).rejects.toThrow('Policy not found');
  });
});
