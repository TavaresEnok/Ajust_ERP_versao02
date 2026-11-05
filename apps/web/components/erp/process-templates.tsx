'use client';
import { useErpQuery } from '@/lib/erp/gateway';
import { QueryState } from './contract-form';
import { PageHeading } from './primitives';
import type { ProcessTemplateInput } from '@/lib/erp/contracts';
export function ProcessTemplatesPage() {
  const query = useErpQuery<(ProcessTemplateInput & { id: string })[]>('/os-process-templates');
  return (
    <>
      <PageHeading
        title="Modelos antigos de O.S."
        description="Arquivo para consulta. Configure novas etapas e ordens dependentes nos processos operacionais."
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => {
          void query.mutate();
        }}
      />
      <section className="panel space-y-4 p-5">
        {!query.data?.length && <p>Nenhum modelo antigo registrado.</p>}
        {query.data?.map((template) => (
          <article key={template.id}>
            <h2 className="section-title">{template.name}</h2>
            {template.definition.childOrders.map((child) => (
              <p key={child.id}>
                {child.title} · {child.type}
              </p>
            ))}
          </article>
        ))}
      </section>
    </>
  );
}
