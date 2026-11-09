'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useErpQuery } from '@/lib/erp/gateway';
import { occurrenceStatuses, orderStatuses, type ErpRecord } from '@/lib/erp/contracts';
import { useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, StatusBadge } from './primitives';
import { QueryState } from './contract-form';
import { RecordWorkspace } from './record-workspace';
import { OrderForm } from './order-form';
import { Button } from '@/components/ui/button';
import { useErpAction } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import type { FlowInstance } from '@/lib/erp/operational-flow';
import { ExecutionTracking } from './execution-tracking';

function OccurrenceFlow({ id, base }: { id: string; base: string }) {
  const flow = useErpQuery<FlowInstance>(`/service-processes/operational/${id}`);
  return (
    <>
      <QueryState loading={flow.isLoading} error={flow.error} onRetry={() => void flow.mutate()} />
      {flow.data && <ExecutionTracking instance={flow.data} base={base} />}
    </>
  );
}

function FlowDisclosure({ id, base, label }: { id: string; base: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="panel mb-4 p-5" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-semibold">
        Acompanhar etapas · {label}
      </summary>
      {open && (
        <div className="mt-5">
          <OccurrenceFlow id={id} base={base} />
        </div>
      )}
    </details>
  );
}

export function OccurrenceAttendance({ id, initialTab }: { id: string; initialTab?: string }) {
  const base = useRouteBase();
  const action = useErpAction();
  const [closing, setClosing] = useState(false);
  const [conclusion, setConclusion] = useState('');
  const [closeError, setCloseError] = useState('');
  const query = useErpQuery<ErpRecord>(`/service-orders/occurrences/${id}`);
  const customers = useErpQuery<ErpRecord[]>('/customers');
  const [tab, setTab] = useState(
    initialTab && !['Ordens vinculadas', 'Resumo'].includes(initialTab) ? initialTab : 'Anotações',
  );
  const record = query.data;
  const orders = (Array.isArray(record?.serviceOrders) ? record.serviceOrders : []) as ErpRecord[];
  const pendingOrders = orders.filter((o) => !['FECHADA', 'CANCELADA'].includes(String(o.status)));
  const flows = [
    ...new Map(
      orders
        .filter((o) => o.processInstanceId)
        .map((o) => [String(o.processInstanceId), String(o.protocol)]),
    ).entries(),
  ];
  const customer = customers.data?.find(
    (c) => c.id === record?.customerId || c.tradeName === record?.provider,
  );
  return (
    <>
      <nav
        aria-label="Caminho do atendimento"
        className="mb-5 flex flex-wrap gap-2 text-xs text-muted-foreground"
      >
        <Link className="text-link" href={`${base}/provedores`}>
          Provedores
        </Link>
        <span>›</span>
        {customer ? (
          <Link className="text-link" href={`${base}/provedores/${customer.id}`}>
            {String(record?.provider)}
          </Link>
        ) : (
          <span>{String(record?.provider || 'Provedor')}</span>
        )}
        <span>›</span>
        <span>Ocorrência {String(record?.number || '')}</span>
      </nav>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {record && (
        <>
          <PageHeading
            title={`Ocorrência ${record.number} · ${record.type}`}
            description={String(record.provider)}
          >
            <StatusBadge
              status={
                occurrenceStatuses[String(record.status) as keyof typeof occurrenceStatuses] ||
                String(record.status)
              }
            />
            <OrderForm
              occurrence={{
                id,
                provider: String(record.provider),
                sector: String(record.sector || ''),
                origin: String(record.origin || ''),
              }}
              onCreated={query.mutate}
            />
          </PageHeading>
          <section className="panel mb-5 p-6">
            <h2 className="section-title mb-3">Demanda do provedor</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {String(record.description)}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {orders.length} O.S. · {orders.filter((o) => o.status === 'FECHADA').length} fechadas
              · {orders.filter((o) => !['FECHADA', 'CANCELADA'].includes(String(o.status))).length}{' '}
              em atendimento
            </p>
            {pendingOrders.length > 0 && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-4 text-sm text-warning"
              >
                <p className="font-medium">
                  Este atendimento tem {pendingOrders.length} O.S. pendente(s).
                </p>
                <p className="mt-1">
                  A ocorrência será encerrada quando todas as entregas obrigatórias terminarem.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {pendingOrders.map((o) => (
                    <Link key={String(o.id)} className="underline" href={`${base}/ordens/${o.id}`}>
                      {String(o.protocol)} · {String(o.analystName || 'Sem responsável')}
                      {o.pausedAt
                        ? ` · Pausada: ${String(o.pauseReason || 'aguardando liberação')}`
                        : o.scheduledAt
                          ? ` · Agendada: ${new Date(String(o.scheduledAt)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`
                          : ` · ${String(o.title)}`}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {record.status !== 'ENCERRADA' && (
              <div className="mt-4 space-y-3">
                <Button variant="outline" onClick={() => setClosing(!closing)}>
                  Encerrar ocorrência
                </Button>
                {closing && (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm">
                      {pendingOrders.length
                        ? `Deseja concluir também estas ${pendingOrders.length} O.S.: ${pendingOrders.map((o) => o.protocol).join(', ')}? Confirme somente trabalhos efetivamente realizados. Novas entregas geradas pelo fluxo precisarão de conclusão própria.`
                        : 'Todas as O.S. foram encerradas. Registre a conclusão do atendimento.'}
                    </p>
                    <textarea
                      aria-label="Conclusão da ocorrência"
                      className="native-select min-h-24 w-full"
                      maxLength={20000}
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      placeholder="Resultado dos trabalhos e conclusão"
                    />
                    <Button
                      disabled={action.pending || conclusion.trim().length < 3}
                      onClick={async () => {
                        try {
                          setCloseError('');
                          const result = await action.execute<ErpRecord>({
                            path: `/service-orders/occurrences/${id}/close`,
                            method: 'POST',
                            body: {
                              reason: conclusion,
                              orders: pendingOrders.map((o) => ({ id: o.id, version: o.version })),
                            },
                          });
                          if (result.status === 'ENCERRADA') {
                            setClosing(false);
                            setConclusion('');
                          } else
                            setCloseError(
                              'As conclusões foram registradas. Ainda existem entregas do fluxo a executar; consulte a lista atualizada.',
                            );
                        } catch (e) {
                          setCloseError(errorMessage(e));
                        } finally {
                          await query.mutate();
                        }
                      }}
                    >
                      Confirmar conclusão
                    </Button>
                    {closeError && (
                      <p role="alert" className="text-sm text-danger">
                        {closeError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="panel mb-6 overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="section-title">Ordens desta ocorrência · {orders.length} O.S.</h2>
            </div>
            {orders.length === 1 && (
              <div className="p-5 space-y-2">
                <p className="font-medium">{String(orders[0].title)}</p>
                <p className="text-sm text-muted-foreground">
                  {String(orders[0].analystName || 'Sem responsável')} ·{' '}
                  {orderStatuses[String(orders[0].status) as keyof typeof orderStatuses] ||
                    String(orders[0].status)}
                </p>
                <Link className="text-link inline-block" href={`${base}/ordens/${orders[0].id}`}>
                  Abrir trabalho · {String(orders[0].protocol)} →
                </Link>
              </div>
            )}
            <div className={orders.length === 1 ? 'hidden' : 'overflow-x-auto'}>
              <table className="data-table w-full">
                <thead>
                  <tr>
                    {['O.S.', 'Trabalho', 'Analista responsável', 'Status', 'Prazo', ''].map(
                      (h, i) => (
                        <th key={i}>{h}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={String(o.id)}>
                      <td>
                        <Link className="text-link" href={`${base}/ordens/${o.id}`}>
                          {String(o.protocol)}
                        </Link>
                      </td>
                      <td>{String(o.title)}</td>
                      <td>{String(o.analystName || 'Não atribuído')}</td>
                      <td>
                        <StatusBadge
                          status={
                            orderStatuses[String(o.status) as keyof typeof orderStatuses] ||
                            String(o.status)
                          }
                        />
                      </td>
                      <td>
                        {o.slaEligible === false
                          ? 'Sem prazo de SLA'
                          : o.deadlineAt
                            ? new Date(String(o.deadlineAt)).toLocaleString('pt-BR', {
                                timeZone: 'America/Fortaleza',
                              })
                            : 'Não informado'}
                      </td>
                      <td>
                        <Link
                          className="text-link whitespace-nowrap"
                          href={`${base}/ordens/${o.id}`}
                        >
                          Abrir O.S. →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!orders.length && (
              <p className="p-6 text-sm text-muted-foreground">
                Nenhuma O.S. vinculada. Use Adicionar O.S. para registrar o primeiro trabalho.
              </p>
            )}
          </section>
          {base !== '/cliente' &&
            flows.map(([flowId, label]) => (
              <FlowDisclosure key={flowId} id={flowId} base={base} label={label} />
            ))}
          <section className="panel min-w-0 overflow-hidden">
            <RecordWorkspace
              key={id}
              kind="occurrences"
              id={id}
              base={base}
              embedded
              showTabs
              activeTab={tab}
              onTabChange={setTab}
              initialTab={tab}
            />
          </section>
        </>
      )}
    </>
  );
}
