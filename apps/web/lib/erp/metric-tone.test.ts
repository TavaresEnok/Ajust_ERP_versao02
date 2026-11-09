import { describe, expect, it } from 'vitest';
import { metricTone } from '@/components/erp/primitives';

describe('metricTone: mesma cor para o mesmo assunto em todas as telas', () => {
  it.each([
    ['O.S. atrasadas', 'danger'],
    ['Violações de SLA', 'danger'],
    ['Prioridade crítica', 'danger'],
    ['Pendentes agora', 'warning'],
    ['Vencem em até 2h', 'warning'],
    ['Total abertas', 'warning'],
    ['Entregas no período', 'success'],
    ['Cumprimento de SLA', 'success'],
    ['Concluídas no mês', 'success'],
    ['Sessões ativas', 'neutral'],
    ['Cache Redis', 'neutral'],
    ['Ordens de serviço', 'info'],
    ['Tempo médio de resolução', 'info'],
  ])('%s → %s', (label, tone) => {
    expect(metricTone(label)).toBe(tone);
  });
});
