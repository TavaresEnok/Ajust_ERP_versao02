import { PILOT_DEFINITIONS } from './pilot-definitions';
import { nextVisit, ProcessState, validateDefinition } from './process-definition';
import { commentText, sgpDate } from './import-sgp-pilot';

describe('Human process definitions and migration normalization', () => {
  it.each(PILOT_DEFINITIONS.map((d) => [d.code, d] as const))(
    '%s is connected and can finish',
    (_, def) => {
      expect(validateDefinition(def).nodes.length).toBeGreaterThan(5);
    },
  );
  it('rejects missing destinations and disconnected work', () => {
    const def = structuredClone(PILOT_DEFINITIONS[0]);
    def.nodes[0].routes = { next: 'missing' };
    expect(() => validateDefinition(def)).toThrow('Destino inexistente');
  });
  it('rejects a closed cycle with no route to an end', () => {
    const def = structuredClone(PILOT_DEFINITIONS[0]);
    def.nodes = def.nodes.slice(0, 2);
    def.nodes[0].routes = { next: def.nodes[1].id };
    def.nodes[1].routes = { retry: def.nodes[0].id };
    expect(() => validateDefinition(def)).toThrow('sem caminho');
  });
  it('creates a distinct visit and clock on a return to a prior stage', () => {
    const state: ProcessState = {
      current: null,
      events: [],
      history: [
        {
          nodeId: 'triagem',
          attempt: 1,
          enteredAt: '2026-01-01T00:00:00Z',
          dueAt: '2026-01-01T01:00:00Z',
        },
      ],
    };
    const visit = nextVisit(
      PILOT_DEFINITIONS[0],
      state,
      'triagem',
      new Date('2026-10-20T12:00:00Z'),
    );
    expect(visit.attempt).toBe(2);
    expect(visit.dueAt).toBe('2026-10-20T12:15:00.000Z');
  });
  it('preserves source local time consistently across two date formats', () => {
    expect(sgpDate('19/10/2026 17:53:35', 'America/Fortaleza')?.toISOString()).toBe(
      '2026-10-19T20:53:35.000Z',
    );
    expect(sgpDate('2026-10-19T17:53:35', 'America/Fortaleza')?.toISOString()).toBe(
      '2026-10-19T20:53:35.000Z',
    );
    expect(sgpDate('2026-10-19T17:53:35Z', 'America/Fortaleza')?.toISOString()).toBe(
      '2026-10-19T17:53:35.000Z',
    );
    expect(() => sgpDate('invalid', 'America/Fortaleza')).toThrow('Data SGP inválida');
  });
  it('preserves commands and paragraphs without rendering source scripts', () => {
    expect(commentText('<p>Teste</p><script>alert(1)</script><pre>a &lt; 2\nb &gt; 3</pre>')).toBe(
      'Teste\na < 2\nb > 3',
    );
  });
});
