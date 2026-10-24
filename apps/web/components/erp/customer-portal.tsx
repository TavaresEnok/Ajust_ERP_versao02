'use client';
import { useDeferredValue, useState } from 'react';
import { copyToClipboard } from '@/lib/erp/clipboard';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useErpQuery } from '@/lib/erp/gateway';
import {
  orderStatuses,
  orderTypes,
  priorities,
  type OrderStatus,
  type OrderType,
  type PriorityCode,
} from '@/lib/erp/contracts';
import { Metric, PageHeading, PanelHeading, Priority, StatusBadge } from './primitives';
import { QueryState } from './contract-form';
import { cn } from '@/lib/utils';

type CustomerOrder = {
  id: string;
  protocol: string;
  title: string;
  type: OrderType;
  status: OrderStatus;
  priority: PriorityCode;
  createdAt: string;
  closedAt: string | null;
  analystName: string | null;
  deadlineAt: string | null;
  description?: string;
  occurrences?: { id: string; message: string; createdAt: string }[];
};
type PortalData = {
  customer: { tradeName: string; legalName: string; taxId: string };
  orders: CustomerOrder[];
  total: number;
  summary: {
    total: number;
    active: number;
    closed: number;
    entriesThisMonth: number;
    closedThisMonth: number;
  };
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('pt-BR', {
        timeZone: 'America/Fortaleza',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Não informado';

export function CustomerPortal({ section, id }: { section?: string; id?: string }) {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(0);
  const query = useErpQuery<PortalData>(
    !id && section !== 'agenda'
      ? `/customer-portal?offset=${page * 25}&limit=25&status=${tab}&search=${encodeURIComponent(deferredSearch)}`
      : null,
  );
  const detail = useErpQuery<CustomerOrder>(
    id ? `/customer-portal/orders/${encodeURIComponent(id)}` : null,
  );
  const agenda = useErpQuery<
    { id: string; title: string; startAt: string; endAt: string | null; serviceOrderId: string }[]
  >(section === 'agenda' ? '/customer-portal/agenda' : null);
  if (section === 'agenda')
    return (
      <>
        <PageHeading
          title="Agenda dos meus atendimentos"
          description="Agendamentos vinculados às O.S. do seu provedor, sem compromissos internos da Ajust."
        />
        <QueryState
          loading={agenda.isLoading}
          error={agenda.error}
          onRetry={() => void agenda.mutate()}
        />
        <section className="panel">
          <PanelHeading
            title="Agendamentos registrados"
            description="O registro de origem não confirma, por si só, a realização do compromisso."
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Atendimento</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>O.S.</th>
                </tr>
              </thead>
              <tbody>
                {agenda.data?.map((event) => (
                  <tr key={event.id}>
                    <td>{event.title}</td>
                    <td>{date(event.startAt)}</td>
                    <td>{date(event.endAt)}</td>
                    <td>
                      <Link className="text-link" href={`/cliente/ordens/${event.serviceOrderId}`}>
                        Ver atendimento
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!agenda.data?.length && !agenda.isLoading && !agenda.error && (
            <p className="p-6 text-xs text-muted-foreground">
              Nenhum agendamento compartilhado com este provedor.
            </p>
          )}
        </section>
      </>
    );
  if (id)
    return (
      <>
        <Link className="text-link mb-5" href="/cliente/ordens">
          ← Meus atendimentos
        </Link>
        <QueryState
          loading={detail.isLoading}
          error={detail.error}
          onRetry={() => void detail.mutate()}
        />
        {detail.data && (
          <>
            <PageHeading
              title={detail.data.title}
              description={`O.S. ${detail.data.protocol} · acompanhamento pela Ajust`}
            />
            <section className="panel mb-5 p-6">
              <div className="mb-6 flex flex-wrap items-center gap-4">
                <StatusBadge status={orderStatuses[detail.data.status]} />
                <Priority value={priorities[detail.data.priority]} />
                <span className="text-xs text-muted-foreground">
                  Abertura: {date(detail.data.createdAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Responsável: {detail.data.analystName || 'A definir'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7">{detail.data.description}</p>
              <p className="mt-6 text-xs text-muted-foreground">
                Prazo SLA:{' '}
                {detail.data.deadlineAt
                  ? date(detail.data.deadlineAt)
                  : 'Sem política confirmada para este histórico'}
              </p>
            </section>
            <section className="panel">
              <PanelHeading
                title="Histórico compartilhado"
                description="Somente registros liberados pela equipe da Ajust para o cliente."
              />
              <div className="space-y-5 px-6 pb-6">
                {detail.data.occurrences?.map((comment) => (
                  <article key={comment.id} className="border-l-2 border-primary/20 pl-4">
                    <p className="mb-2 text-[10px] text-muted-foreground">
                      {date(comment.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-6">{comment.message}</p>
                  </article>
                ))}
                {!detail.data.occurrences?.length && (
                  <p className="text-xs text-muted-foreground">
                    Ainda não há atualizações públicas neste atendimento. Anotações internas não são
                    exibidas.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </>
    );
  const data = query.data;
  return (
    <>
      <PageHeading
        title="Painel de ocorrências"
        description={`${data?.customer?.tradeName || 'Meu provedor'} · seus atendimentos com a Ajust, ativos e histórico.`}
      >
        <Button variant="outline" onClick={() => void query.mutate()} disabled={query.isLoading}>
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4">
        <Metric
          label="Total abertas"
          change="Ativas"
          value={String(data?.summary.active ?? '—')}
          icon={ClipboardList}
          foot="somente do seu provedor"
        />
        <Metric
          label="Total de O.S."
          change="Histórico"
          value={String(data?.summary.total ?? '—')}
          icon={CalendarDays}
          foot="histórico compartilhado"
        />
        <Metric
          label="Entradas no mês"
          change="Mês atual"
          value={String(data?.summary.entriesThisMonth ?? '—')}
          icon={TrendingUp}
          foot="pela data de abertura · UTC"
        />
        <Metric
          label="Concluídas no mês"
          change="Mês atual"
          value={String(data?.summary.closedThisMonth ?? '—')}
          icon={CheckCircle2}
          foot="pela data de conclusão · UTC"
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/50 p-1">
          {[
            ['all', 'Todas'],
            ['active', 'Ativas'],
            ['closed', 'Fechadas'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
              aria-pressed={tab === value}
              className={cn(
                'rounded-md px-4 py-2 text-xs',
                tab === value
                  ? 'bg-card font-medium text-primary shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Link className="text-link" href="/cliente/configuracoes/meu-perfil">
          Minha conta
        </Link>
      </div>
      <div className="mb-5 flex max-w-lg items-center gap-2 rounded-lg border border-border bg-card px-3 py-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          aria-label="Buscar meus atendimentos"
          placeholder="Buscar por protocolo ou demanda..."
          maxLength={200}
          className="w-full bg-transparent text-xs outline-none"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Demanda</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-mono text-[10px]">{order.protocol}</td>
                  <td>
                    <Link
                      className="font-medium hover:text-primary"
                      href={`/cliente/ordens/${order.id}`}
                    >
                      {order.title}
                    </Link>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {date(order.createdAt)}
                    </span>
                  </td>
                  <td>{orderTypes[order.type]}</td>
                  <td>
                    <StatusBadge status={orderStatuses[order.status]} />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label={`Copiar protocolo ${order.protocol}`}
                        onClick={() => {
                          void (async () => {
                            if (await copyToClipboard(order.protocol))
                              toast.success('Protocolo copiado.');
                            else
                              toast.error(
                                'Não foi possível copiar. Selecione o protocolo na tabela.',
                              );
                          })();
                        }}
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                      <Link
                        className="text-link whitespace-nowrap"
                        href={`/cliente/ordens/${order.id}`}
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.orders.length && !query.isLoading && !query.error && (
          <p className="p-8 text-center text-xs text-muted-foreground">
            {tab === 'all' && !search.trim()
              ? 'Nenhum atendimento compartilhado com seu provedor.'
              : 'Nenhuma O.S. neste filtro. Ajuste a busca ou consulte Todas para ver o histórico.'}
          </p>
        )}
        <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-[10px] text-muted-foreground">
            {data?.total ?? 0} atendimentos no filtro
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!page || query.isLoading}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || (page + 1) * 25 >= data.total || query.isLoading}
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </Button>
          </div>
        </footer>
      </section>
      <p className="mt-5 text-[11px] leading-6 text-muted-foreground">
        A Ajust é a operadora deste ERP. Este portal mostra somente atendimentos compartilhados do
        cliente vinculado à sua conta; credenciais e comentários internos não são exibidos.
      </p>
    </>
  );
}
