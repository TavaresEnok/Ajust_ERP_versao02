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
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      mockPrisma.businessCalendar.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isWorkDay: dayOfWeek > 0 && dayOfWeek < 6,
          startTime: '08:00',
          endTime: '18:00',
        })),
      );
    });

    async function adjust(date: Date): Promise<Date> {
      return service.calculateTargetDate(date, 0, 'tenant-1');
    }

    it('mantem horario dentro do expediente em dia util', async () => {
      const mon10am = new Date('2025-06-02T10:00:00');
      const result = await adjust(new Date(mon10am));
      expect(result).toEqual(mon10am);
    });

    it('ajusta para 8h quando antes do inicio do expediente', async () => {
      const mon7am = new Date('2025-06-02T07:00:00');
      const result = await adjust(new Date(mon7am));
      expect(result).toEqual(new Date('2025-06-02T08:00:00'));
    });

    it('avanca para o proximo dia as 8h quando apos o fim do expediente', async () => {
      const mon7pm = new Date('2025-06-02T19:00:00');
      const result = await adjust(new Date(mon7pm));
      expect(result).toEqual(new Date('2025-06-03T08:00:00'));
    });

    it('avanca para segunda-feira quando sexta apos o expediente', async () => {
      const fri7pm = new Date('2025-06-06T19:00:00');
      const result = await adjust(new Date(fri7pm));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('avanca para segunda-feira quando sabado', async () => {
      const sat10am = new Date('2025-06-07T10:00:00');
      const result = await adjust(new Date(sat10am));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('avanca para segunda-feira quando domingo', async () => {
      const sun3pm = new Date('2025-06-08T15:00:00');
      const result = await adjust(new Date(sun3pm));
      expect(result).toEqual(new Date('2025-06-09T08:00:00'));
    });

    it('exatamente as 18h considera fim do expediente e avanca', async () => {
      const mon6pm = new Date('2025-06-02T18:00:00');
      const result = await adjust(new Date(mon6pm));
      expect(result).toEqual(new Date('2025-06-03T08:00:00'));
    });

    it('exatamente as 8h mantem o horario', async () => {
      const mon8am = new Date('2025-06-02T08:00:00');
      const result = await adjust(new Date(mon8am));
      expect(result).toEqual(mon8am);
    });
  });

  // ============================================================
  // calculateTargetDate
  // ============================================================
  describe('calculateTargetDate', () => {
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      mockPrisma.businessCalendar.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isWorkDay: dayOfWeek > 0 && dayOfWeek < 6,
          startTime: '08:00',
          endTime: '18:00',
        })),
      );
    });

    it('calcula deadline no mesmo dia util', async () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = await service.calculateTargetDate(start, 4, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-02T14:00:00'));
    });

    it('ultrapassa para o proximo dia quando SLA maior que restante do dia', async () => {
      const start = new Date('2025-06-02T16:00:00');
      const result = await service.calculateTargetDate(start, 4, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('salta fim de semana ao calcular deadline', async () => {
      const start = new Date('2025-06-06T16:00:00');
      const result = await service.calculateTargetDate(start, 8, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-09T14:00:00'));
    });

    it('ajusta inicio no fim de semana para segunda-feira', async () => {
      const start = new Date('2025-06-07T10:00:00');
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-09T10:00:00'));
    });

    it('ajusta inicio apos expediente para proximo dia', async () => {
      const start = new Date('2025-06-02T19:00:00');
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('ajusta inicio antes do expediente para as 8h', async () => {
      const start = new Date('2025-06-02T06:00:00');
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-02T10:00:00'));
    });

    it('SLA longo que abrange multiplas semanas', async () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = await service.calculateTargetDate(start, 60, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-10T10:00:00'));
    });

    it('zero horas mantem data de inicio (apos ajuste)', async () => {
      const start = new Date('2025-06-02T10:00:00');
      const result = await service.calculateTargetDate(start, 0, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-02T10:00:00'));
    });

    it('SLA exato de um dia util (10 horas)', async () => {
      const start = new Date('2025-06-02T08:00:00');
      const result = await service.calculateTargetDate(start, 10, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-02T18:00:00'));
    });

    it('inicio exatamente as 18h empurra para proximo dia', async () => {
      const start = new Date('2025-06-02T18:00:00');
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');
      expect(result).toEqual(new Date('2025-06-03T10:00:00'));
    });

    it('calcula calendário do tenant no fuso configurado, não no UTC do servidor', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      mockPrisma.businessCalendar.findMany.mockResolvedValue([]);
      const start = new Date('2026-06-01T02:00:00Z'); // Domingo 23h no fuso local.
      const result = await service.calculateTargetDate(start, 2, 'tenant-1');

      expect(result).toEqual(new Date('2026-06-01T05:00:00Z')); // Segunda 02h local, após duas horas úteis.
    });
  });

  // ============================================================
  // calculateBusinessPauseDuration
  // ============================================================
  describe('calculateBusinessPauseDuration', () => {
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      mockPrisma.businessCalendar.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isWorkDay: dayOfWeek > 0 && dayOfWeek < 6,
          startTime: '08:00',
          endTime: '18:00',
        })),
      );
    });

    it('calcula pausa dentro do mesmo dia util', async () => {
      const start = new Date('2025-06-02T10:00:00');
      const end = new Date('2025-06-02T14:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
      expect(result).toBe(240);
    });

    it('calcula pausa que atravessa para o dia seguinte', async () => {
      const start = new Date('2025-06-02T16:00:00');
      const end = new Date('2025-06-03T10:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
      expect(result).toBe(240);
    });

    it('calcula pausa que atravessa fim de semana', async () => {
      const start = new Date('2025-06-06T16:00:00');
      const end = new Date('2025-06-09T10:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
      expect(result).toBe(240);
    });

    it('retorna zero quando pausa ocorre apenas no fim de semana', async () => {
      const start = new Date('2025-06-07T10:00:00');
      const end = new Date('2025-06-08T14:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
      expect(result).toBe(0);
    });

    it('pausa iniciada apos o expediente conta apenas proximo dia', async () => {
      const start = new Date('2025-06-02T19:00:00');
      const end = new Date('2025-06-03T09:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
      expect(result).toBe(60);
    });

    it('pausa de 10 horas uteis completas (um dia inteiro)', async () => {
      const start = new Date('2025-06-02T08:00:00');
      const end = new Date('2025-06-02T18:00:00');
      const result = await service.calculateBusinessPauseDuration(start, end, 'tenant-1');
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
        priority: Priority.NORMAL,
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

    it('política da prioridade vale quando o tipo não tem política (C-024)', async () => {
      const critica = makePolicy({ id: 'critica', priority: Priority.CRITICA, hours: 4 });
      const normal = makePolicy({ id: 'normal', priority: Priority.NORMAL, hours: 24 });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([normal, critica]);
      await expect(
        service.findApplicablePolicy('tenant-1', Priority.CRITICA, ServiceOrderType.LENTIDAO),
      ).resolves.toEqual(critica);
      await expect(
        service.findApplicablePolicy('tenant-1', Priority.BAIXA, ServiceOrderType.LENTIDAO),
      ).resolves.toEqual(normal);
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
        priority: Priority.NORMAL,
        serviceOrderType: null,
        hours: 72,
      });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([policy]);

      const result = await service.findApplicablePolicy('tenant-1', Priority.BAIXA);

      expect(result).toEqual(policy);
    });
    it('prioridade crítica usa a política crítica (decisão C-024 de 04/11)', async () => {
      const normal = makePolicy({ priority: Priority.NORMAL, serviceOrderType: null, hours: 48 });
      const critical = makePolicy({ priority: Priority.CRITICA, serviceOrderType: null, hours: 4 });
      mockPrisma.slaPolicy.findMany.mockResolvedValue([critical, normal]);
      expect(await service.findApplicablePolicy('tenant-1', Priority.CRITICA)).toEqual(critical);
    });
  });
});
