'use client';
import { useState } from 'react';
import { type WorkflowDefinition } from '@/lib/erp/contracts';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { OperationControl } from './operation-controls';
import { displayValue } from './resource-page';
import { PanelHeading } from './primitives';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) || 'undefined';
}
function differences(before: WorkflowDefinition, after: WorkflowDefinition) {
  const changes: string[] = [];
  for (const key of ['nodes', 'edges'] as const) {
    const oldItems = before[key];
    const newItems = after[key];
    for (const item of oldItems)
      if (!newItems.some((row) => row.id === item.id))
        changes.push(`${key === 'nodes' ? 'Nó' : 'Conexão'} removido: ${item.id}`);
    for (const item of newItems) {
      const previous = oldItems.find((row) => row.id === item.id);
      if (!previous) changes.push(`${key === 'nodes' ? 'Nó' : 'Conexão'} adicionado: ${item.id}`);
      else if (canonical(previous) !== canonical(item))
        changes.push(
          `${key === 'nodes' ? 'Nó' : 'Conexão'} alterado: ${item.id} · ${Object.keys(item)
            .filter(
              (field) =>
                canonical(previous[field as keyof typeof previous]) !==
                canonical(item[field as keyof typeof item]),
            )
            .join(', ')}`,
        );
    }
  }
  if (canonical(before.governance) !== canonical(after.governance))
    changes.push('Governança alterada.');
  return changes;
}
export function WorkflowVersions({
  id,
  definition,
  current,
  onSaved,
}: {
  id?: string;
  definition: WorkflowDefinition;
  current: { name: string; description?: string };
  onSaved: () => Promise<void>;
}) {
  const versions = Array.isArray(definition.versions)
    ? definition.versions.filter(
        (version) =>
          Number.isInteger(version.version) &&
          Array.isArray(version.definition?.nodes) &&
          Array.isArray(version.definition?.edges),
      )
    : [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('current');
  const source = versions.find((version) => String(version.version) === from);
  const target =
    to === 'current'
      ? { ...current, definition }
      : versions.find((version) => String(version.version) === to);
  const changes =
    source && target
      ? [
          ...(source.name !== target.name ? ['Nome alterado.'] : []),
          ...(source.description !== target.description ? ['Descrição alterada.'] : []),
          ...differences(source.definition, target.definition),
        ]
      : [];
  return (
    <section className="panel">
      <PanelHeading
        title="Histórico de versões"
        description="Snapshots retornados em definition.versions; a comparação não revela valores de configurações ou segredos."
      />
      <div className="flex flex-col gap-5 px-6 pb-6">
        {!versions.length ? (
          <p className="text-xs text-muted-foreground">
            {id
              ? 'Nenhuma versão anterior retornada pelo ERP.'
              : 'Salve e atualize um workflow no ERP para gerar histórico. O rascunho não cria versões.'}
          </p>
        ) : (
          <>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="version-from">Comparar da versão</FieldLabel>
                <select
                  id="version-from"
                  className="native-select"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {versions.map((version) => (
                    <option key={version.version} value={String(version.version)}>
                      Versão {version.version} · {displayValue(version.createdAt)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="version-to">Com a versão</FieldLabel>
                <select
                  id="version-to"
                  className="native-select"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                >
                  <option value="current">Atual / rascunho aberto</option>
                  {versions.map((version) => (
                    <option key={version.version} value={String(version.version)}>
                      Versão {version.version}
                    </option>
                  ))}
                </select>
              </Field>
            </FieldGroup>
            {source && target && (
              <div className="rounded-lg border border-border p-4" role="status">
                <h3 className="section-title mb-3">Diferenças estruturais</h3>
                {changes.length ? (
                  <ul className="flex flex-col gap-2 text-xs">
                    {changes.map((change, index) => (
                      <li className="break-all" key={index}>
                        {change}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma diferença nos campos comparados.
                  </p>
                )}
              </div>
            )}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Versão</th>
                    <th>Nome</th>
                    <th>Data</th>
                    <th>Autor</th>
                    <th>Nós / conexões</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.version}>
                      <td>{version.version}</td>
                      <td>{version.name}</td>
                      <td>{displayValue(version.createdAt)}</td>
                      <td>{displayValue(version.createdBy)}</td>
                      <td>
                        {version.definition.nodes.length} / {version.definition.edges.length}
                      </td>
                      <td>
                        {id && (
                          <OperationControl
                            title={`Reverter à versão ${version.version}`}
                            description="O servidor restaura este snapshot e registra a alteração. Rascunhos não enviados serão substituídos após a confirmação."
                            path={`/workflows/${encodeURIComponent(id)}/rollback`}
                            body={{ version: version.version }}
                            roles={['super_admin', 'gerente']}
                            after={onSaved}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
