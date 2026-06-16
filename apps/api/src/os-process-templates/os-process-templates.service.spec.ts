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
      create: jest.fn().mockResolvedValue({ id: 'o1', protocol: 'WF-abc' }),
    },
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
