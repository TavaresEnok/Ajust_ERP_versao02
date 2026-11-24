'use client';
import Link from 'next/link';
import {
  FLOW_TRANSITION_NOTE,
  orderStatuses,
  priorities,
  transitionOptions,
  type ErpRecord,
} from '@/lib/erp/contracts';
import { StatusBadge } from './primitives';
import { OperationControl } from './operation-controls';
import { displayValue } from './resource-page';
export function OrderBoard({
  records,
  base,
  refresh,
}: {
  records: ErpRecord[];
  base: string;
  refresh: () => Promise<unknown>;
}) {
  const unknown = records.filter((row) => !(String(row.status) in orderStatuses));
  const columns = [
    ...Object.entries(orderStatuses),
    ...(unknown.length ? [['unknown', 'Status não reconhecido']] : []),
  ];
  return (
    <>
      <p className="px-5 pb-4 text-xs text-muted-foreground">
        Quadro dos registros desta página e filtros. Mudar etapa exige justificativa e confirmação
        do servidor; não há movimentação simulada.
      </p>
      <div
        className="flex gap-4 overflow-x-auto px-5 pb-5"
        tabIndex={0}
        aria-label="Quadro de ordens por etapa"
      >
        {columns.map(([status, label]) => {
          const rows =
            status === 'unknown' ? unknown : records.filter((row) => row.status === status);
          return (
            <section
              key={status}
              className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
              aria-label={label}
            >
              <h3 className="flex items-center justify-between text-xs font-medium">
                {label}
                <span className="text-muted-foreground">{rows.length}</span>
              </h3>
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <Link
                    className="text-link"
                    href={`${base}/operacoes/orders/${encodeURIComponent(row.id)}`}
                  >
                    {displayValue(row.protocol || row.id)}
                  </Link>
                  <p className="text-xs leading-5">{displayValue(row.title)}</p>
                  <StatusBadge
                    status={
                      priorities[row.priority as keyof typeof priorities] ||
                      displayValue(row.priority)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Prazo: {displayValue(row.deadlineAt)}
                  </p>
                  {base !== '/cliente' &&
                    Object.keys(transitionOptions(row.status, !!row.processInstanceId)).length >
                      0 && (
                      <OperationControl
                        title="Alterar etapa"
                        description={
                          row.processInstanceId
                            ? FLOW_TRANSITION_NOTE
                            : 'O ERP valida as transições permitidas e a versão da ordem antes de salvar.'
                        }
                        path={`/service-orders/${encodeURIComponent(row.id)}/transition`}
                        method="PATCH"
                        roles={['super_admin', 'gerente', 'analista']}
                        body={
                          typeof row.version === 'number'
                            ? { expectedVersion: row.version }
                            : undefined
                        }
                        fields={[
                          {
                            name: 'toStatus',
                            label: 'Etapa de destino',
                            options: transitionOptions(row.status, !!row.processInstanceId),
                            required: true,
                          },
                          {
                            name: 'reason',
                            label: 'Justificativa',
                            type: 'textarea',
                            required: true,
                            min: 3,
                          },
                        ]}
                        after={refresh}
                      />
                    )}
                </article>
              ))}
              {!rows.length && (
                <p className="py-5 text-xs text-muted-foreground">Sem ordens nesta página.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
