import { resolve, relative } from 'node:path';

export function validatePathWithinBase(basePath: string, targetPath: string): string {
  const normalizedBase = resolve(basePath);
  const normalizedTarget = resolve(normalizedBase, targetPath);
  const relativePath = relative(normalizedBase, normalizedTarget);

  if (relativePath.startsWith('..') || relativePath.startsWith('/')) {
    throw new Error('Refusing to access a path outside the configured upload root.');
  }

  return normalizedTarget;
}
