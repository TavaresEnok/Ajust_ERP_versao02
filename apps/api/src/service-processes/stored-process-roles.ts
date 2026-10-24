/** Compatibility for immutable historical workflow versions, not active access profiles.
 * Incoming definitions are validated against the current role schema WITHOUT this adapter.
 * A removed read-only role must never silently become an operational role.
 */
export function storedProcessDefinition<T>(definition: T): T {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return definition;
  const record = definition as Record<string, unknown>;
  if (!Array.isArray(record.nodes)) return definition;
  return {
    ...record,
    nodes: record.nodes.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const node = value as Record<string, unknown>;
      if (!Array.isArray(node.roles)) return value;
      return {
        ...node,
        roles: [
          ...new Set(
            node.roles
              .filter((role) => role !== 'leitura')
              .map((role) => (role === 'tecnico' ? 'analista' : role)),
          ),
        ],
      };
    }),
  } as T;
}

export function storedProcessRecord<T extends { definition: unknown; draft?: unknown }>(
  record: T,
): T {
  return {
    ...record,
    definition: storedProcessDefinition(record.definition),
    ...('draft' in record ? { draft: storedProcessDefinition(record.draft) } : {}),
  };
}
