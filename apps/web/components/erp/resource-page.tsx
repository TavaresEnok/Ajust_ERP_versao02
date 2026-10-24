'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { type ErpRecord, queryPath, errorMessage } from '@/lib/erp/contracts';
import { modules, createPayload } from '@/lib/erp/modules';
import { parseFields } from '@/lib/erp/fields';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import {
  ContractFields,
  ContractForm,
  ConnectionNotice,
  ErpEmpty,
  QueryState,
} from './contract-form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderBoard } from './order-board';
import { OrderContractForm } from './order-contract-form';
export function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object')
    return Array.isArray(value) ? value.map(displayValue).join(', ') : JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value))
    return new Date(value).toLocaleString('pt-BR');
  return String(value);
}
export function ResourcePage({
  moduleKey,
  base = '/gerencia',
  rowActions,
  headingActions,
  onCreated,
  fixedFilters = {},
}: {
  moduleKey: string;
  base?: string;
  rowActions?: (record: ErpRecord, refresh: () => Promise<unknown>) => ReactNode;
  headingActions?: ReactNode;
  onCreated?: (record: ErpRecord) => void;
  fixedFilters?: Record<string, string>;
}) {
  const config = modules[moduleKey];
  const { scope } = useErp();
  const action = useErpAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ErpRecord | null>(null);
  const [deleting, setDeleting] = useState<ErpRecord | null>(null);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [filterError, setFilterError] = useState('');
  const [page, setPage] = useState(0);
  const [view, setView] = useState('list');
  const allowed = !scope || !config.roles || config.roles.includes(scope.role);
  const pagination = config.pagination || ['orders', 'occurrences', 'audit'].includes(moduleKey);
  const path = queryPath(config.endpoint, {
    ...filter,
    ...fixedFilters,
    ...(pagination ? { limit: 20, offset: page * 20 } : {}),
  });
  const query = useErpQuery<
    ErpRecord[] | { items?: ErpRecord[]; logs?: ErpRecord[]; total?: number }
  >(allowed ? path : null);
  const rawRecords = Array.isArray(query.data)
    ? query.data
    : (query.data?.items ?? query.data?.logs ?? []);
  const records =
    moduleKey === 'users'
      ? rawRecords.map((row) => {
          const user = row.user as ErpRecord | undefined;
          const role = row.role as { code?: string } | undefined;
          return user
            ? { ...row, ...user, id: user.id, roleCode: role?.code, sector: row.sector }
            : row;
        })
      : rawRecords;
  const customerPreview = !scope && base === '/cliente';
  const canWrite = scope
    ? !config.createRoles || config.createRoles.includes(scope.role)
    : !customerPreview || !config.createRoles || config.createRoles.includes('cliente');
  const canEdit = scope
    ? (config.updateRoles || config.createRoles)?.includes(scope.role) !== false
    : !customerPreview || (config.updateRoles || config.createRoles)?.includes('cliente') !== false;
  const canRemove =
    (!scope || (config.removeRoles || config.createRoles)?.includes(scope.role) !== false) &&
    (!scope ||
      !['changes', 'assets'].includes(moduleKey) ||
      ['super_admin', 'gerente'].includes(scope.role));
  const editFields =
    config.updateFields ||
    (moduleKey === 'users'
      ? config.fields
          .filter((f) => !['tenantId', 'password'].includes(f.name))
          .map((f) =>
            f.name === 'roleCode' && scope?.role === 'cliente'
              ? { ...f, options: { cliente: 'Cliente' } }
              : f,
          )
      : config.fields.filter(
          (f) =>
            moduleKey !== 'calendar' ||
            f.name !== 'isGlobal' ||
            !scope ||
            ['super_admin', 'gerente'].includes(scope.role),
        ));
  const createFields = config.fields
    .filter(
      (f) =>
        moduleKey !== 'calendar' ||
        f.name !== 'isGlobal' ||
        !scope ||
        ['super_admin', 'gerente'].includes(scope.role),
    )
    .map((f) =>
      f.name === 'roleCode' && scope?.role === 'cliente'
        ? { ...f, options: { cliente: 'Cliente' } }
        : f,
    );
  const RecordForm = moduleKey === 'orders' && !editing ? OrderContractForm : ContractForm;
  if (!allowed)
    return (
      <>
        <PageHeading title={config.title} description="Seu perfil não tem acesso a este módulo." />
        <p className="text-xs text-muted-foreground">
          As permissões também devem ser aplicadas pelo backend.
        </p>
      </>
    );
  async function save(values: Record<string, unknown>) {
    const saved = await action.execute<ErpRecord>({
      path: editing ? `${config.endpoint}/${encodeURIComponent(editing.id)}` : config.endpoint,
      method: editing ? config.updateMethod || 'PATCH' : 'POST',
      body: createPayload(moduleKey, { ...values, ...fixedFilters }),
    });
    if (!editing) onCreated?.(saved);
    setOpen(false);
    setEditing(null);
    await query.mutate();
    toast.success('Operação confirmada pelo ERP');
  }
  return (
    <>
      <PageHeading title={config.title} description={config.description}>
        {headingActions}
        <Button
          variant="outline"
          disabled={!query.connected || query.isLoading}
          onClick={() => void query.mutate()}
        >
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
        {config.detailPath && !query.connected && (
          <Link className="text-link" href={`${base}/operacoes/${config.detailPath}/preview`}>
            Explorar detalhes
          </Link>
        )}
        {config.createLabel && canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus data-icon="inline-start" />
            {config.createLabel}
          </Button>
        )}
      </PageHeading>
      {!query.connected && <ConnectionNotice />}
      {(config.search || config.filters?.length) && (
        <section className="panel mb-5 p-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilterError('');
              try {
                const form = new FormData(event.currentTarget);
                const values = parseFields(config.filters || [], form);
                const search = String(form.get('search') || '').trim();
                if (search && search.length < 2)
                  throw new Error('A busca deve ter pelo menos dois caracteres.');
                if (values.from && values.to && String(values.from) > String(values.to))
                  throw new Error('O início deve ser anterior ao fim.');
                setFilter(
                  Object.fromEntries(
                    Object.entries({ ...values, ...(search ? { search } : {}) }).map(
                      ([key, value]) => [key, String(value)],
                    ),
                  ),
                );
                setPage(0);
              } catch (error) {
                setFilterError(errorMessage(error));
              }
            }}
          >
            {config.search && (
              <Input
                name="search"
                placeholder="Buscar por título, protocolo ou provedor..."
                aria-label="Buscar registros do ERP"
              />
            )}
            <ContractFields fields={config.filters || []} />
            {filterError && (
              <p role="alert" className="text-xs text-danger">
                {filterError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Aplicar filtros
              </Button>
              <Button
                type="reset"
                variant="ghost"
                onClick={() => {
                  setFilter({});
                  setPage(0);
                  setFilterError('');
                }}
              >
                Limpar
              </Button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <PanelHeading
          title="Registros do ERP"
          description={
            query.connected
              ? `${records.length} registros nesta página`
              : 'Fonte de dados original · sem registros carregados'
          }
        >
          {moduleKey === 'orders' && (
            <Tabs value={view} onValueChange={(value) => setView(String(value))}>
              <TabsList>
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="board">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </PanelHeading>
        {moduleKey === 'orders' && view === 'board' && !query.error && !query.isLoading && (
          <OrderBoard records={records} base={base} refresh={() => query.mutate()} />
        )}
        <QueryState
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.mutate()}
        />
        {!(moduleKey === 'orders' && view === 'board') &&
          !query.error &&
          !query.isLoading &&
          (records.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {config.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row.id}>
                      {config.columns.map((column) => (
                        <td key={column.key}>
                          {column.labels ? (
                            <StatusBadge
                              status={
                                column.labels[String(row[column.key])] ||
                                displayValue(row[column.key])
                              }
                            />
                          ) : (
                            displayValue(row[column.key])
                          )}
                        </td>
                      ))}
                      <td>
                        <div className="flex items-center gap-3">
                          {config.detailPath && (
                            <Link
                              className="text-link"
                              href={`${base}/operacoes/${config.detailPath}/${encodeURIComponent(row.id)}`}
                            >
                              Detalhes
                            </Link>
                          )}
                          {rowActions?.(row, () => query.mutate())}
                          {config.update && canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(row);
                                setOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          )}
                          {config.remove && canRemove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={row.id === scope?.userId}
                              onClick={() => setDeleting(row)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ErpEmpty connected={query.connected} />
          ))}
        {pagination && (
          <div className="flex items-center justify-end gap-3 border-t border-border p-4 text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft />
            </Button>
            Página {page + 1}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              disabled={records.length < 20 || !query.connected}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </section>
      {config.note && (
        <p className="mt-4 text-[11px] leading-6 text-muted-foreground">{config.note}</p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar registro' : config.createLabel}</DialogTitle>
            <DialogDescription>
              Campos compatíveis com o ERP. O formulário não utiliza dados demonstrativos.
            </DialogDescription>
          </DialogHeader>
          <RecordForm
            key={editing?.id || 'new'}
            fields={editing ? editFields : createFields}
            values={editing || { ...(scope ? { tenantId: scope.tenantId } : {}), ...fixedFilters }}
            connected={action.connected && (editing ? canEdit : canWrite)}
            pending={action.pending}
            onSubmit={save}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar remoção</DialogTitle>
            <DialogDescription>
              Esta ação altera o registro no ERP. Confirme apenas se tiver certeza.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs">
            {displayValue(deleting?.title || deleting?.name || deleting?.id)}
          </p>
          <Button
            disabled={!action.connected || action.pending}
            onClick={async () => {
              try {
                await action.execute({
                  path: `${config.endpoint}/${encodeURIComponent(deleting!.id)}`,
                  method: 'DELETE',
                });
                setDeleting(null);
                await query.mutate();
                toast.success('Remoção confirmada pelo ERP');
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            Confirmar remoção no ERP
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
