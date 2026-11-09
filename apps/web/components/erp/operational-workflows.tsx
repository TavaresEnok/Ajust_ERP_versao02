'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { orderStatuses } from '@/lib/erp/contracts';
import {
  flowStatuses,
  type FlowTemplate,
  type FlowInstance,
  trackingSteps,
} from '@/lib/erp/operational-flow';
import { ExecutionTracking, ImportedFlowSummary } from './execution-tracking';
import { PageHeading, PanelHeading } from './primitives';
import { QueryState } from './contract-form';
import { ServiceProcessesPage } from './service-processes';
const Graph = dynamic(
  () => import('./operational-flow-graph').then((m) => m.OperationalFlowGraph),
  { ssr: false },
);
const endpoint = '/service-processes/operational';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Falha na operação');
const date = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
type Person = { id: string; name: string; role: string; accessBlocked: boolean };

export { WorkflowsHub } from './workflow-designer';

export function ServiceProcessesHub({ id, base = '/gerencia' }: { id?: string; base?: string }) {
  const { scope } = useErp();
  const manager = ['super_admin', 'gerente'].includes(scope?.role || '');
  const router = useRouter();
  const [legacy, setLegacy] = useState(false);
  const query = useErpQuery<FlowInstance[]>(endpoint);
  const selected = id || '';
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState(manager ? 'all' : 'mine');
  const [customer, setCustomer] = useState('');
  const chosen = query.data?.find((p) => p.id === selected);
  if (!manager && id && query.data && !chosen)
    return (
      <section className="panel p-5">
        <h1 className="section-title">Acompanhamento indisponível</h1>
        <p className="my-4 text-sm">
          Abra a O.S. ou a ocorrência para consultar o histórico deste atendimento.
        </p>
        <Link className="text-link" href={`${base}/ordens`}>
          Minhas ordens →
        </Link>
      </section>
    );
  if (legacy || (id && query.data && !chosen))
    return (
      <>
        <Button
          className="mb-4"
          variant="outline"
          onClick={() => {
            setLegacy(false);
            if (id) router.push(`${base}/processos`);
          }}
        >
          Voltar às execuções operacionais
        </Button>
        <ServiceProcessesPage id={id} base={base} />
      </>
    );
  const rows = query.data?.filter(
    (p) =>
      (p.status !== 'SUPERSEDED' || p.id === selected) &&
      (mode === 'all' ||
        (mode === 'demo'
          ? p.state.mode === 'DEMO'
          : mode === 'history'
            ? p.status === 'HISTORICAL'
            : ['ACTIVE', 'WAITING', 'FAILED', 'PAUSED'].includes(p.status) &&
              (mode !== 'mine' ||
                (p.links || []).some(
                  (l) =>
                    l.order.assigneeUserId === scope?.userId &&
                    !['FECHADA', 'CANCELADA'].includes(l.order.status),
                )))) &&
      (!customer || p.occurrence.provider === customer) &&
      `${p.definition.name} ${p.occurrence.provider} ${p.orders?.map((o) => o.protocol).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={manager ? 'Acompanhamento dos atendimentos' : 'Meus atendimentos em fluxo'}
        description="Etapa atual, responsáveis e próximas ações das ordens de serviço."
      >
        {manager && (
          <Link href={`${base}/workflows`} className="text-link">
            Configurar fluxos de atendimento →
          </Link>
        )}
      </PageHeading>
      {id && (
        <Link href={`${base}/processos`} className="text-link mb-5 inline-block">
          ← Todos os processos
        </Link>
      )}
      {!id && (
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="native-select"
            placeholder="Buscar provedor, serviço ou protocolo"
            aria-label="Buscar processo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="native-select"
            aria-label="Provedor"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">Todos os provedores</option>
            {[...new Set(query.data?.map((p) => p.occurrence.provider))].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            className="native-select"
            aria-label="Origem da execução"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {!manager && <option value="mine">Meus atendimentos ativos</option>}
            <option value="active">Atendimentos ativos da equipe</option>
            {manager && <option value="all">Todos os atendimentos</option>}
            {manager && <option value="demo">Somente demonstrações</option>}
            <option value="history">Somente histórico preservado</option>
          </select>
          <Button variant="outline" onClick={() => void query.mutate()}>
            Atualizar
          </Button>
        </div>
      )}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {!id && (
        <section className="panel mb-6 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="border-b border-border bg-secondary">
              <tr>
                {['Provedor', 'Serviço / fluxo', 'O.S. principal', 'Estado', 'Origem', ''].map(
                  (h) => (
                    <th key={h} className="p-4 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows?.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-border hover:bg-secondary/40 ${selected === p.id ? 'bg-secondary' : ''}`}
                >
                  <td className="p-4 font-semibold">{p.occurrence.provider}</td>
                  <td className="p-4">
                    {p.definition.name} · v{p.templateVersion}
                  </td>
                  <td className="p-4 font-mono">
                    {p.links?.find((l) => l.orderKey === 'root')?.order.protocol ||
                      p.orders?.find((o) => o.id === p.rootOrderId)?.protocol ||
                      '—'}
                  </td>
                  <td className="p-4">{flowStatuses[p.status] || p.status}</td>
                  <td className="p-4">
                    {p.state.mode === 'DEMO'
                      ? 'DEMONSTRAÇÃO'
                      : p.status === 'HISTORICAL'
                        ? 'Histórico preservado'
                        : 'Ajust ERP'}
                  </td>
                  <td className="p-4">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`${base}/processos/${p.id}`)}
                    >
                      Acompanhar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows?.length && !query.isLoading && (
            <p className="p-5 text-sm text-muted-foreground">
              {mode === 'mine'
                ? 'Nenhum atendimento em fluxo ativo atribuído a você. Consulte seu trabalho em Minhas ordens.'
                : 'Nenhum atendimento para esses filtros.'}
            </p>
          )}
        </section>
      )}
      {chosen && (
        <OperationalExecution
          key={selected}
          id={selected}
          base={base}
          onChanged={() => void query.mutate()}
          onNavigate={(nextId) => router.push(`${base}/processos/${nextId}`)}
        />
      )}
    </>
  );
}

export function OperationalExecution({
  id,
  base = '/gerencia',
  orderId,
  onChanged,
  onNavigate,
}: {
  id: string;
  base?: string;
  orderId?: string;
  onChanged?: () => void;
  onNavigate?: (id: string) => void;
}) {
  const router = useRouter();
  const { scope } = useErp();
  const manager = ['super_admin', 'gerente'].includes(scope?.role || '');
  const query = useErpQuery<FlowInstance>(`${endpoint}/${id}`);
  const people = useErpQuery<Person[]>(`${endpoint}/assignees`);
  const action = useErpAction();
  // Hora de referência para "prazo vencido"; atualiza junto com a consulta periódica.
  const [now, setNow] = useState(() => Date.now());
  const instance = query.data;
  const status = instance?.status;
  const refresh = query.mutate;
  useEffect(() => {
    if (!status || !['ACTIVE', 'WAITING', 'FAILED'].includes(status)) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [status, refresh, id]);
  async function perform(values: Record<string, unknown>) {
    if (!instance) return;
    try {
      await action.execute({
        path: `${endpoint}/${id}/actions`,
        method: 'POST',
        body: { expectedVersion: instance.version, ...values },
      });
      toast.success(orderId && !manager ? 'Trabalho registrado' : 'Fluxo atualizado');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      await query.mutate();
      onChanged?.();
    }
  }
  async function demo() {
    if (!instance) return;
    try {
      const r = await action.execute<{ id: string }>({
        path: `${endpoint}/${id}/demo`,
        method: 'POST',
        body: { expectedVersion: instance.version },
      });
      await query.mutate();
      onChanged?.();
      if (onNavigate) onNavigate(r.id);
      else router.push(`${base}/processos/${r.id}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }
  if (!instance)
    return (
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
    );
  const links = instance.links || [];
  const root = links.find((l) => l.orderKey === 'root')?.order;
  const children = links.filter((l) => l.orderKey !== 'root');
  const completedChildren = children.filter((l) => l.order.status === 'FECHADA').length;
  const history = ['HISTORICAL', 'SUPERSEDED'].includes(instance.status);
  const activeSteps = instance.steps.filter((s) => s.status === 'ACTIVE');
  const trackedSteps = trackingSteps(instance);
  const currentStages = trackedSteps.filter((step) =>
    ['ACTIVE', 'FAILED'].includes(step.displayStatus),
  );
  const waitingStages = trackedSteps.filter((step) => step.displayStatus === 'WAITING');
  if (orderId && !manager) {
    const current = links.find((l) => l.order.id === orderId)?.order;
    const tasks = activeSteps.filter((s) => s.orderId === orderId);
    return (
      <section className="panel p-5 space-y-4">
        <h2 className="section-title">Registrar trabalho</h2>
        {instance.status === 'PAUSED' && (
          <p className="rounded-lg border border-warning/30 bg-warning-surface p-3 text-sm text-warning">
            Atendimento pausado pela gestão: o prazo está parado. A etapa poderá ser concluída
            quando o processo for retomado.
          </p>
        )}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {['FECHADA', 'RESOLVIDA'].includes(current?.status || '')
              ? 'Atendimento concluído.'
              : history
                ? 'Este atendimento preservado é somente para consulta; inicie uma nova execução para registrar etapas.'
                : 'Este atendimento aguarda liberação ou outra atividade. Você pode registrar anotações no histórico.'}
          </p>
        )}
        {tasks.map((step) => {
          const node = instance.definition.nodes.find((n) => n.id === step.nodeId)!;
          return (
            <form
              key={`${step.id}:${instance.version}`}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void perform({
                  action: 'advance',
                  stepId: step.id,
                  outcome: form.get('outcome'),
                  reason: form.get('reason'),
                  evidence: Object.fromEntries(
                    node.requiredFields.map((f, i) => [f, String(form.get(`field_${i}`) || '')]),
                  ),
                });
              }}
            >
              <p className="text-sm">{node.name}</p>
              {node.requiredFields.map((field, i) => (
                <label key={field} className="block text-xs">
                  {field}
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-lg border border-border bg-card p-3"
                    name={`field_${i}`}
                    required
                  />
                </label>
              ))}
              <label className="block text-xs">
                O que você fez?
                <textarea
                  name="reason"
                  className="mt-2 min-h-24 w-full rounded-lg border border-border bg-card p-3"
                  required
                  minLength={3}
                />
              </label>
              {Object.keys(node.routes).length === 1 ? (
                <input type="hidden" name="outcome" value={Object.keys(node.routes)[0]} />
              ) : (
                <label className="block text-xs">
                  Resultado do atendimento
                  <select className="native-select mt-2 w-full" name="outcome" required>
                    <option value="">Selecione o resultado</option>
                    {Object.keys(node.routes).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              )}
              <Button type="submit" disabled={action.pending || instance.status !== 'ACTIVE'}>
                {Object.keys(node.routes).every((v) => node.closeOn.includes(v))
                  ? 'Concluir O.S.'
                  : 'Registrar resultado'}
              </Button>
            </form>
          );
        })}
      </section>
    );
  }
  if (!manager)
    return (
      <section className="panel p-5">
        <ExecutionTracking instance={instance} base={base} userId={scope?.userId} />
      </section>
    );
  return (
    <section className="panel space-y-5 p-5">
      <PanelHeading
        title={`${instance.occurrence.provider} · ${instance.definition.name}`}
        description={`${history && instance.status === 'HISTORICAL' ? 'Histórico preservado · sem etapa do fluxo registrada' : flowStatuses[instance.status] || instance.status} · versão publicada ${instance.templateVersion} · revisão ${instance.version}`}
      />
      <div className="flex flex-wrap gap-3 text-xs">
        <Link className="text-link" href={`${base}/processos/${id}`}>
          Link desta execução
        </Link>
        {manager && (
          <Link className="text-link" href={`${base}/workflows/${instance.templateCode}`}>
            Ver modelo publicado
          </Link>
        )}
        <Link className="text-link" href={`${base}/ocorrencias/${instance.occurrence.id}`}>
          Abrir ocorrência
        </Link>
      </div>
      {!history && (
        <div
          className={`rounded-lg border p-4 text-sm ${instance.state.mode === 'DEMO' ? 'border-warning/30 bg-warning-surface text-warning' : 'border-border'}`}
        >
          {instance.state.mode === 'DEMO'
            ? 'DEMONSTRAÇÃO: ordens e evidências deste processo são simuladas para experimentar o fluxo. Avisos externos não são enviados.'
            : 'Fluxo piloto com metas propostas. Histórico de origem e SLA contratual são tratados separadamente.'}
        </div>
      )}
      {instance.state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 p-4 text-sm text-danger">
          {instance.state.error}
        </div>
      )}
      {history && <ImportedFlowSummary instance={instance} root={root} base={base} />}
      {!history && instance.state.classificationBasis && (
        <div className="rounded-lg border border-border p-4 text-xs leading-6">
          <strong>Enquadramento proposto:</strong> {instance.state.classificationBasis}
        </div>
      )}
      {instance.state.successorId && (
        <Link className="text-link" href={`${base}/processos/${instance.state.successorId}`}>
          Abrir proposta revisada pelo conteúdo da demanda →
        </Link>
      )}
      {!history && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">O.S. principal</p>
            {root && (
              <Link className="mt-2 block text-sm font-semibold" href={`${base}/ordens/${root.id}`}>
                {root.protocol} ·{' '}
                {orderStatuses[root.status as keyof typeof orderStatuses] || root.status}
              </Link>
            )}
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Processo completo</p>
            <p className="mt-2 text-sm font-semibold">{flowStatuses[instance.status]}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">O.S. derivadas concluídas</p>
            <p className="mt-2 text-sm font-semibold">
              {children.length
                ? `${completedChildren} de ${children.length} · ${Math.round((completedChildren / children.length) * 100)}%`
                : 'Sem O.S. derivadas'}
            </p>
            {!!children.length && (
              <progress
                aria-label="Progresso das O.S. derivadas"
                value={completedChildren}
                max={children.length}
                className="mt-3 w-full"
              />
            )}
          </div>
        </div>
      )}
      {!history && (
        <section
          aria-label="Etapa atual do atendimento"
          className="rounded-xl border-2 border-info/50 bg-info/5 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-info">
            Onde está o atendimento agora?
          </p>
          {instance.status === 'PAUSED' && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning-surface p-3 text-sm text-warning">
              Processo pausado: o prazo está parado. Use “Retomar processo” abaixo para continuar.
            </p>
          )}
          {currentStages.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {currentStages.map((step) => {
                const node = instance.definition.nodes.find((item) => item.id === step.nodeId);
                const order = links.find((link) => link.order.id === step.orderId)?.order;
                return (
                  <div key={step.id} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold">
                      {step.displayStatus === 'FAILED' ? 'Bloqueio ou falha' : 'Em execução agora'}
                    </p>
                    <p className="mt-2 font-medium">{node?.name || 'Etapa em andamento'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order?.protocol || 'Sem O.S. vinculada'} ·{' '}
                      {node?.sector || 'Setor não definido'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : waitingStages.length ? (
            <p className="mt-2 text-sm">
              Aguardando:{' '}
              {waitingStages
                .map(
                  (step) =>
                    instance.definition.nodes.find((item) => item.id === step.nodeId)?.name ||
                    step.nodeId,
                )
                .join(', ')}
            </p>
          ) : (
            <p className="mt-2 text-sm">
              {instance.status === 'COMPLETED'
                ? 'Fluxo concluído. Consulte abaixo as O.S. e os resultados.'
                : 'Nenhuma etapa em execução no momento. Verifique o estado do processo e as O.S. abaixo.'}
            </p>
          )}
        </section>
      )}
      {instance.status === 'HISTORICAL' && manager && (
        <Button disabled={action.pending} onClick={() => void demo()}>
          {instance.state.demoId
            ? 'Abrir demonstração deste caso'
            : 'Experimentar este fluxo em demonstração'}
        </Button>
      )}
      {instance.status === 'HISTORICAL' &&
        manager &&
        root &&
        !['FECHADA', 'CANCELADA'].includes(root.status) &&
        (root.processInstanceId === instance.id ? (
          <Button
            variant="outline"
            disabled={action.pending}
            onClick={async () => {
              try {
                await action.execute({
                  path: `${endpoint}/${id}/activate`,
                  method: 'POST',
                  body: { expectedVersion: instance.version },
                });
                await query.mutate();
                onChanged?.();
                toast.success('Acompanhamento iniciado na triagem');
              } catch (e) {
                toast.error(errorText(e));
              }
            }}
          >
            Ativar acompanhamento da O.S. aberta
          </Button>
        ) : (
          <Link className="text-link" href={`${base}/processos/${root.processInstanceId}`}>
            Esta O.S. aberta conserva o processo anterior · abrir acompanhamento original →
          </Link>
        ))}
      {history ? (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Ver desenho do fluxo de referência (não executado)
          </summary>
          <p className="my-4 text-sm text-muted-foreground">
            Modelo: {instance.definition.name}. O diagrama mostra uma proposta; não mostra etapas
            realizadas nesta O.S.
          </p>
          <Graph definition={instance.definition} />
        </details>
      ) : (
        <>
          <h3 className="text-base font-semibold">Etapas atuais do fluxo</h3>
          <Graph
            definition={instance.definition}
            states={Object.fromEntries(
              trackingSteps(instance).map((s) => [s.nodeId, s.displayStatus]),
            )}
            active={trackingSteps(instance)
              .filter((s) => s.displayStatus === 'ACTIVE')
              .map((s) => s.nodeId)}
            completed={trackingSteps(instance)
              .filter((s) => s.displayStatus === 'COMPLETED')
              .map((s) => s.nodeId)}
          />
        </>
      )}
      {children.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {['O.S. derivada', 'Setor', 'Responsável', 'Estado', 'Prazo proposto'].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {children.map(({ order: o }) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3">
                    <Link className="text-link" href={`${base}/ordens/${o.id}`}>
                      {o.protocol} · {o.title}
                    </Link>
                  </td>
                  <td className="p-3">{o.sector}</td>
                  <td className="p-3">{o.analystName || 'Fila do setor'}</td>
                  <td className="p-3">{orderStatuses[o.status as keyof typeof orderStatuses]}</td>
                  <td className="p-3">{date(o.deadlineAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!history &&
        activeSteps
          .filter((s) => !orderId || s.orderId === orderId)
          .map((step) => {
            const node = instance.definition.nodes.find((n) => n.id === step.nodeId)!;
            const order = links.find((l) => l.order.id === step.orderId)?.order;
            const outcomes = Object.keys(node.routes);
            const closes = outcomes.length > 0 && outcomes.every((v) => node.closeOn.includes(v));
            const overdue = step.dueAt && new Date(step.dueAt).getTime() < now;
            return (
              <div
                key={step.id}
                className="flex flex-col gap-4 rounded-xl border border-info/30 p-5"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Etapa atual</p>
                    <h3 className="text-base font-semibold">{node.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order?.protocol} · {node.sector} · {order?.analystName || 'Fila do setor'}
                      {step.attempt > 1 ? ` · ${step.attempt}ª tentativa` : ''}
                    </p>
                  </div>
                  <span
                    className={`status-badge ${instance.status === 'PAUSED' ? 'status-warning' : overdue ? 'status-danger' : 'status-info'}`}
                  >
                    {instance.status === 'PAUSED'
                      ? 'Pausada · prazo parado'
                      : `Prazo da etapa ${date(step.dueAt)}`}
                  </span>
                </header>
                {node.roles.includes(scope?.role || '') && (
                  <form
                    key={`${step.id}:${instance.version}`}
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const evidence = Object.fromEntries(
                        node.requiredFields.map((field, i) => [
                          field,
                          String(form.get(`field_${i}`) || ''),
                        ]),
                      );
                      void perform({
                        action: 'advance',
                        stepId: step.id,
                        outcome: form.get('outcome'),
                        reason: form.get('reason'),
                        evidence,
                      });
                    }}
                  >
                    {node.requiredFields.map((field, i) => (
                      <label
                        key={field}
                        className="flex flex-col gap-1.5 text-xs text-muted-foreground"
                      >
                        {field}
                        <textarea
                          className="native-select min-h-20 w-full"
                          name={`field_${i}`}
                          required
                        />
                      </label>
                    ))}
                    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      O que foi feito
                      <textarea
                        name="reason"
                        className="native-select min-h-20 w-full"
                        placeholder="Resumo para o histórico da O.S."
                        required
                        minLength={3}
                      />
                    </label>
                    {outcomes.length === 1 ? (
                      <input type="hidden" name="outcome" value={outcomes[0]} />
                    ) : (
                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1.5 text-xs text-muted-foreground">Resultado</legend>
                        <div className="flex flex-wrap gap-2">
                          {outcomes.map((outcome, i) => (
                            <label
                              key={outcome}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                            >
                              <input
                                type="radio"
                                name="outcome"
                                value={outcome}
                                required={i === 0}
                                className="accent-primary"
                              />
                              {outcome}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={action.pending || instance.status !== 'ACTIVE'}
                      >
                        {closes ? 'Concluir etapa e a O.S.' : 'Concluir etapa'}
                      </Button>
                      {instance.status === 'PAUSED' && (
                        <span className="text-xs text-muted-foreground">
                          Retome o processo para concluir a etapa.
                        </span>
                      )}
                    </div>
                  </form>
                )}
                <details className="rounded-lg border border-border px-4 py-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Encaminhar esta etapa para outra pessoa
                  </summary>
                  <form
                    className="mt-3 flex flex-wrap gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      void perform({
                        action: 'assign',
                        stepId: step.id,
                        assigneeUserId: form.get('assignee'),
                        reason: form.get('reason'),
                      });
                    }}
                  >
                    <select
                      className="native-select"
                      name="assignee"
                      aria-label={`Responsável: ${node.name}`}
                      required
                    >
                      <option value="">Escolha a pessoa…</option>
                      {people.data
                        ?.filter((p) => node.roles.includes(p.role) && !p.accessBlocked)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <input
                      className="native-select min-w-48 flex-1"
                      name="reason"
                      placeholder="Motivo do encaminhamento"
                      minLength={3}
                      required
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={action.pending || instance.status !== 'ACTIVE'}
                    >
                      Encaminhar
                    </Button>
                  </form>
                </details>
              </div>
            );
          })}
      {!history && (
        <ProcessActions
          status={instance.status}
          manager={manager}
          pending={action.pending}
          onRun={(processAction, reason) => perform({ action: processAction, reason })}
        />
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Histórico de etapas e evidências ({instance.steps.length})
        </summary>
        <div className="mt-4 space-y-3">
          {instance.steps.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">
                {instance.definition.nodes.find((n) => n.id === s.nodeId)?.name} ·{' '}
                {STEP_STATUS[s.status] || s.status} · tentativa {s.attempt}
              </p>
              <p className="my-2 text-muted-foreground">
                {date(s.enteredAt)} → {date(s.completedAt)} · {s.outcome}
              </p>
              {Object.entries(s.evidence).map(([k, v]) => (
                <p key={k} className="whitespace-pre-wrap leading-5">
                  <strong>{k}:</strong> {v}
                </p>
              ))}
            </div>
          ))}
          {history && (
            <p className="text-xs">
              Consulte a O.S. principal para ler os comentários originais. Etapas internas não foram
              reconstruídas.
            </p>
          )}
        </div>
      </details>
      {!!instance.events?.length && (
        <details>
          <summary className="cursor-pointer text-sm">Eventos e automações pontuais</summary>
          {instance.events.map((e) => (
            <p key={e.id} className="my-3 text-xs">
              {e.type} ·{' '}
              {e.status === 'DEMO_RECORDED'
                ? 'Registrado em demonstração, sem envio externo'
                : e.status}{' '}
              · {e.attempts} tentativas{e.error ? ` · ${e.error}` : ''}
            </p>
          ))}
          {manager && instance.events.some((e) => e.status === 'FAILED') && (
            <form
              className="flex flex-wrap gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const reason = String(new FormData(e.currentTarget).get('reason') || '');
                try {
                  await action.execute({
                    path: `${endpoint}/${id}/events/retry`,
                    method: 'POST',
                    body: { reason },
                  });
                  await query.mutate();
                  toast.success('Eventos encaminhados para nova tentativa');
                } catch (error) {
                  toast.error(errorText(error));
                }
              }}
            >
              <input
                name="reason"
                className="native-select"
                placeholder="Motivo da retomada das automações"
                minLength={3}
                required
              />
              <Button type="submit" variant="outline" disabled={action.pending}>
                Retomar eventos com falha
              </Button>
            </form>
          )}
        </details>
      )}
    </section>
  );
}

const STEP_STATUS: Record<string, string> = {
  ACTIVE: 'Em execução',
  COMPLETED: 'Concluída',
  WAITING: 'Aguardando',
  FAILED: 'Falha',
  CANCELED: 'Cancelada',
  SKIPPED: 'Pulada',
};
const PROCESS_ACTIONS: Record<
  string,
  { label: string; title: string; help: string; danger?: boolean; primary?: boolean }
> = {
  pause: {
    label: 'Pausar processo',
    title: 'Pausar o processo?',
    help: 'As etapas ficam paradas e o prazo deixa de correr até alguém retomar.',
  },
  resume: {
    label: 'Retomar processo',
    title: 'Retomar o processo?',
    help: 'As etapas voltam a andar e o prazo volta a correr.',
    primary: true,
  },
  retry: {
    label: 'Repetir comando que falhou',
    title: 'Repetir o comando que falhou?',
    help: 'O ERP tenta de novo a última operação que deu erro.',
    primary: true,
  },
  reopen: {
    label: 'Reabrir processo',
    title: 'Reabrir o processo?',
    help: 'Reaproveita as O.S. existentes e volta o fluxo para execução.',
  },
  cancel: {
    label: 'Cancelar processo',
    title: 'Cancelar o processo e as O.S. pendentes?',
    help: 'As O.S. ainda abertas deste processo são canceladas. Não dá para desfazer.',
    danger: true,
  },
};

/** Ações sobre o processo inteiro, em botões explícitos e sempre com justificativa. */
function ProcessActions({
  status,
  manager,
  pending,
  onRun,
}: {
  status: string;
  manager: boolean;
  pending: boolean;
  onRun: (action: string, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const available = [
    status === 'ACTIVE' && 'pause',
    status === 'PAUSED' && 'resume',
    status === 'FAILED' && manager && 'retry',
    ['COMPLETED', 'CANCELED'].includes(status) && manager && 'reopen',
    ['ACTIVE', 'PAUSED', 'WAITING', 'FAILED'].includes(status) && manager && 'cancel',
  ].filter(Boolean) as string[];
  if (!available.length) return null;
  const current = open ? PROCESS_ACTIONS[open] : null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
      <span className="mr-2 text-xs text-muted-foreground">Processo inteiro:</span>
      {available.map((key) => (
        <Button
          key={key}
          size="sm"
          variant={
            PROCESS_ACTIONS[key].primary
              ? 'default'
              : PROCESS_ACTIONS[key].danger
                ? 'ghost'
                : 'outline'
          }
          className={PROCESS_ACTIONS[key].danger ? 'text-danger hover:text-danger' : undefined}
          disabled={pending}
          onClick={() => {
            setReason('');
            setOpen(key);
          }}
        >
          {PROCESS_ACTIONS[key].label}
        </Button>
      ))}
      <Dialog open={!!open} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current?.title}</DialogTitle>
            <DialogDescription>{current?.help}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const key = open!;
              setOpen(null);
              await onRun(key, reason.trim());
            }}
          >
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Justificativa (fica no histórico)
              <textarea
                className="native-select min-h-20"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                Voltar
              </Button>
              <Button
                type="submit"
                className={current?.danger ? 'bg-danger text-white hover:bg-danger/90' : undefined}
                disabled={reason.trim().length < 3}
              >
                {current?.label}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OperationalOrderPanel({
  orderId,
  processId,
  base = '/gerencia',
  onChanged,
}: {
  orderId: string;
  processId?: string | null;
  base?: string;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { scope } = useErp();
  const [open, setOpen] = useState(false);
  const action = useErpAction();
  const allowed = ['super_admin', 'gerente', 'analista'].includes(scope?.role || '');
  const list = useErpQuery<FlowInstance[]>(allowed ? endpoint : null);
  const templates = useErpQuery<FlowTemplate[]>(
    allowed && !processId ? `${endpoint}/templates` : null,
  );
  const run = list.data?.find((p) => p.id === processId);
  if (!allowed) return null;
  if (scope?.role === 'analista')
    return run ? (
      <OperationalExecution id={run.id} orderId={orderId} base={base} onChanged={onChanged} />
    ) : (
      <QueryState loading={list.isLoading} error={list.error} />
    );
  if (run)
    return (
      <div className="mb-5">
        <Button variant="outline" className="mb-4" onClick={() => setOpen(!open)}>
          {open ? 'Recolher etapas desta O.S.' : 'Executar etapas desta O.S.'}
        </Button>
        {open && <OperationalExecution id={run.id} orderId={orderId} base={base} />}
      </div>
    );
  if (processId) return null;
  return (
    <form
      className="mb-5 flex flex-wrap gap-3 rounded-lg border border-border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get('code') || '');
        try {
          const result = await action.execute<{ id: string }>({
            path: endpoint,
            method: 'POST',
            body: { orderId, templateCode: code },
          });
          router.push(`${base}/processos/${result.id}`);
        } catch (error) {
          toast.error(errorText(error));
        }
      }}
    >
      <select
        className="native-select"
        name="code"
        aria-label="Fluxo de atendimento para esta O.S."
        required
      >
        <option value="">Associar fluxo a esta O.S. aberta…</option>
        {templates.data
          ?.filter((t) => t.publishedAt)
          .map((t) => (
            <option key={t.code} value={t.code}>
              {t.definition.name}
            </option>
          ))}
      </select>
      <Button type="submit" disabled={action.pending}>
        Iniciar fluxo
      </Button>
    </form>
  );
}
