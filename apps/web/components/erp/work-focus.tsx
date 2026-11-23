'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouteBase } from '@/lib/erp/visual-data';
import { orderStatuses, type ErpRecord } from '@/lib/erp/contracts';
import { Button } from '@/components/ui/button';
import { PageHeading, StatusBadge } from './primitives';
import { QueryState } from './contract-form';
import { OrderForm } from './order-form';
import { useOperationalQueue, useOperationalSummary } from '@/lib/erp/use-operational-orders';

const date = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
    : 'Não definido';

export function WorkFocus({ analyst = false }: { analyst?: boolean }) {
  const base = useRouteBase();
  const [filter, setFilter] = useState<'active' | 'urgent' | 'scheduled' | 'paused'>('active');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const scope = analyst ? 'mine' : 'operation';
  const summary = useOperationalSummary(scope);
  const queue = useOperationalQueue(scope, {
    focus: filter,
    limit: 10,
    offset: page * 10,
  });

  const totals = summary.data?.totals;
  const counts: Record<typeof filter, number> = {
    active: totals?.totalActive ?? 0,
    urgent: totals?.urgent ?? 0,
    scheduled: totals?.scheduled ?? 0,
    paused: totals?.paused ?? 0,
  };
  const totalSelected = queue.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSelected / 10));
  const currentPage = Math.min(page, totalPages - 1);
  const items = queue.data?.items || [];

  const late = (o: ErpRecord) =>
    !o.pausedAt &&
    o.slaEligible !== false &&
    !!o.deadlineAt &&
    new Date(String(o.deadlineAt)).getTime() < now;
  const scheduled = (o: ErpRecord) => !!o.scheduledAt && !o.scheduleStartedAt;

  const labels: Record<typeof filter, string> = {
    active: analyst ? 'Meu trabalho pendente' : 'Atendimentos pendentes',
    urgent: 'Críticas ou atrasadas',
    scheduled: 'Execuções agendadas',
    paused: 'Pausadas',
  };

  async function refresh() {
    await Promise.allSettled([summary.mutate(), queue.mutate()]);
  }

  return (
    <>
      <PageHeading
        title={analyst ? 'Meu trabalho' : 'Acompanhamento da operação'}
        description={
          analyst
            ? 'Veja o que precisa de você e abra a O.S. para continuar.'
            : 'Identifique impedimentos, prazos e distribuição do trabalho.'
        }
      >
        <Button variant="outline" onClick={() => void refresh()}>
          Atualizar
        </Button>
        <Button onClick={() => setOpen(true)}>Novo atendimento</Button>
      </PageHeading>
      <QueryState
        loading={summary.isLoading || queue.isLoading}
        error={summary.error || queue.error}
        onRetry={() => void refresh()}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(labels) as [typeof filter, string][]).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
            className={`panel p-5 text-left focus-visible:outline-2 focus-visible:outline-primary ${filter === key ? 'border-primary' : ''}`}
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <strong className="mt-2 block text-3xl">
              {summary.data && !summary.error ? counts[key] : '—'}
            </strong>
          </button>
        ))}
      </div>
      <section className="panel mb-6 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="section-title">{labels[filter]}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === 'scheduled'
              ? 'Em ordem de horário combinado. Agendamento não pausa o prazo.'
              : 'Críticas e atrasadas primeiro; pausadas ao final. Inclui pendências antigas.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                {[
                  'O.S. e demanda',
                  ...(analyst ? [] : ['Responsável']),
                  'Situação',
                  'O que precisa de atenção',
                  '',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={String(o.id)}>
                  <td>
                    <Link className="text-link" href={`${base}/ordens/${o.id}`}>
                      {String(o.protocol)}
                    </Link>
                    <p className="mt-1">{String(o.title)}</p>
                    <p className="text-xs text-muted-foreground">{String(o.requester || '')}</p>
                  </td>
                  {!analyst && <td>{String(o.analystName || 'Sem responsável')}</td>}
                  <td>
                    <StatusBadge
                      status={
                        o.pausedAt
                          ? 'Pausada'
                          : orderStatuses[String(o.status) as keyof typeof orderStatuses] ||
                            String(o.status)
                      }
                    />
                  </td>
                  <td className="max-w-sm">
                    <p>
                      {o.pausedAt
                        ? String(o.pauseReason || 'Consulte a justificativa da pausa')
                        : scheduled(o)
                          ? `${new Date(String(o.scheduledAt)).getTime() < now ? 'Horário passou sem início registrado' : 'Execução agendada'} · ${date(o.scheduledAt)}`
                          : late(o)
                            ? `Prazo ultrapassado · ${date(o.deadlineAt)}`
                            : `Prazo · ${date(o.deadlineAt)}`}
                    </p>
                    {!!o.handoffNotes && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        Passagem: {String(o.handoffNotes)}
                      </p>
                    )}
                  </td>
                  <td>
                    <Link className="text-link whitespace-nowrap" href={`${base}/ordens/${o.id}`}>
                      {analyst ? 'Abrir trabalho →' : 'Ver atendimento →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {queue.data && !totalSelected && (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma O.S. neste grupo.</p>
        )}
        <div className="p-4 flex items-center justify-between text-xs">
          <span>
            {totalSelected} O.S. · página {currentPage + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage + 1 >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>
      {!analyst && (
        <section className="panel mb-6 p-5">
          <h2 className="section-title">Distribuição atual</h2>
          <p className="my-2 text-xs text-muted-foreground">
            Quantidade não mede esforço nem desempenho. Abra a equipe para avaliar e redistribuir.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(summary.data?.teamLoad || []).map((r) => (
              <div key={r.userId || r.name} className="rounded-lg border border-border p-3 text-sm">
                <strong>{r.name}</strong>
                <p>
                  {r.count} pendentes · {r.late} atrasadas
                </p>
              </div>
            ))}
          </div>
          <Link href={`${base}/tecnicos`} className="text-link mt-4 inline-block">
            Ver equipe →
          </Link>
        </section>
      )}
      <OrderForm open={open} onOpenChange={setOpen} onCreated={refresh} />
    </>
  );
}
