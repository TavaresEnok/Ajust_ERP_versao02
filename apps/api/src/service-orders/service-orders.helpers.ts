/**
 * Helpers compartilhados de ServiceOrders.
 *
 * Extraídos do `service-orders.service.ts` na Sprint 2 do plano de melhorias
 * (Fase 8 — Manutenibilidade) para reduzir acoplamento e facilitar testes.
 */

/**
 * Normaliza um valor para uma célula CSV: escapa vírgulas, aspas e quebras de linha.
 */
export function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * Remove entradas com valor `undefined` de um objeto. Útil para montar
 * payloads parciais para `prisma.update`.
 */
export function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/**
 * Reduz uma lista `{ key, count }` em um mapa indexado por `key`, com
 * defaults em zero para todas as chaves esperadas.
 */
export function reduceCountRows<T extends string>(
  rows: Array<{ key: T; count: number }>,
  keys: T[],
): Record<T, number> {
  const base = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const row of rows) {
    base[row.key] = row.count;
  }
  return base;
}
