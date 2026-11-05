'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardList, Clock3, PauseCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOperationalOrders } from '@/lib/erp/use-operational-orders';
import { visualRecord } from '@/lib/erp/visual-data';
import { deadlineSituation, isActiveOrder, orderDeadline } from '@/lib/erp/analyst-workspace';
import { PageHeading, PanelHeading, Metric, StatusBadge, Priority } from './primitives';
import { QueryState } from './contract-form';

const filters = [
  'Todas',
  'Atrasada',
  'Vence em até 2h',
  'Dentro do prazo',
  'Pausada',
  'Sem prazo de SLA',
];
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function SlaPage() {
  const source = useOperationalOrders('operation');
  const [filter, setFilter] = useState('Todas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const active = (source.data || [])
    .filter(isActiveOrder)
    .map((raw) => ({
      raw,
      row: visualRecord('orders', raw),
      situation: deadlineSituation(raw, now),
    }))
    .sort(
      (a, b) =>
        Number(Boolean(a.raw.pausedAt)) - Number(Boolean(b.raw.pausedAt)) ||
        (orderDeadline(a.raw) ?? Infinity) - (orderDeadline(b.raw) ?? Infinity) ||
        a.raw.id.localeCompare(b.raw.id),
    );
  const needle = normalized(search.trim());
  const matching = active.filter(
    ({ row, situation }) =>
      (filter === 'Todas' || filter === situation) &&
      normalized([row.protocol, row.title, row.provider, row.analyst].join(' ')).includes(needle),
  );
  const pages = Math.max(1, Math.ceil(matching.length / 20));
  const current = Math.min(page, pages - 1);
  const visible = matching.slice(current * 20, current * 20 + 20);
  const ready = source.data !== undefined && !source.error;
  function selectFilter(value: string) {
    setFilter(value);
    setPage(0);
  }

  return (
    <>
      <PageHeading
        title="Prazos da equipe"
        description="Acompanhe as O.S. ativas de toda a Ajust e identifique quem precisa de apoio."
      >
        <Button
          variant="outline"
          disabled={source.isValidating}
          onClick={() => void source.mutate()}
        >
          <RefreshCw className="size-3.5" /> Atualizar
        </Button>
        <Link href="/gerencia/calendario-sla" className="text-link">
          Configurar prazos e calendário
        </Link>
      </PageHeading>
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4">
        {[
          {
            label: 'O.S. ativas',
            selection: 'Todas',
            count: active.length,
            foot: 'toda a equipe Ajust',
            icon: ClipboardList,
          },
          {
            label: 'Atrasadas',
            selection: 'Atrasada',
            count: active.filter((item) => item.situation === 'Atrasada').length,
            foot: 'prazo excedido, sem pausa',
            icon: AlertTriangle,
          },
          {
            label: 'Vencem em até 2h',
            selection: 'Vence em até 2h',
            count: active.filter((item) => item.situation === 'Vence em até 2h').length,
            foot: 'próximas do prazo',
            icon: Clock3,
          },
          {
            label: 'Pausadas',
            selection: 'Pausada',
            count: active.filter((item) => item.situation === 'Pausada').length,
            foot: 'consulte o motivo da espera',
            icon: PauseCircle,
          },
        ].map((metric) => (
          <button
            key={metric.label}
            type="button"
            aria-label={`Filtrar ${metric.label}`}
            className="min-w-0 text-left rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => selectFilter(metric.selection)}
            aria-pressed={filter === metric.selection}
          >
            <Metric
              label={metric.label}
              value={ready ? String(metric.count) : '—'}
              change="Ver ordens"
              foot={metric.foot}
              icon={metric.icon}
            />
          </button>
        ))}
      </div>
      <section className="panel overflow-hidden">
        <PanelHeading
          title="Ordens por prazo"
          description="Abra a O.S. para consultar o atendimento. Os horários seguem o fuso de Fortaleza."
        />
        <div className="flex flex-wrap gap-3 border-b border-border px-5 pb-4">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              className="min-w-0 bg-transparent text-xs outline-none"
              type="search"
              aria-label="Buscar ordem, provedor ou analista"
              placeholder="Ordem, provedor ou analista"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            className="native-select"
            aria-label="Filtrar situação do prazo"
            value={filter}
            onChange={(event) => selectFilter(event.target.value)}
          >
            {filters.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          {(search || filter !== 'Todas') && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                selectFilter('Todas');
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
        <QueryState
          loading={source.isLoading}
          error={source.error}
          onRetry={() => void source.mutate()}
        />
        {ready && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ordem de serviço</th>
                    <th>Provedor</th>
                    <th>Analista responsável</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Prazo</th>
                    <th>Situação do prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ raw, row, situation }) => (
                    <tr key={raw.id}>
                      <td>
                        <Link
                          className="block font-medium hover:text-primary"
                          href={`/gerencia/ordens/${encodeURIComponent(raw.id)}`}
                        >
                          <span className="mb-1 block text-[10px] text-muted-foreground">
                            #{String(row.protocol)}
                          </span>
                          {String(row.title)}
                        </Link>
                      </td>
                      <td>{String(row.provider)}</td>
                      <td>{String(row.analyst)}</td>
                      <td>
                        <StatusBadge status={String(row.status)} />
                      </td>
                      <td>
                        <Priority value={String(row.priority)} />
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {orderDeadline(raw) !== null ? String(row.deadline) : 'Sem prazo de SLA'}
                        {Boolean(raw.pausedAt) && (
                          <span className="mt-1 block">
                            Pausado: {String(raw.pauseReason || 'Consulte a O.S.')}
                          </span>
                        )}
                        {Boolean(raw.scheduledAt) && !raw.scheduleStartedAt && (
                          <span className="mt-1 block">
                            Agendada:{' '}
                            {new Date(String(raw.scheduledAt)).toLocaleString('pt-BR', {
                              timeZone: 'America/Fortaleza',
                            })}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`text-xs font-medium ${situation === 'Atrasada' ? 'text-rose-600 dark:text-rose-400' : situation === 'Vence em até 2h' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
                        >
                          {situation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!matching.length && (
              <p role="status" className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhuma O.S. encontrada para os filtros selecionados.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-xs text-muted-foreground">
              <span>
                {matching.length} O.S. · página {current + 1} de {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={current + 1 >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
