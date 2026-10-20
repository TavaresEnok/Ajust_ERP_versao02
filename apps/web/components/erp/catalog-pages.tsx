'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Layers, Timer, Workflow, ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import {
  useVisualCollection,
  useVisualSource,
  useRouteBase,
  listRecords,
} from '@/lib/erp/visual-data';
import { priorities, orderTypes, type ErpRecord } from '@/lib/erp/contracts';
import { PageHeading, PanelHeading, StatusBadge, ViewLink } from './primitives';
import { RecordDialog } from './record-dialog';
import { OperationControl } from './operation-controls';
import { QueryState, ErpEmpty } from './contract-form';
import { WorkflowEditorPage } from './workflow-editor';

export function CatalogPage({
  kind,
  id,
  editOnOpen = false,
}: {
  kind: 'services' | 'policies';
  id?: string;
  editOnOpen?: boolean;
}) {
  const portalBase = useRouteBase();
  const isService = kind === 'services';
  const query = useVisualSource(kind);
  const [items, setItems] = useVisualCollection<ErpRecord>(kind);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(editOnOpen);
  const { scope } = useErp();
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const base = `${portalBase}/${isService ? 'servicos' : 'politicas-sla'}`;
  const selected = items.find((item) => item.id === id);
  const raw = query.raw.find((item) => item.id === id);
  const endpoint = isService ? '/service-catalog' : '/sla-policies';
  if (id && !selected)
    return (
      <>
        <Link href={base} className="mb-4 text-link">
          <ArrowLeft />
          Voltar para {isService ? 'serviços' : 'políticas'}
        </Link>
        <PageHeading
          title={isService ? 'Serviço indisponível' : 'Política indisponível'}
          description={`Registro ${id}`}
        />
        <QueryState loading={query.isLoading} error={query.error} />
        <ErpEmpty connected={query.connected} />
      </>
    );
  if (selected)
    return (
      <>
        <Link href={base} className="mb-4 text-link">
          <ArrowLeft />
          Voltar para {isService ? 'serviços' : 'políticas'}
        </Link>
        <PageHeading title={String(selected.name)} description={String(selected.description)}>
          <StatusBadge status={selected.active ? 'Ativo' : 'Inativo'} />
          <Button onClick={() => setEditing(true)}>
            Editar {isService ? 'serviço' : 'política'}
          </Button>
          {isService && (
            <OperationControl
              title="Remover serviço"
              description="Remover este serviço do catálogo do ERP?"
              path={`${endpoint}/${encodeURIComponent(selected.id)}`}
              method="DELETE"
              roles={['super_admin', 'gerente']}
              after={async () => {
                await query.mutate();
              }}
            />
          )}
        </PageHeading>
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <section className="panel">
            <PanelHeading
              title={isService ? 'Modelo de atendimento' : 'Prazo contratado'}
              description={
                isService
                  ? 'Checklist e informações necessárias para o atendimento'
                  : 'Regra por prioridade e tipo de serviço'
              }
            />
            {isService ? (
              <div className="flex flex-col gap-5 p-6 pt-0">
                {Array.isArray(raw?.checklist) && raw.checklist.length ? (
                  raw.checklist.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border border-border p-4"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs text-primary">
                        {index + 1}
                      </span>
                      <span className="text-xs">{String(step)}</span>
                      <CheckCircle2 className="ml-auto size-4 text-primary" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Este serviço não possui checklist cadastrado.
                  </p>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Prioridade</th>
                      <th>Tipo de serviço</th>
                      <th>Resolução</th>
                      <th>Regra específica</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{priorities[String(raw?.priority) as keyof typeof priorities] || '—'}</td>
                      <td>
                        {orderTypes[String(raw?.serviceOrderType) as keyof typeof orderTypes] ||
                          'Todos'}
                      </td>
                      <td>{String(raw?.hours ?? '—')} horas</td>
                      <td>{raw?.isOverride ? 'Sim' : 'Não'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel h-fit p-6">
            <h2 className="section-title">Aplicação</h2>
            <p className="mt-3 text-xs text-muted-foreground">{String(selected.category)}</p>
            <div className="my-5 border-t border-border" />
            <h3 className="section-title">Funcionamento</h3>
            {isService ? (
              <dl className="mt-4 flex flex-col gap-3 text-xs">
                <div>
                  <dt className="mini-label">Tempo estimado</dt>
                  <dd className="mt-2">{String(raw?.estimatedMinutes ?? '—')} minutos</dd>
                </div>
                <div>
                  <dt className="mini-label">Prioridade padrão</dt>
                  <dd className="mt-2">
                    {priorities[String(raw?.defaultPriority) as keyof typeof priorities] || '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                Dias úteis, feriados e exceções seguem o calendário de SLA da empresa.
              </p>
            )}
            <Link
              href={`${portalBase}/${isService ? 'ordens/nova' : 'calendario-sla'}`}
              className="text-link mt-5"
            >
              {isService ? 'Abrir ordem de serviço' : 'Consultar calendário e simulação'}
            </Link>
          </section>
        </div>
        <RecordDialog
          title="Editar configuração"
          moduleKey={isService ? 'catalog' : 'slaPolicies'}
          recordId={id}
          record={raw}
          open={editing}
          onOpenChange={setEditing}
          fields={[]}
        />
      </>
    );
  return (
    <>
      <PageHeading
        title={isService ? 'Tipos de serviço' : 'Políticas de SLA'}
        description={
          isService
            ? 'Um catálogo organizado para atendimentos mais consistentes.'
            : 'Compromissos claros. Prazos que sua equipe pode acompanhar.'
        }
      >
        <Link
          href={`${portalBase}/${isService ? 'processos' : 'calendario-sla'}`}
          className="text-link"
        >
          {isService ? 'Modelos de processos' : 'Regras e calendário'}
        </Link>
        <RecordDialog
          title={isService ? 'Novo tipo de serviço' : 'Nova política de SLA'}
          moduleKey={isService ? 'catalog' : 'slaPolicies'}
          fields={[]}
        />
        {isService && (
          <OperationControl
            title="Carregar serviços padrão"
            description="Solicitar ao ERP a criação dos serviços padrão. A aplicação depende das regras do servidor."
            path="/service-catalog/seed-defaults"
            roles={['super_admin', 'gerente']}
            after={async () => {
              await query.mutate();
            }}
          />
        )}
      </PageHeading>
      <div className="mb-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={isService ? 'Buscar serviço...' : 'Buscar política...'}
          aria-label="Buscar configuração"
          className="h-9 w-full max-w-sm rounded-lg border border-border bg-card px-3 text-xs"
        />
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items
          .filter((item) => String(item.name).toLowerCase().includes(search.toLowerCase()))
          .map((item) => (
            <article className="panel p-6" key={item.id}>
              <div className="mb-5 flex justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  {isService ? <Layers className="size-5" /> : <Timer className="size-5" />}
                </span>
                <Switch
                  checked={item.active === true}
                  disabled={!query.connected || !manager}
                  onCheckedChange={(active) =>
                    setItems((rows) =>
                      rows.map((row) => (row.id === item.id ? { ...row, active } : row)),
                    )
                  }
                  aria-label={`Ativar ${item.name}`}
                />
              </div>
              <Link
                href={`${base}/${encodeURIComponent(item.id)}`}
                className="text-[15px] font-semibold hover:text-primary"
              >
                {String(item.name)}
              </Link>
              <p className="mt-3 min-h-14 text-xs leading-6 text-muted-foreground">
                {String(item.description)}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[10px] text-muted-foreground">{String(item.category)}</span>
                <ViewLink href={`${base}/${encodeURIComponent(item.id)}`}>Configurar</ViewLink>
              </div>
            </article>
          ))}
      </div>
      {!items.length && !query.isLoading && !query.error && (
        <ErpEmpty connected={query.connected} />
      )}
    </>
  );
}
export function WorkflowsPage({ id }: { id?: string }) {
  const base = useRouteBase();
  const query = useErpQuery<unknown>(!id ? '/workflows' : null);
  const rows = listRecords(query.data);
  if (id)
    return (
      <>
        <Link href={`${base}/workflows`} className="mb-4 text-link">
          <ArrowLeft />
          Todos os workflows
        </Link>
        <WorkflowEditorPage id={id} />
      </>
    );
  return (
    <>
      <PageHeading
        title="Workflows"
        description="Menos ruído, mais fluidez em cada etapa da operação."
      >
        <Link href={`${base}/workflows/novo`} className={buttonVariants()}>
          <Plus className="size-4" />
          Novo workflow
        </Link>
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {rows.map((row) => (
          <article key={row.id} className="panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <Workflow className="size-6 text-primary" />
              <StatusBadge status={row.enabled ? 'Ativo' : 'Rascunho'} />
            </div>
            <h2 className="section-title">{String(row.name)}</h2>
            <p className="mt-3 min-h-12 text-xs leading-6 text-muted-foreground">
              {String(row.description || '')}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[10px] text-muted-foreground">
                {Array.isArray((row.definition as { nodes?: unknown[] } | undefined)?.nodes)
                  ? (row.definition as { nodes: unknown[] }).nodes.length
                  : '—'}{' '}
                etapas
              </span>
              <ViewLink href={`${base}/workflows/${encodeURIComponent(row.id)}`}>
                Editar fluxo
              </ViewLink>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && !query.isLoading && !query.error && <ErpEmpty connected={query.connected} />}
    </>
  );
}
