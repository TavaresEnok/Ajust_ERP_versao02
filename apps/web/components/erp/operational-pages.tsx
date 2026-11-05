'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useErpQuery } from '@/lib/erp/gateway';
import { listRecords, useRouteBase, useVisualSource } from '@/lib/erp/visual-data';
import type { ErpRecord } from '@/lib/erp/contracts';
import { PageHeading, StatusBadge, ViewLink } from './primitives';
import { QueryState } from './contract-form';
import { FlowReport } from './reports-workspace';
import { cn } from '@/lib/utils';
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleString('pt-BR') : '—');
export { TeamRosterPage as OnCallPage } from './team-roster';
export function OrderTrailPage() {
  const base = useRouteBase();
  const query = useVisualSource('orders');
  const [id, setId] = useState('');
  const selected = id ? query.rows.find((row) => row.id === id) : undefined;
  const raw = id ? query.raw.find((row) => row.id === id) : undefined;
  const events = Array.isArray(raw?.occurrences)
    ? (raw.occurrences as Record<string, unknown>[])
    : [];
  return (
    <>
      <PageHeading
        title="Trilha de ordens"
        description="Cada etapa visível. Do primeiro contato à entrega."
      >
        <select
          className="native-select max-w-full"
          aria-label="Selecionar ordem"
          value={id}
          onChange={(event) => setId(event.target.value)}
        >
          <option value="">Selecione uma ordem</option>
          {query.rows.map((row) => (
            <option value={row.id} key={row.id}>
              {String(row.protocol)} · {String(row.title)}
            </option>
          ))}
        </select>
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <section className="panel mb-6 p-6">
        {selected ? (
          <>
            <div className="mb-8 flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{String(selected.protocol)}</p>
                <h2 className="mt-2 text-lg font-semibold">{String(selected.title)}</h2>
              </div>
              <StatusBadge status={String(selected.status)} />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {events.map((event, index) => (
                <div
                  key={String(event.id || index)}
                  className={cn('rounded-xl border p-5', 'border-primary/20 bg-secondary/50')}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {index + 1}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-xs font-semibold">
                    {String(event.message || event.toStatus || 'Atualização')}
                  </h3>
                  <p className="mt-3 text-[10px] leading-6 text-muted-foreground">
                    {date(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            {!events.length && (
              <p className="text-xs text-muted-foreground">
                Nenhum evento retornado nesta consulta. Abra o histórico completo da ordem.
              </p>
            )}
            <div className="mt-7 flex justify-end">
              <ViewLink href={`${base}/ordens/${encodeURIComponent(id)}/historico`}>
                Abrir detalhes do atendimento
              </ViewLink>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Selecione uma ordem para consultar seu histórico. Nenhuma outra ordem é escolhida em seu
            lugar.
          </p>
        )}
      </section>
      <FlowReport />
    </>
  );
}
