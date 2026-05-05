/**
 * Path Security Utilities
 * 
 * Prevenção contra path traversal attacks (../../../etc/passwd)
 */

import { resolve, relative } from 'node:path';
import { ForbiddenException } from '@nestjs/common';

/**
 * Valida que um caminho está dentro de um diretório base
 * Previne path traversal attacks
 * 
 * @param basePath - Diretório raiz permitido
 * @param targetPath - Caminho que precisa ser validado
 * @returns Caminho absoluto normalizado
 * @throws ForbiddenException se path traversal é detectado
 */
export function validatePathWithinBase(basePath: string, targetPath: string): string {
  // Normalizar ambos os caminhos
  const normalizedBase = resolve(basePath);
  const normalizedTarget = resolve(normalizedBase, targetPath);

  // Verificar que o caminho normalizado ainda está dentro de basePath
  const relative_ = relative(normalizedBase, normalizedTarget);

  if (relative_.startsWith('..') || relative_.startsWith('/')) {
    throw new ForbiddenException(
      'Path traversal detectado. Acesso a arquivo negado.'
    );
  }

  return normalizedTarget;
}

/**
 * Simples validação para detectar padrões comuns de path traversal
 */
export function hasPathTraversalPatterns(path: string): boolean {
  const dangerous = ['..', '~', '/etc', '\\\\', '%2e%2e', '..\\'];
  return dangerous.some(pattern => path.includes(pattern));
}

/**
 * Sanitiza nome de arquivo removendo caracteres perigosos
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w\s\-./]/g, '') // Remove caracteres especiais
    .replace(/\.\./g, '')         // Remove ..
    .replace(/\/\//g, '/')        // Remove //
    .trim();
}
