'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Building2, Users, ArrowLeft, Search } from 'lucide-react';
import { useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, StatusBadge, ViewLink } from './primitives';
import { RecordDialog } from './record-dialog';
import { TenantAdministration } from './tenant-administration';
import { ResourcePage } from './resource-page';
import { QueryState, ErpEmpty } from './contract-form';
import { DataReport } from './data-report';
import { cn } from '@/lib/utils';
export function TenantsPage({
  id,
  initialTab = 'Dados da empresa',
}: {
  id?: string;
  initialTab?: string;
}) {
  const query = useVisualSource('tenants');
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const base = useRouteBase();
  const tenant = query.rows.find((row) => row.id === id);
  if (id && !tenant)
    return (
      <>
        <PageHeading title="Empresa indisponível" description={`Registro ${id}`} />
        <QueryState loading={query.isLoading} error={query.error} />
        <Link href={`${base}/empresas`} className="text-link">
          Todas as empresas
        </Link>
      </>
    );
  if (tenant)
    return (
      <>
        <Link href={`${base}/empresas`} className="mb-4 text-link">
          <ArrowLeft />
          Todas as empresas
        </Link>
        <PageHeading
          title={String(tenant.name)}
          description="Administre os dados, setores e acessos deste ambiente."
        >
          <StatusBadge status={String(tenant.status)} />
        </PageHeading>
        <div className="mb-6 flex gap-5 overflow-auto border-b border-border">
          {[
            'Dados da empresa',
            'Identidade visual',
            'Setores',
            'Usuários e permissões',
            'SLA',
            'Auditoria',
          ].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'whitespace-nowrap border-b-2 pb-3 text-xs',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {['Dados da empresa', 'Identidade visual', 'Setores'].includes(tab) ? (
          <TenantAdministration
            key={`${id}-${tab}`}
            id={id}
            embedded
            initialTab={tab === 'Dados da empresa' ? 'Empresa' : tab}
          />
        ) : tab === 'Usuários e permissões' ? (
          <>
            <ResourcePage moduleKey="users" base={base} fixedFilters={{ tenantId: id! }} />
            <TenantAdministration id={id} embedded initialTab="Funções e permissões" />
          </>
        ) : tab === 'SLA' ? (
          <section className="panel max-w-2xl p-6">
            <h2 className="section-title">Política de atendimento</h2>
            <p className="my-5 text-xs leading-6 text-muted-foreground">
              O contrato de políticas é restrito à empresa da sessão. Não existe endpoint de
              política comercial por provedor.
            </p>
            <ViewLink href={`${base}/politicas-sla`}>Consultar políticas da sessão</ViewLink>
          </section>
        ) : (
          <DataReport
            title="Histórico de alterações"
            path={`/audit/logs?resourceType=tenant&resourceId=${encodeURIComponent(id!)}`}
            tables={[
              {
                columns: [
                  { key: 'createdAt', label: 'Data' },
                  { key: 'action', label: 'Ação' },
                  { key: 'actorUserId', label: 'Autor' },
                ],
              },
            ]}
          />
        )}
      </>
    );
  return (
    <>
      <PageHeading
        title="Empresas e tenants"
        description="Ambientes organizados. Gestão centralizada e independente."
      >
        <RecordDialog title="Nova empresa" moduleKey="tenants" fields={[]} />
      </PageHeading>
      <div className="mb-5 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-xs outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar empresa"
          placeholder="Buscar empresa ou CNPJ..."
        />
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {query.rows
          .filter((row) =>
            `${row.name} ${row.document}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((row) => (
            <article key={row.id} className="panel p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Building2 className="size-5" />
                </span>
                <StatusBadge status={String(row.status)} />
              </div>
              <h2 className="section-title">{String(row.name)}</h2>
              <p className="mt-2 text-[10px] text-muted-foreground">{String(row.document)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{String(row.email)}</p>
              <div className="my-5 flex gap-6">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {String(row.users)} usuários
                </span>
                <span className="text-xs text-muted-foreground">{String(row.sectors)} setores</span>
              </div>
              <div className="border-t border-border pt-4">
                <ViewLink href={`${base}/empresas/${encodeURIComponent(row.id)}`}>
                  Gerenciar ambiente
                </ViewLink>
              </div>
            </article>
          ))}
      </div>
      {!query.rows.length && !query.isLoading && !query.error && (
        <ErpEmpty connected={query.connected} />
      )}
    </>
  );
}
