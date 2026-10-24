import { storedProcessDefinition, storedProcessRecord } from './stored-process-roles';
import { makeOperationalDefinition, validateOperational } from './operational-definition';
describe('stored process role compatibility after profile consolidation', () => {
  it('maps historical technician grants to analyst without changing the saved version', () => {
    const original = {
      version: 7,
      nodes: [{ id: 'task', roles: ['gerente', 'tecnico', 'analista'] }],
    };
    expect(storedProcessDefinition(original)).toEqual({
      version: 7,
      nodes: [{ id: 'task', roles: ['gerente', 'analista'] }],
    });
    expect(original.nodes[0].roles).toContain('tecnico');
  });
  it('does not escalate a removed read-only grant into analyst or customer', () => {
    expect(storedProcessDefinition({ nodes: [{ roles: ['leitura'] }] }).nodes[0].roles).toEqual([]);
  });
  it('projects definitions and drafts but preserves unrelated historical data', () => {
    const result = storedProcessRecord({
      definition: { nodes: [{ roles: ['tecnico'] }] },
      draft: { nodes: [{ roles: ['analista', 'tecnico'] }] },
      state: { originalRole: 'tecnico' },
    });
    expect(result.definition.nodes[0].roles).toEqual(['analista']);
    expect(result.draft.nodes[0].roles).toEqual(['analista']);
    expect(result.state.originalRole).toBe('tecnico');
  });
  it('rejects retired roles in NEW definitions, while historical execution remains readable', () => {
    const legacy = makeOperationalDefinition('DNS');
    (legacy.nodes[0].roles as string[]) = ['tecnico'];
    expect(() => validateOperational(legacy)).toThrow();
    expect(validateOperational(storedProcessDefinition(legacy)).nodes[0].roles).toEqual([
      'analista',
    ]);
  });
});
