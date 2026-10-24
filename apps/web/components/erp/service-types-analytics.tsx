'use client';
import { Fragment, useMemo, useState } from 'react';
import { BarChart3, Clock3, Layers, RefreshCw, AlertTriangle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { priorities } from '@/lib/erp/contracts';
import { PageHeading, PanelHeading, Metric } from './primitives';
import { QueryState, ErpEmpty } from './contract-form';
import { CatalogPage } from './catalog-pages';

type ServiceTypeRow = {
  name: string;
  total: number;
  active: number;
  closed: number;
  canceled: number;
  overdue: number;
  dueSoon: number;
  withoutSla: number;
  avgResolutionHours: number | null;
  measuredClosed: number;
  completionRate: number;
  loggedMinutes: number;
  worklogOrders: number;
  analysts: { name: string; orders: number }[];
  byPriority: Record<string, number>;
};
export type ServiceTypeReport = {
  summary: {
    totalOrders: number;
    types: number;
    active: number;
    closed: number;
    canceled: number;
    overdue: number;
    dueSoon: number;
    withoutSla: number;
    avgResolutionHours: number | null;
    measuredClosed: number;
    excludedDemonstrations: number;
  };
  rows: ServiceTypeRow[];
  providerOptions: string[];
  providers: {
    name: string;
    customerId: string | null;
    total: number;
    active: number;
    closed: number;
    canceled: number;
    overdue: number;
    dueSoon: number;
    completionRate: number;
  }[];
};
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const hours = (value: number | null | undefined) =>
  value == null ? 'Não informado' : `${number(value)} h`;

export function ServiceTypesAnalyticsPage() {
  const { scope } = useErp();
  const canAnalyze = !scope || scope.role !== 'cliente';
  const [tab, setTab] = useState<'analysis' | 'catalog'>('analysis');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [provider, setProvider] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('total');
  const [expanded, setExpanded] = useState<string | null>(null);
  const invalidRange = period === 'custom' && !!from && !!to && from > to;
  const ready = period !== 'custom' || (!!from && !!to && !invalidRange);
  const params = new URLSearchParams();
  if (period === 'custom' && ready) {
    params.set('periodStart', from);
    params.set('periodEnd', to);
  } else if (period !== 'all' && period !== 'custom') params.set('daysBack', period);
  if (provider) params.set('provider', provider);
  const query = useErpQuery<ServiceTypeReport>(
    canAnalyze && ready && tab === 'analysis' ? `/reports/service-types?${params}` : null,
  );
  const summary = query.data?.summary;
  const rows = useMemo(
    () =>
      (query.data?.rows || [])
        .filter((row) =>
          row.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
        )
        .sort((a, b) => {
          if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR');
          if (sort === 'duration')
            return (b.avgResolutionHours ?? -1) - (a.avgResolutionHours ?? -1);
          return (
            b[sort as 'total' | 'active' | 'overdue'] - a[sort as 'total' | 'active' | 'overdue']
          );
        }),
    [query.data, search, sort],
  );
  const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 20);
  const durations = top.filter((row) => row.avgResolutionHours !== null);
  const tabs = canAnalyze ? (
    <div className="mb-6 flex gap-5 border-b border-border" aria-label="Áreas de tipos de serviço">
      <button
        className={`pb-3 text-xs ${tab === 'analysis' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        onClick={() => setTab('analysis')}
      >
        Análise das O.S.
      </button>
      <button
        className={`pb-3 text-xs ${tab === 'catalog' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        onClick={() => setTab('catalog')}
      >
        Catálogo e modelos
      </button>
    </div>
  ) : null;
  if (!canAnalyze || tab === 'catalog')
    return (
      <>
        {tabs}
        <CatalogPage kind="services" />
      </>
    );
  const value = (key: 'totalOrders' | 'types' | 'overdue' | 'dueSoon') =>
    summary ? number(summary[key]) : '—';
  return (
    <>
      {tabs}
      <PageHeading
        title="Análise de tipos de serviço"
        description="Volume, duração e responsáveis por tipo de demanda nos provedores atendidos."
      >
        <Button
          variant="outline"
          onClick={() => void query.mutate()}
          disabled={!query.connected || query.isLoading || !ready}
        >
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </PageHeading>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Período
          <select
            className="native-select mt-2 block"
            aria-label="Período dos tipos de serviço"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Todo o histórico</option>
            <option value="7">Últimos 7 dias</option>
            <option value="15">Últimos 15 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Período personalizado</option>
          </select>
        </label>
        {period === 'custom' && (
          <>
            <label className="text-xs">
              De
              <input
                type="date"
                aria-label="Início dos tipos de serviço"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-2 block rounded-md border border-border bg-card p-2"
              />
            </label>
            <label className="text-xs">
              Até
              <input
                type="date"
                aria-label="Fim dos tipos de serviço"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-2 block rounded-md border border-border bg-card p-2"
              />
            </label>
          </>
        )}
        <label className="text-xs">
          Provedor
          <select
            className="native-select mt-2 block max-w-80"
            aria-label="Provedor dos tipos de serviço"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">Todos os provedores</option>
            {provider && !query.data?.providerOptions.includes(provider) && (
              <option value={provider}>{provider}</option>
            )}
            {query.data?.providerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalidRange && (
        <p role="alert" className="mb-4 text-xs text-danger">
          A data inicial deve ser anterior ou igual à data final.
        </p>
      )}
      {!ready && !invalidRange && (
        <p className="mb-4 text-xs text-muted-foreground">Selecione o início e o fim do período.</p>
      )}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="metrics-grid mb-5 grid grid-cols-4 gap-4">
        <Metric
          label="Ordens de serviço"
          value={value('totalOrders')}
          foot="pela data de abertura"
          change="Período selecionado"
          icon={BarChart3}
        />
        <Metric
          label="Tipos atendidos"
          value={value('types')}
          foot="nomes reais das demandas"
          change="Distribuição"
          icon={Layers}
        />
        <Metric
          label="O.S. atrasadas"
          value={value('overdue')}
          foot="ativas elegíveis para SLA"
          change="Atenção"
          icon={AlertTriangle}
          warning
        />
        <Metric
          label="Próximas do prazo"
          value={value('dueSoon')}
          foot="vencimento em até duas horas"
          change="Acompanhar"
          icon={Timer}
          warning
        />
      </div>
      {!!summary?.withoutSla && (
        <p className="mb-5 rounded-lg border border-border bg-card p-4 text-xs leading-6 text-muted-foreground">
          {number(summary.withoutSla)} O.S. sem prazo ou não elegíveis para SLA ficam fora dos
          indicadores de atraso. As políticas contratuais do histórico importado permanecem
          pendentes de confirmação.
        </p>
      )}
      {!!summary?.excludedDemonstrations && (
        <p className="mb-5 text-xs text-muted-foreground">
          O.S. marcadas como demonstração ficam fora desta análise.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <input
          className="h-9 w-full max-w-sm rounded-md border border-border bg-card px-3 text-xs"
          placeholder="Buscar tipo de serviço..."
          aria-label="Buscar tipo de serviço"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="native-select"
          aria-label="Ordenar tipos de serviço"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="total">Maior volume</option>
          <option value="active">Mais ativas</option>
          <option value="overdue">Mais atrasadas</option>
          <option value="duration">Maior tempo de resolução</option>
          <option value="name">Nome</option>
        </select>
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <section className="panel">
          <PanelHeading
            title="Tipos mais frequentes"
            description="Até 20 tipos com maior volume no período"
          />
          <div className="space-y-3 px-5 pb-5">
            {top.map((row, index) => (
              <button
                key={row.name}
                onClick={() => setExpanded(row.name)}
                className="block w-full rounded-lg border border-border p-4 text-left hover:bg-secondary/40"
                aria-label={`Analisar ${row.name}`}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0">
                    <span className="mr-3 text-primary">#{index + 1}</span>
                    {row.name}
                  </span>
                  <strong className="text-lg text-primary">{number(row.total)}</strong>
                </div>
                <div className="progress-track mt-3">
                  <span
                    style={{ width: `${(row.total / Math.max(top[0]?.total || 1, 1)) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeading
            title="Tempo médio de resolução"
            description="Abertura até resolução ou encerramento; não representa horas trabalhadas"
          />
          <div className="space-y-3 px-5 pb-5">
            {durations.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 text-xs"
              >
                <span>
                  {row.name}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {number(row.measuredClosed)} encerramentos com datas válidas
                  </span>
                </span>
                <strong className="shrink-0 text-sm">{hours(row.avgResolutionHours)}</strong>
              </div>
            ))}
            {!durations.length && !query.isLoading && (
              <p className="text-xs text-muted-foreground">
                Sem encerramentos com datas suficientes para calcular a média.
              </p>
            )}
            <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              Média geral: {hours(summary?.avgResolutionHours)}
            </p>
          </div>
        </section>
      </div>
      <section className="panel">
        <PanelHeading
          title="Detalhamento por tipo"
          description="Cancelamentos separados de conclusões. Expanda para ver responsáveis e prioridades."
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo de serviço</th>
                <th>Total</th>
                <th>Ativas</th>
                <th>Concluídas</th>
                <th>Canceladas</th>
                <th>Atrasadas</th>
                <th>Em risco</th>
                <th>Resolução média</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.name}>
                  <tr>
                    <td>
                      <button
                        className="text-left font-medium hover:text-primary"
                        onClick={() => setExpanded(expanded === row.name ? null : row.name)}
                        aria-expanded={expanded === row.name}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td>{number(row.total)}</td>
                    <td>{number(row.active)}</td>
                    <td>{number(row.closed)}</td>
                    <td>{number(row.canceled)}</td>
                    <td>{number(row.overdue)}</td>
                    <td>{number(row.dueSoon)}</td>
                    <td>{hours(row.avgResolutionHours)}</td>
                  </tr>
                  {expanded === row.name && (
                    <tr>
                      <td colSpan={8}>
                        <div className="grid gap-5 p-3 text-xs md:grid-cols-2">
                          <div>
                            <h3 className="mb-3 font-semibold">Responsáveis pelas O.S.</h3>
                            {row.analysts.length ? (
                              row.analysts.map((analyst) => (
                                <p key={analyst.name} className="mb-2 flex justify-between gap-3">
                                  <span>{analyst.name}</span>
                                  <span>{number(analyst.orders)} O.S.</span>
                                </p>
                              ))
                            ) : (
                              <p className="text-muted-foreground">
                                Responsável não informado nas O.S.
                              </p>
                            )}
                          </div>
                          <div>
                            <h3 className="mb-3 font-semibold">Prioridades</h3>
                            {Object.entries(row.byPriority).map(([key, count]) => (
                              <p key={key} className="mb-2 flex justify-between">
                                <span>{priorities[key as keyof typeof priorities] || key}</span>
                                <span>{number(count)}</span>
                              </p>
                            ))}
                            <p className="mt-4 text-muted-foreground">
                              Trabalho apontado:{' '}
                              {row.worklogOrders
                                ? `${number(row.loggedMinutes)} minutos em ${number(row.worklogOrders)} O.S.`
                                : 'sem apontamentos registrados'}
                              .
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && !query.isLoading && !query.error && ready && (
          <ErpEmpty connected={query.connected} />
        )}
      </section>
    </>
  );
}
