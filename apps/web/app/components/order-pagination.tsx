import { buildDashboardQuery, DashboardFilters, DashboardPagination } from '../../lib/query-builders';

type Path = '/gerencia' | '/analista' | '/cliente';

export function OrderPagination({
  path,
  filters,
  pagination
}: {
  path: Path;
  filters: DashboardFilters;
  pagination: DashboardPagination;
}) {
  const currentPage = pagination.page;
  const prevHref = `${path}?${buildDashboardQuery(filters, { page: Math.max(1, currentPage - 1) })}`;
  const nextHref = `${path}?${buildDashboardQuery(filters, { page: currentPage + 1 })}`;

  return (
    <div className="pagination-wrap">
      <p>
        Pagina {pagination.page} de {pagination.totalPages} - {pagination.total} registro(s)
      </p>
      <div className="pagination-actions">
        <a
          href={pagination.hasPrev ? prevHref : '#'}
          className={`btn-secondary ${pagination.hasPrev ? '' : 'btn-disabled'}`}
          aria-disabled={!pagination.hasPrev}
        >
          Anterior
        </a>
        <a
          href={pagination.hasNext ? nextHref : '#'}
          className={`btn-secondary ${pagination.hasNext ? '' : 'btn-disabled'}`}
          aria-disabled={!pagination.hasNext}
        >
          Proxima
        </a>
      </div>
    </div>
  );
}
