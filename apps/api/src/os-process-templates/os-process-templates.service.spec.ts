import { OsProcessTemplateService, ChildOrderSpec } from './os-process-templates.service';
import { AuditService } from '../common/audit.service';

function makePrisma(overrides: any = {}): any {
  const base: any = {
    osProcessTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'tpl1', tenantId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'tpl1' }),
      update: jest.fn().mockResolvedValue({ id: 'tpl1' }),
      delete: jest.fn().mockResolvedValue({ id: 'tpl1' }),
    },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'source', processInstanceId: null, tags: [] }),
      create: jest.fn().mockResolvedValue({ id: 'o1', protocol: '2026100002' }),
      count: jest.fn().mockResolvedValue(0),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ max: 100001 }]),
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(base)),
    serviceProcessInstance: { count: jest.fn().mockResolvedValue(0) },
    occurrence: { updateMany: jest.fn() },
    serviceOrderOccurrence: {
      create: jest.fn().mockResolvedValue({ id: 'occ1' }),
    },
  };
  for (const k of Object.keys(overrides)) {
    if (k in base.osProcessTemplate) {
      base.osProcessTemplate[k] = overrides[k];
    }
  }
  return base;
}

function makeAudit(): AuditService {
  return { log: jest.fn().mockResolvedValue(undefined) } as any;
}

const validChild: ChildOrderSpec = {
  id: 'c1',
  title: 'Tarefa',
  type: 'AUDITORIA',
  priority: 'NORMAL',
};

describe('OsProcessTemplateService.create', () => {
  it('cria template e gera audit log', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const svc = new OsProcessTemplateService(prisma, audit);
    await svc.create('t1', 'u1', {
      name: 'Template X',
      triggerOsTypes: ['AUDITORIA'],
      definition: { childOrders: [validChild] },
    });
    expect(prisma.osProcessTemplate.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      't1',
      'u1',
      'OS_CREATE',
      'os_process_template',
      'tpl1',
      expect.objectContaining({ op: 'create' }),
    );
  });

  it('rejeita name vazio', async () => {
    const svc = new OsProcessTemplateService(makePrisma(), makeAudit());
    await expect(
      svc.create('t1', 'u1', {
        name: '',
        triggerOsTypes: ['AUDITORIA'],
        definition: { childOrders: [validChild] },
      }),
    ).rejects.toThrow('nome do template é obrigatório');
  });

  it('rejeita triggerOsTypes vazio', async () => {
    const svc = new OsProcessTemplateService(makePrisma(), makeAudit());
    await expect(
      svc.create('t1', 'u1', {
        name: 'X',
        triggerOsTypes: [],
        definition: { childOrders: [validChild] },
      }),
    ).rejects.toThrow('ao menos um tipo de OS');
  });

  it('rejeita tipo de OS inválido', async () => {
    const svc = new OsProcessTemplateService(makePrisma(), makeAudit());
    await expect(
      svc.create('t1', 'u1', {
        name: 'X',
        triggerOsTypes: ['INVALID'],
        definition: { childOrders: [validChild] },
      }),
    ).rejects.toThrow('Tipo de OS inválido');
  });

  it('rejeita definition sem childOrders', async () => {
    const svc = new OsProcessTemplateService(makePrisma(), makeAudit());
    await expect(
      svc.create('t1', 'u1', {
        name: 'X',
        triggerOsTypes: ['AUDITORIA'],
        definition: { childOrders: [] },
      }),
    ).rejects.toThrow('ao menos uma OS filha');
  });
});

describe('OsProcessTemplateService.update', () => {
  it('lança NotFoundException se template não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await expect(svc.update('t1', 'u1', 'tpl1', { name: 'Y' })).rejects.toThrow(
      'Template de OS não encontrado',
    );
  });

  it('atualiza apenas campos fornecidos', async () => {
    const prisma = makePrisma();
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await svc.update('t1', 'u1', 'tpl1', { name: 'Novo' });
    expect(prisma.osProcessTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Novo' }) }),
    );
  });
});

describe('OsProcessTemplateService.toggle', () => {
  it('inverte flag enabled e gera audit', async () => {
    const prisma = makePrisma();
    prisma.osProcessTemplate.findFirst.mockResolvedValueOnce({ id: 'tpl1', enabled: false });
    prisma.osProcessTemplate.update.mockImplementation(async ({ data }: any) => ({
      id: 'tpl1',
      ...data,
    }));
    const audit = makeAudit();
    const svc = new OsProcessTemplateService(prisma, audit);
    await svc.toggle('t1', 'u1', 'tpl1');
    expect(prisma.osProcessTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enabled: true } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      't1',
      'u1',
      'OS_UPDATE',
      'os_process_template',
      'tpl1',
      expect.objectContaining({ enabled: true }),
    );
  });
});

describe('OsProcessTemplateService.remove', () => {
  it('deleta e gera audit log', async () => {
    const prisma = makePrisma();
    prisma.osProcessTemplate.delete.mockResolvedValueOnce({ id: 'tpl1', name: 'X' });
    const audit = makeAudit();
    const svc = new OsProcessTemplateService(prisma, audit);
    await svc.remove('t1', 'u1', 'tpl1');
    expect(audit.log).toHaveBeenCalledWith(
      't1',
      'u1',
      'OS_UPDATE',
      'os_process_template',
      'tpl1',
      expect.objectContaining({ op: 'delete', name: 'X' }),
    );
  });
});

describe('OsProcessTemplateService.executeForOrder', () => {
  it('does not run legacy child generation for an order owned by the operational engine', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findFirst.mockResolvedValueOnce({ id: 'o1', processInstanceId: 'run1' });
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await svc.executeForOrder('t1', { id: 'o1', protocol: 'OS-1', type: 'AUDITORIA' }, 'u1');
    expect(prisma.osProcessTemplate.findMany).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });
  it('não faz nada se nenhum template bate com type', async () => {
    const prisma = makePrisma();
    prisma.osProcessTemplate.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        enabled: true,
        triggerOsTypes: ['OUTRO'],
        definition: { childOrders: [validChild] },
      },
    ]);
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await svc.executeForOrder('t1', { id: 'o1', protocol: 'OS-1', type: 'ROMPIMENTO' }, 'u1');
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('cria OS filhas para templates habilitados e com type match', async () => {
    const prisma = makePrisma();
    prisma.osProcessTemplate.findMany.mockResolvedValueOnce([
      {
        id: 'tpl1',
        name: 'X',
        enabled: true,
        triggerOsTypes: ['AUDITORIA'],
        definition: { childOrders: [validChild] },
      },
    ]);
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await svc.executeForOrder('t1', { id: 'o1', protocol: 'OS-origem', type: 'AUDITORIA' }, 'u1');
    expect(prisma.serviceOrder.create).toHaveBeenCalled();
    expect(prisma.serviceOrderOccurrence.create).toHaveBeenCalled();
  });

  it('pula childOrders vazio', async () => {
    const prisma = makePrisma();
    prisma.osProcessTemplate.findMany.mockResolvedValueOnce([
      {
        id: 'tpl1',
        name: 'X',
        enabled: true,
        triggerOsTypes: ['AUDITORIA'],
        definition: { childOrders: [] },
      },
    ]);
    const svc = new OsProcessTemplateService(prisma, makeAudit());
    await svc.executeForOrder('t1', { id: 'o1', protocol: 'OS-origem', type: 'AUDITORIA' }, 'u1');
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });
});

describe('OsProcessTemplateService.executeForOrder — travas (C-034)', () => {
  const template = {
    id: 'tpl1',
    name: 'Pós-instalação',
    enabled: true,
    triggerOsTypes: ['INSTALACAO'],
    definition: { childOrders: [{ title: 'Vistoria', type: 'INSTALACAO', priority: 'NORMAL' }] },
  };
  const source = { id: 'src', protocol: 'P', type: 'INSTALACAO' as any, occurrenceId: 'occ' };

  it('O.S. criada por modelo não dispara modelo de novo (sem laço)', async () => {
    const prisma = makePrisma({ findMany: jest.fn().mockResolvedValue([template]) });
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: 'src',
      processInstanceId: null,
      parentOrderId: 'avó',
      tags: ['template:tpl1'],
    });
    await new OsProcessTemplateService(prisma, makeAudit()).executeForOrder('t1', source, 'u1');
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('não cria segunda leva para a mesma origem e cria filha vinculada com protocolo normal', async () => {
    const prisma = makePrisma({ findMany: jest.fn().mockResolvedValue([template]) });
    prisma.serviceOrder.count.mockResolvedValueOnce(1);
    const service = new OsProcessTemplateService(prisma, makeAudit());
    await service.executeForOrder('t1', source, 'u1');
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();

    prisma.serviceOrder.count.mockResolvedValueOnce(0);
    await service.executeForOrder('t1', source, 'u1');
    const data = prisma.serviceOrder.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ parentOrderId: 'src', rootOrderId: 'src' });
    expect(data.protocol).toMatch(/^\d{10}$/);
    expect(prisma.occurrence.updateMany).toHaveBeenCalled();
  });
});
