import Link from 'next/link';
import {
  buildDashboardQuery,
  DashboardFilters,
  ORDER_BY_OPTIONS,
  ORDER_DIR_OPTIONS,
  PAGE_SIZE_OPTIONS,
  PERIOD_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '../../lib/query-builders';

export function OrderFilters({
  path,
  filters,
}: {
  path: '/gerencia' | '/analista' | '/cliente';
  filters: DashboardFilters;
}) {
  const exportHref = `/api/service-orders/export?${buildDashboardQuery(filters, { page: 1 })}`;

  return (
    <form method="get" action={path} className="surface filter-form fade-in-up">
      <input type="hidden" name="page" value="1" />
      <label className="filter-field">
        <span>Periodo</span>
        <select name="period" defaultValue={filters.period}>
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Status</span>
        <select name="status" defaultValue={filters.status || ''}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all-status'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Prioridade</span>
        <select name="priority" defaultValue={filters.priority || ''}>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value || 'all-priority'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Itens</span>
        <select name="pageSize" defaultValue={String(filters.pageSize)}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Ordenar por</span>
        <select name="orderBy" defaultValue={filters.orderBy}>
          {ORDER_BY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Direcao</span>
        <select name="orderDir" defaultValue={filters.orderDir}>
          {ORDER_DIR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Tipo OS</span>
        <select name="type" defaultValue={filters.type || ''}>
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value || 'all-type'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field filter-grow">
        <span>Busca</span>
        <input
          name="q"
          defaultValue={filters.q || ''}
          placeholder="protocolo, titulo ou descricao"
        />
      </label>

      <div className="filter-actions">
        <button type="submit" className="btn-primary">
          Aplicar
        </button>
        <Link href={path} className="btn-secondary">
          Limpar
        </Link>
        <a href={exportHref} className="btn-secondary">
          Exportar CSV
        </a>
      </div>
    </form>
  );
}
