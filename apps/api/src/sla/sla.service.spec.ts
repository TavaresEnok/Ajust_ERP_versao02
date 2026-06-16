import { SlaEngineService } from './sla-engine.service';
import { Priority, ServiceOrderType } from '@prisma/client';

function makePolicy(
  overrides: {
    id?: string;
    priority?: Priority;
    serviceOrderType?: ServiceOrderType | null;
    hours?: number;
    active?: boolean;
    isOverride?: boolean;
  } = {},
) {
  return {
    id: overrides.id ?? 'policy-1',
    tenantId: 'tenant-1',
    priority: overrides.priority ?? Priority.NORMAL,
    serviceOrderType: overrides.serviceOrderType ?? null,
    hours: overrides.hours ?? 24,
    isOverride: overrides.isOverride ?? false,
    active: overrides.active ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('SlaEngineService', () => {
  let service: SlaEngineService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      slaPolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }),
      },
      businessCalendar: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      businessCalendarException: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    service = new SlaEngineService(mockPrisma);
  });

  // ============================================================
  // adjustToBusinessHours (private, tested via cast)
  // ============================================================
  describe('adjustToBusinessHours', () => {
    function adjust(date: Date): Date {
      (service as any).adjustToBusinessHours(date);
      return date;
    }

    it('mantem horario dentro do expediente em dia util', () => {
      const mon10am = new Date('2025-06-02T10:00:00');
      const result = adjust(new Date(mon10am));
      expect(result).toEqual(mon10am);
    });

    it('ajusta para 8h quando antes do inicio do expediente', () => {
      const mon7am = new Date('2025-06-02T07:00:00');
      const result = adjust(new Date(mon7am));
      expect(result).toEqual(new Date('2025-06-02T08:00:00'));
    });

    it('avanca para o proximo dia as 8h quando apos o fim do expediente', () => {
      const mon7pm = new Date('2025-06-02T19:00:00');
      const result = adjust(new Date(mon7pm));
      expect(result).toEqual(new Date('2025-06-03T08:00:00'));
    });

    it('avanca para segunda-feira quando sexta apos o expediente', () => {
      const fri7pm = new Date('2025-06-06T19:00:00');
      const result = adjust(new Date(fri7pm));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('avanca para segunda-feira quando sabado', () => {
      const sat10am = new Date('2025-06-07T10:00:00');
      const result = adjust(new Date(sat10am));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('avanca para segunda-feira quando domingo', () => {
      const sun3pm = new Date('2025-06-08T15:00:00');
      const result = adjust(new Date(sun3pm));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('exatamente as 18h considera fim do expediente e avanca', () => {
      const mon6pm = new Date('2025-06-02T18:00:00');
      const result = adjust(new Date(mon6pm));
      expect(result).toEqual(new Date('2025-06-03T08:00:00'));
    });

    it('exatamente as 8h mantem o horario', () => {
      const mon8am = new Date('2025-06-02T08:00:00');
      const result = adjust(new Date(mon8am));
      expect(result).toEqual(mon8am);
    });
  });

  // ============================================================
  // calculateTargetDate
  // ============================================================
  describe('calculateTargetDate', () => {
    it('calcula deadline no mesmo dia util', () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = service.calculateTargetDate(start, 4);
      expect(result).toEqual(new Date('2025-06-02T14:00:00'));
    });

    it('ultrapassa para o proximo dia quando SLA maior que restante do dia', () => {
      const start = new Date('2025-06-02T16:00:00');
      const result = service.calculateTargetDate(start, 4);
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('salta fim de semana ao calcular deadline', () => {
      const start = new Date('2025-06-06T16:00:00');
      const result = service.calculateTargetDate(start, 8);
      expect(result).toEqual(new Date('2025-06-09T14:00:00'));
    });

    it('ajusta inicio no fim de semana para segunda-feira', () => {
      const start = new Date('2025-06-07T10:00:00');
      const result = service.calculateTargetDate(start, 2);
      expect(result).toEqual(new Date('2025-06-09T10:00:00'));
    });

    it('ajusta inicio apos expediente para proximo dia', () => {
      const start = new Date('2025-06-02T19:00:00');
      const result = service.calculateTargetDate(start, 2);
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('ajusta inicio antes do expediente para as 8h', () => {
      const start = new Date('2025-06-02T06:00:00');
      const result = service.calculateTargetDate(start, 2);
      expect(result).toEqual(new Date('2025-06-02T10:00:00'));
    });

    it('SLA longo que abrange multiplas semanas', () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = service.calculateTargetDate(start, 60);
      expect(result).toEqual(new Date('2025-06-10T10:00:00'));
    });

    it('zero horas mantem data de inicio (apos ajuste)', () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = service.calculateTargetDate(start, 0);
      expect(result).toEqual(new Date('2025-06-02T10:00:00'));
    });

    it('SLA exato de um dia util (10 horas)', () => {
      const start = new Date('2025-06-02T08:00:00');
      const result = service.calculateTargetDate(start, 10);
      expect(result).toEqual(new Date('2025-06-02T18:00:00'));
    });

    it('inicio exatamente as 18h empurra para proximo dia', () => {
      const start = new Date('2025-06-02T18:00:00');
      const result = service.calculateTargetDate(start, 2);
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('calcula calendário do tenant no fuso configurado, não no UTC do servidor', async () => {
      const start = new Date('2026-06-01T10:00:00Z'); // 07:00 em São Paulo
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');

      expect(result).toEqual(new Date('2026-06-01T13:00:00Z')); // 10:00 em São Paulo
    });
  });

  // ============================================================
  // calculateBusinessPauseDuration
  // ============================================================
  describe('calculateBusinessPauseDuration', () => {
    it('calcula pausa dentro do mesmo dia util', () => {
      const start = new Date('2025-06-02T10:00:00');
      const end = new Date('2025-06-02T14:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(240);
    });

    it('calcula pausa que atravessa para o dia seguinte', () => {
      const start = new Date('2025-06-02T16:00:00');
      const end = new Date('2025-06-03T10:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(240);
    });

    it('calcula pausa que atravessa fim de semana', () => {
      const start = new Date('2025-06-06T16:00:00');
      const end = new Date('2025-06-09T10:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(240);
    });

    it('retorna zero quando pausa ocorre apenas no fim de semana', () => {
      const start = new Date('2025-06-07T10:00:00');
      const end = new Date('2025-06-08T14:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(0);
    });

    it('pausa iniciada apos o expediente conta apenas proximo dia', () => {
      const start = new Date('2025-06-02T19:00:00');
      const end = new Date('2025-06-03T09:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(60);
    });

    it('pausa de 10 horas uteis completas (um dia inteiro)', () => {
      const start = new Date('2025-06-02T08:00:00');
      const end = new Date('2025-06-02T18:00:00');
      const result = service.calculateBusinessPauseDuration(start, end);
      expect(result).toBe(600);
    });
  });

  // ============================================================
  // findApplicablePolicy
  // ============================================================
  describe('findApplicablePolicy', () => {
    it('encontra politica exata por prioridade e tipo', async () => {
      const policy = makePolicy({
        priority: Priority.CRITICA,
        serviceOrderType: ServiceOrderType.ROMPIMENTO,
        hours: 4,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([policy]);

      const result = await service.findApplicablePolicy(
        'tenant-1',
        Priority.CRITICA,
        ServiceOrderType.ROMPIMENTO,
      );

      expect(result).toEqual(policy);
    });

    it('fallback para politica sem tipo quando nao ha match exato', async () => {
      const typeSpecific = makePolicy({
        priority: Priority.CRITICA,
        serviceOrderType: ServiceOrderType.ROMPIMENTO,
        hours: 4,
      });
      const generic = makePolicy({
        priority: Priority.CRITICA,
        serviceOrderType: null,
        hours: 8,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([typeSpecific, generic]);

      const result = await service.findApplicablePolicy(
        'tenant-1',
        Priority.CRITICA,
        ServiceOrderType.LENTIDAO,
      );

      expect(result).toEqual(generic);
    });

    it('retorna default de 48 horas quando nenhuma politica configurada', async () => {
      mockPrisma.slaPolicy.findMany.mockResolvedValue([]);

      const result = await service.findApplicablePolicy('tenant-1', Priority.NORMAL);

      expect(result).toEqual({ hours: 48, priority: Priority.NORMAL });
    });

    it('prefere match exato sobre generico quando ambos existem', async () => {
      const generic = makePolicy({
        id: 'generic',
        priority: Priority.ALTA,
        serviceOrderType: null,
        hours: 12,
      });
      const exact = makePolicy({
        id: 'exact',
        priority: Priority.ALTA,
        serviceOrderType: ServiceOrderType.INSTALACAO,
        hours: 6,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([generic, exact]);

      const result = await service.findApplicablePolicy(
        'tenant-1',
        Priority.ALTA,
        ServiceOrderType.INSTALACAO,
      );

      expect(result).toEqual(exact);
    });

    it('prefere override por tipo independentemente da prioridade oculta', async () => {
      const base = makePolicy({
        id: 'base',
        priority: Priority.CRITICA,
        serviceOrderType: null,
        hours: 4,
      });
      const override = makePolicy({
        id: 'override',
        priority: Priority.NORMAL,
        serviceOrderType: ServiceOrderType.INSTALACAO,
        hours: 20,
        isOverride: true,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([base, override]);

      const result = await service.findApplicablePolicy(
        'tenant-1',
        Priority.CRITICA,
        ServiceOrderType.INSTALACAO,
      );

      expect(result).toEqual(override);
    });

    it('retorna default quando prioridade nao tem nenhuma politica', async () => {
      const onlyAlta = makePolicy({ priority: Priority.ALTA, hours: 12 });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([onlyAlta]);

      const result = await service.findApplicablePolicy('tenant-1', Priority.NORMAL);

      expect(result).toEqual({ hours: 48, priority: Priority.NORMAL });
    });

    it('filtra por tenantId e apenas politicas ativas', async () => {
      mockPrisma.slaPolicy.findMany.mockResolvedValue([]);

      await service.findApplicablePolicy('tenant-abc', Priority.BAIXA);

      expect(mockPrisma.slaPolicy.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-abc', active: true },
        orderBy: [{ isOverride: 'desc' }, { updatedAt: 'desc' }],
      });
    });

    it('funciona sem informar ServiceOrderType', async () => {
      const policy = makePolicy({
        priority: Priority.BAIXA,
        serviceOrderType: null,
        hours: 72,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([policy]);

      const result = await service.findApplicablePolicy('tenant-1', Priority.BAIXA);

      expect(result).toEqual(policy);
    });
  });
});
