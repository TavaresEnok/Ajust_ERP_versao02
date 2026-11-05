'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useErpQuery } from '@/lib/erp/gateway';
import { QueryState } from './contract-form';
import { PageHeading } from './primitives';
type ArchivedProcess = {
  id: string;
  status: string;
  definition: { name: string; nodes: { id: string; name: string }[] };
  occurrence: { number: string; provider: string };
  state: {
    history: {
      nodeId: string;
      enteredAt: string;
      completedAt?: string;
      outcome?: string;
      evidence?: Record<string, string>;
    }[];
    events: { type: string; at: string; reason: string }[];
  };
};
export function ServiceProcessesPage({ id, base = '/gerencia' }: { id?: string; base?: string }) {
  const [selected, setSelected] = useState(id || '');
  const list = useErpQuery<ArchivedProcess[]>('/service-processes');
  const detail = useErpQuery<ArchivedProcess>(selected ? `/service-processes/${selected}` : null);
  const record = detail.data;
  return (
    <>
      <PageHeading
        title="Histórico de processos antigos"
        description="Consulta preservada. Novos atendimentos usam os processos operacionais."
      >
        <Link className="text-link" href={`${base}/processos`}>
          Processos operacionais
        </Link>
      </PageHeading>
      <QueryState
        loading={list.isLoading}
        error={list.error}
        onRetry={() => {
          void list.mutate();
        }}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          {!list.data?.length && <p>Nenhum processo antigo registrado.</p>}
          {list.data?.map((p) => (
            <button className="block p-3 text-left" key={p.id} onClick={() => setSelected(p.id)}>
              {p.occurrence.number} · {p.occurrence.provider} · {p.definition.name}
            </button>
          ))}
        </section>
        {selected && (
          <section className="panel space-y-4 p-5">
            <QueryState
              loading={detail.isLoading}
              error={detail.error}
              onRetry={() => {
                void detail.mutate();
              }}
            />
            {record && (
              <>
                <h2 className="section-title">{record.definition.name}</h2>
                <p>
                  {record.occurrence.number} · {record.occurrence.provider}
                </p>
                {record.state.history.map((visit, index) => (
                  <div key={index} className="border-b p-3">
                    <p>
                      {record.definition.nodes.find((n) => n.id === visit.nodeId)?.name ||
                        visit.nodeId}
                    </p>
                    <p>
                      {new Date(visit.enteredAt).toLocaleString('pt-BR')} ·{' '}
                      {visit.outcome || 'Sem resultado registrado'}
                    </p>
                    {Object.entries(visit.evidence || {}).map(([key, value]) => (
                      <p key={key}>
                        {key}: {value}
                      </p>
                    ))}
                  </div>
                ))}
                {record.state.events.map((event, index) => (
                  <p key={index}>
                    {new Date(event.at).toLocaleString('pt-BR')} · {event.reason}
                  </p>
                ))}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
