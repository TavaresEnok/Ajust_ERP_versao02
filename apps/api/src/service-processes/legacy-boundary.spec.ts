import { ServiceProcessesController } from './service-processes.controller';
import { OsProcessTemplateController } from '../os-process-templates/os-process-templates.controller';
import { GoneException } from '@nestjs/common';
describe('Legacy automation boundary', () => {
  const req = { auth: { tenantId: 't', userId: 'u', role: 'gerente' } } as never;
  it('rejects writes and execution on old processes while retaining reads', () => {
    const service = { assertRole: jest.fn(), list: jest.fn().mockReturnValue([]) };
    const controller = new ServiceProcessesController(service as never);
    expect(() => controller.start(req, {})).toThrow(GoneException);
    expect(() => controller.save(req, {})).toThrow(GoneException);
    expect(() => controller.act(req, 'id', {})).toThrow(GoneException);
    expect(controller.list(req)).toEqual([]);
  });
  it('rejects enabling and creating old OS templates', () => {
    const controller = new OsProcessTemplateController({} as never);
    expect(() => controller.create(req, {})).toThrow(GoneException);
    expect(() => controller.update(req, 'id', {})).toThrow(GoneException);
    expect(() => controller.toggle(req, 'id')).toThrow(GoneException);
  });
});
