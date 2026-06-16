import { ForbiddenException } from '@nestjs/common';
import { resolve } from 'node:path';
import { validatePathWithinBase } from './path-security';

describe('validatePathWithinBase', () => {
  it('resolves safe path inside base directory', () => {
    expect(validatePathWithinBase('/uploads', 'tenant/file.csv')).toBe(
      resolve('/uploads/tenant/file.csv'),
    );
  });

  it.each(['../secret', '/etc/passwd'])('rejects traversal %s', (path) => {
    expect(() => validatePathWithinBase('/uploads', path)).toThrow(ForbiddenException);
  });
});
