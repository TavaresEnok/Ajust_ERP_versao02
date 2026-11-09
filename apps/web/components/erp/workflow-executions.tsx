'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useErpQuery } from '@/lib/erp/gateway';
import { workflowSubtypes } from '@/lib/erp/workflow';
import { QueryState } from './contract-form';

type Entry = {
  id: string;
  nodeId: string;
  nodeSubtype: string;
  status: string;
  createdAt: string;
  orderId: string | null;
  orderProtocol: string | null;
};
const stepNames: Record<string, string> = {
  ...workflowSubtypes.trigger,
  ...workflowSubtypes.condition,
  ...workflowSubtypes.action,
};
const statuses: Record<string, string> = {
  SUCCESS: 'Concluído',
  STARTED: 'Iniciada',
  ERROR: 'Falha',
  FAILED: 'Falha',
  SKIPPED: 'Ignorada',
};
export function WorkflowExecutions({ id }: { id: string }) {
  const query = useErpQuery<{ items: Entry[] }>(`/workflows/${encodeURIComponent(id)}/executions`);
  return (
    <section className="panel space-y-4 p-5" aria-label="Execuções recentes da automação">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Execuções recentes da automação</h2>
        <Button variant="outline" disabled={query.isValidating} onClick={() => void query.mutate()}>
          Atualizar execuções
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Últimos 50 registros de execução, do mais recente para o mais antigo. Uma execução pode
        registrar várias etapas. A conclusão da regra não confirma a entrega externa de mensagens.
      </p>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {query.data &&
        !query.error &&
        (query.data.items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data · Fortaleza</th>
                  <th>Etapa</th>
                  <th>O.S.</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {new Date(entry.createdAt).toLocaleString('pt-BR', {
                        timeZone: 'America/Fortaleza',
                      })}
                    </td>
                    <td>
                      {entry.nodeId === '__done__'
                        ? 'Execução concluída'
                        : entry.status === 'STARTED'
                          ? 'Início da execução'
                          : stepNames[entry.nodeSubtype] || 'Etapa da automação'}
                    </td>
                    <td>
                      {entry.orderId ? (
                        <Link className="text-link" href={`/gerencia/ordens/${entry.orderId}`}>
                          #{entry.orderProtocol || 'Abrir O.S.'}
                        </Link>
                      ) : (
                        'Sem O.S. vinculada'
                      )}
                    </td>
                    <td>{statuses[entry.status] || entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Nenhuma execução registrada. Ative a regra e aguarde o evento configurado para
            acompanhar os resultados aqui.
          </p>
        ))}
    </section>
  );
}
