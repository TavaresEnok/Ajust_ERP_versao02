import { addRosterDays, isRosterDate, resolveRosterDay } from './roster-calendar';
import { TeamRosterController } from './team-roster.controller';
import { TeamRosterService } from './team-roster.service';
import { RequestWithAuth } from '../common/request-with-auth';

const policies = [
  { effectiveFrom: '2026-10-01', dayUserIds: ['dia-a', 'dia-b'], nightUserIds: ['noite-a'] },
  { effectiveFrom: '2026-11-01', dayUserIds: ['dia-c'], nightUserIds: ['noite-b'] },
];

describe('Escala da equipe: regras de calendário', () => {
  it('repete a equipe diurna nos dias úteis e a noturna todos os dias', () => {
    const friday = resolveRosterDay('2026-10-23', policies);
    const saturday = resolveRosterDay('2026-10-24', policies);
    const sunday = resolveRosterDay('2026-10-25', policies);
    expect(friday.dayUserIds).toEqual(['dia-a', 'dia-b']);
    expect(saturday.dayUserIds).toEqual([]);
    expect(sunday.dayUserIds).toEqual([]);
    expect([friday, saturday, sunday].map((day) => day.nightUserIds)).toEqual([
      ['noite-a'],
      ['noite-a'],
      ['noite-a'],
    ]);
    expect(saturday.dayPending).toBe(true);
  });

  it('usa a equipe programada para a data sem alterar a noite', () => {
    const day = resolveRosterDay('2026-10-25', policies, {
      date: '2026-10-25',
      userIds: ['dia-b', 'dia-c'],
    });
    expect(day.dayUserIds).toEqual(['dia-b', 'dia-c']);
    expect(day.nightUserIds).toEqual(['noite-a']);
    expect(day.daySource).toBe('programmed');
    expect(day.dayPending).toBe(false);
  });

  it('trata feriado em dia útil como pendente até ser programado', () => {
    const day = resolveRosterDay('2026-10-28', policies, undefined, 'Feriado local');
    expect(day.weekend).toBe(false);
    expect(day.dayUserIds).toEqual([]);
    expect(day.holidayName).toBe('Feriado local');
    expect(day.nightUserIds).toEqual(['noite-a']);
  });

  it('aceita indicação manual de feriado e preserva uma equipe explicitamente vazia', () => {
    const day = resolveRosterDay('2026-10-28', policies, {
      date: '2026-10-28',
      userIds: [],
      holidayName: 'Feriado municipal',
    });
    expect(day.dayPending).toBe(true);
    expect(day.dayUserIds).toEqual([]);
    expect(day.holidayName).toBe('Feriado municipal');
  });

  it('preserva a configuração anterior antes da data de vigência', () => {
    expect(resolveRosterDay('2026-10-30', policies).dayUserIds).toEqual(['dia-a', 'dia-b']);
    expect(resolveRosterDay('2026-11-02', policies).dayUserIds).toEqual(['dia-c']);
    expect(resolveRosterDay('2026-09-30', policies).nightPending).toBe(true);
  });

  it('valida datas reais e atravessa mês sem depender do fuso do processo', () => {
    expect(isRosterDate('2026-02-30')).toBe(false);
    expect(isRosterDate('2026-10-24')).toBe(true);
    expect(isRosterDate('24/10/2026')).toBe(false);
    expect(addRosterDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('Escala da equipe: permissões', () => {
  const request = (role: string) =>
    ({ auth: { role, tenantId: 't1', userId: 'u1' } }) as RequestWithAuth;
  const service = {
    read: jest.fn(),
    savePolicy: jest.fn(),
    saveDay: jest.fn(),
    restoreDay: jest.fn(),
  };
  const controller = new TeamRosterController(service as unknown as TeamRosterService);

  it('permite consulta pelo analista e impede consulta pelo cliente', () => {
    controller.read(request('analista'), '2026-10-19', '2026-10-25');
    expect(service.read).toHaveBeenCalledWith('t1', 'u1', '2026-10-19', '2026-10-25');
    expect(() => controller.read(request('cliente'), '2026-10-19', '2026-10-25')).toThrow(
      'Insufficient role',
    );
  });

  it('impede o analista de alterar equipes fixas, programar ou remover uma data', () => {
    expect(() => controller.savePolicy(request('analista'), {})).toThrow('Insufficient role');
    expect(() => controller.saveDay(request('analista'), '2026-10-24', {})).toThrow(
      'Insufficient role',
    );
    expect(() => controller.restoreDay(request('analista'), '2026-10-24', '1')).toThrow(
      'Insufficient role',
    );
    expect(service.savePolicy).not.toHaveBeenCalled();
    expect(service.saveDay).not.toHaveBeenCalled();
    expect(service.restoreDay).not.toHaveBeenCalled();
  });
});
