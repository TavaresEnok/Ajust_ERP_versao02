import { resolve } from 'node:path';
import { validatePathWithinBase } from './path-security';

describe('validatePathWithinBase', () => {
  it('resolves a path inside upload root', () => {
    expect(validatePathWithinBase('/uploads', 'tenant/report.csv')).toBe(
      resolve('/uploads/tenant/report.csv'),
    );
  });

  it.each(['../secret.txt', '/etc/passwd'])('rejects path traversal: %s', (target) => {
    expect(() => validatePathWithinBase('/uploads', target)).toThrow(
      'Refusing to access a path outside',
    );
  });
});
