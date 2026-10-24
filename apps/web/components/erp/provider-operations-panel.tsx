'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import { PanelHeading, ViewLink } from './primitives';
import { ErpEmpty, QueryState } from './contract-form';
import type { ServiceTypeReport } from './service-types-analytics';

export function ProviderOperationsPanel({
  daysBack,
  compact = false,
}: {
  daysBack?: number;
  compact?: boolean;
}) {
  const base = useRouteBase();
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const days = daysBack || (period === 'all' ? undefined : Number(period));
  const params = new URLSearchParams();
  if (days) params.set('daysBack', String(days));
  const query = useErpQuery<ServiceTypeReport>(`/reports/service-types?${params}`);
  const rows = (query.data?.providers || []).filter((row) =>
    row.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <section className="panel">
      <PanelHeading
        title={compact ? 'O.S. por provedor' : 'Análise de atendimento por provedor'}
        description="Situação das O.S. abertas no período selecionado"
      >
        <ViewLink href={`${base}/provedores`}>Ver provedores</ViewLink>
      </PanelHeading>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-5">
          <select
            className="native-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Período da análise de provedores"
          >
            <option value="all">Todo o histórico</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <input
            className="h-9 rounded-md border border-border bg-card px-3 text-xs"
            placeholder="Buscar provedor..."
            aria-label="Buscar na análise de provedores"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {query.data?.summary.totalOrders ?? '—'} O.S. · {rows.length} grupos de atendimento
          </p>
        </div>
      )}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provedor</th>
              <th>Total</th>
              <th>Ativas</th>
              <th>Concluídas</th>
              {!compact && <th>Canceladas</th>}
              <th>Atrasadas</th>
              {!compact && <th>Próximas do prazo</th>}
            </tr>
          </thead>
          <tbody>
            {(compact ? rows.slice(0, 5) : rows).map((row) => (
              <tr key={row.name}>
                <td>
                  <Link
                    className="font-medium hover:text-primary"
                    href={
                      row.customerId ? `${base}/provedores/${row.customerId}` : `${base}/provedores`
                    }
                  >
                    {row.name}
                  </Link>
                </td>
                <td>{row.total}</td>
                <td>{row.active}</td>
                <td>{row.closed}</td>
                {!compact && <td>{row.canceled}</td>}
                <td>{row.overdue}</td>
                {!compact && <td>{row.dueSoon}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && !query.isLoading && !query.error && <ErpEmpty connected={query.connected} />}
      {!compact && !!query.data?.summary.withoutSla && (
        <p className="p-5 text-xs leading-6 text-muted-foreground">
          {query.data.summary.withoutSla} O.S. sem prazo ou não elegíveis para SLA ficam fora dos
          indicadores de atraso. Cancelamentos não são contados como conclusões.
        </p>
      )}
    </section>
  );
}
