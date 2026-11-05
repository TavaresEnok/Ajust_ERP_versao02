'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useErp } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import { orderStatuses, type ErpRecord } from '@/lib/erp/contracts';
import { Button } from '@/components/ui/button';
import { PageHeading, StatusBadge } from './primitives';
import { QueryState } from './contract-form';
import { OrderForm } from './order-form';
import { isActiveOrder } from '@/lib/erp/analyst-workspace';
import { isDemonstration } from '@/lib/erp/management';

const date = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
    : 'Não definido';
export function WorkFocus({ analyst = false }: { analyst?: boolean }) {
  const { transport, scope } = useErp();
  const base = useRouteBase();
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const query = useSWR(
    transport && scope ? ['work-focus', scope.sessionKey, scope.tenantId, analyst] : null,
    async () => {
      const rows: ErpRecord[] = [];
      for (let offset = 0; offset < 10000; offset += 200) {
        const batch = await transport!.request<ErpRecord[]>({
          path: `/service-orders?scope=${analyst ? 'mine' : 'operation'}&limit=200&offset=${offset}`,
        });
        rows.push(...batch);
        if (batch.length < 200) return { rows, limited: false };
      }
      return { rows, limited: true };
    },
    { refreshInterval: 60000 },
  );
  const rows = [...new Map((query.data?.rows || []).map((o) => [o.id, o])).values()];
  const active = rows.filter((o) => isActiveOrder(o) && !isDemonstration(o));
  const late = (o: ErpRecord) =>
    !o.pausedAt &&
    o.slaEligible !== false &&
    !!o.deadlineAt &&
    new Date(String(o.deadlineAt)).getTime() < now;
  const scheduled = (o: ErpRecord) => !!o.scheduledAt && !o.scheduleStartedAt;
  const selections: Record<string, ErpRecord[]> = {
    active,
    urgent: active.filter((o) => o.priority === 'CRITICA' || late(o)),
    scheduled: active.filter(scheduled),
    paused: active.filter((o) => o.pausedAt),
  };
  const selected = selections[filter].slice().sort((a, b) => {
    if (filter === 'scheduled')
      return new Date(String(a.scheduledAt)).getTime() - new Date(String(b.scheduledAt)).getTime();
    const rank = (o: ErpRecord) =>
      o.priority === 'CRITICA' && !o.pausedAt ? 0 : late(o) ? 1 : o.pausedAt ? 4 : 2;
    return (
      rank(a) - rank(b) ||
      new Date(String(a.deadlineAt || '9999-01-01')).getTime() -
        new Date(String(b.deadlineAt || '9999-01-01')).getTime()
    );
  });
  const totalPages = Math.max(1, Math.ceil(selected.length / 10));
  const currentPage = Math.min(page, totalPages - 1);
  const labels: Record<string, string> = {
    active: analyst ? 'Meu trabalho pendente' : 'Atendimentos pendentes',
    urgent: 'Críticas ou atrasadas',
    scheduled: 'Execuções agendadas',
    paused: 'Pausadas',
  };
  const loads = new Map<string, { name: string; count: number; late: number }>();
  for (const o of active) {
    const key = String(o.assigneeUserId || 'none');
    const row = loads.get(key) || {
      name: String(o.analystName || 'Sem responsável'),
      count: 0,
      late: 0,
    };
    row.count++;
    if (late(o)) row.late++;
    loads.set(key, row);
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
        <Button variant="outline" onClick={() => void query.mutate()}>
          Atualizar
        </Button>
        <Button onClick={() => setOpen(true)}>Novo atendimento</Button>
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {query.data?.limited && (
        <p role="status" className="mb-4 text-sm">
          Recorte limitado às 10.000 O.S. mais recentes; os totais abaixo são desse recorte.
        </p>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(labels).map(([key, label]) => (
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
              {query.data && !query.error ? selections[key].length : '—'}
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
              {selected.slice(currentPage * 10, currentPage * 10 + 10).map((o) => (
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
        {query.data && !selected.length && (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma O.S. neste grupo.</p>
        )}
        <div className="p-4 flex items-center justify-between text-xs">
          <span>
            {selected.length} O.S. · página {currentPage + 1} de {totalPages}
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
            {[...loads.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([id, r]) => (
                <div key={id} className="rounded-lg border border-border p-3 text-sm">
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
      <OrderForm open={open} onOpenChange={setOpen} onCreated={query.mutate} />
    </>
  );
}
