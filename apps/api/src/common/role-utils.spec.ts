import { ACTIVE_ROLES, isActiveRole } from './role-utils';
describe('active access profiles', () => {
  it('contains only the four profiles requested by the Ajust owner', () => {
    expect(ACTIVE_ROLES).toEqual(['super_admin', 'gerente', 'analista', 'cliente']);
  });
  it.each(['super_admin', 'gerente', 'analista', 'cliente'])('accepts %s', (role) => {
    expect(isActiveRole(role)).toBe(true);
  });
  it.each(['tecnico', 'leitura', 'unknown', null, undefined])(
    'rejects retired or invalid profile %s',
    (role) => {
      expect(isActiveRole(role)).toBe(false);
    },
  );
});
