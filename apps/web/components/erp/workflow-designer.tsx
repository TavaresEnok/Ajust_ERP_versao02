'use client';
/**
 * Fluxos de atendimento: lista de fluxos em cartões e editor em duas áreas
 * (diagrama à esquerda, etapa selecionada à direita). As regras de montagem do fluxo
 * (próxima etapa, entregas paralelas, validação, simulação e publicação) são as mesmas
 * do editor anterior; só a apresentação mudou.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, GitBranch, Plus, Trash2, Workflow } from 'lucide-react';
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
import { orderTypes } from '@/lib/erp/contracts';
import {
  simulateFlow,
  type FlowDefinition,
  type FlowNode,
  type FlowTemplate,
} from '@/lib/erp/operational-flow';
import { PageHeading } from './primitives';
import { QueryState } from './contract-form';
import { WorkflowsPage } from './catalog-pages';

const Graph = dynamic(
  () => import('./operational-flow-graph').then((m) => m.OperationalFlowGraph),
  { ssr: false },
);
const endpoint = '/service-processes/operational';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Falha na operação');
type Person = { id: string; name: string; role: string; accessBlocked: boolean };
type CatalogItem = {
  id: string;
  name: string;
  workflowTemplateCode?: string | null;
  active?: boolean;
};

// Draft identifiers are not credentials. getRandomValues also works on the HTTP pilot address,
// whereas randomUUID is available only in secure browser contexts.
export function draftId() {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('');
}

export function blankDefinition(): FlowDefinition {
  const node: FlowNode = {
    id: 'triagem',
    name: 'Analisar demanda',
    kind: 'task',
    orderKey: 'root',
    sector: 'NOC',
    roles: ['super_admin', 'gerente', 'analista'],
    serviceType: 'CONSULTORIA_GERAL',
    slaMinutes: 60,
    requiredFields: ['Resultado técnico'],
    routes: { Concluído: 'fim' },
    closeOn: ['Concluído'],
    waitFor: [],
    position: { x: 50, y: 50 },
  };
  return {
    engineVersion: 2,
    code: `ATEND_${draftId().toUpperCase()}`,
    name: 'Novo tipo de atendimento',
    version: 1,
    description: 'Fluxo de atendimento proposto.',
    sourceTypes: [],
    start: 'triagem',
    maxVisits: 5,
    nodes: [
      node,
      {
        ...node,
        id: 'fim',
        name: 'Atendimento concluído',
        kind: 'end',
        requiredFields: [],
        closeOn: [],
        routes: {},
        position: { x: 400, y: 50 },
      },
    ],
  };
}

/** Como cada tipo de bloco aparece para o gestor. */
const KINDS: Record<FlowNode['kind'], { chip: string; label: string; help: string }> = {
  task: {
    chip: 'Etapa',
    label: 'Alguém executa e escolhe o resultado',
    help: 'A equipe faz o trabalho, registra as evidências e escolhe um dos resultados abaixo.',
  },
  fork: {
    chip: 'Divisão',
    label: 'Divide em trabalhos paralelos',
    help: 'Abre ao mesmo tempo os caminhos ligados aos resultados abaixo.',
  },
  join: {
    chip: 'Junção',
    label: 'Espera os trabalhos paralelos',
    help: 'Só segue quando todas as entregas marcadas terminarem.',
  },
  end: {
    chip: 'Fim',
    label: 'Fim do atendimento',
    help: 'Encerra o fluxo. Não tem resultados.',
  },
};
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Administrador',
  gerente: 'Gerente',
  analista: 'Analista',
};

export function WorkflowsHub({ id }: { id?: string }) {
  const [tab, setTab] = useState(id && !/^(ATEND_|AJUST_)/.test(id) ? 'events' : 'operational');
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  return (
    <>
      <div
        role="tablist"
        aria-label="Tipo de configuração"
        className="mb-6 inline-flex flex-wrap rounded-lg border border-border p-0.5 text-sm"
      >
        {(
          [
            ['operational', 'Fluxos de atendimento'],
            ['events', 'Automações por evento'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => (dirty && value !== tab ? setPendingTab(value) : setTab(value))}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              tab === value
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {tab === 'operational' ? (
        <OperationalTemplates
          code={id && /^(ATEND_|AJUST_)/.test(id) ? id : undefined}
          onDirtyChange={setDirty}
        />
      ) : (
        <WorkflowsPage id={id?.startsWith('ATEND_') ? undefined : id} />
      )}
      <ConfirmDialog
        open={pendingTab !== null}
        title="Sair sem salvar?"
        description="As alterações deste fluxo ainda não foram salvas e serão perdidas."
        confirm="Sair sem salvar"
        onCancel={() => setPendingTab(null)}
        onConfirm={() => {
          setDirty(false);
          setTab(pendingTab!);
          setPendingTab(null);
        }}
      />
    </>
  );
}

function OperationalTemplates({
  code,
  onDirtyChange,
}: {
  code?: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { scope } = useErp();
  const router = useRouter();
  const manager = ['super_admin', 'gerente'].includes(scope?.role || '');
  const query = useErpQuery<FlowTemplate[]>(`${endpoint}/templates`);
  const catalog = useErpQuery<CatalogItem[]>('/service-catalog');
  const [fresh, setFresh] = useState<FlowDefinition | null>(null);
  const row = code ? query.data?.find((t) => t.code === code) : undefined;
  const open = (next?: string) => {
    setFresh(null);
    router.push(next ? `/gerencia/workflows/${next}` : '/gerencia/workflows');
  };

  if (fresh || row) {
    return (
      <FlowEditor
        key={`${row?.code || fresh!.code}:${row?.version || 0}`}
        initial={row?.draft || row?.definition || fresh!}
        template={row}
        revision={row?.version || 0}
        manager={manager}
        catalog={catalog.data || []}
        onCatalogChanged={async () => void (await catalog.mutate())}
        onDirtyChange={onDirtyChange}
        onBack={() => {
          onDirtyChange(false);
          open();
        }}
        onSaved={async (savedCode) => {
          await query.mutate();
          if (fresh) open(savedCode);
        }}
      />
    );
  }

  const templates = (query.data || []).filter((t) => t.publishedAt || t.draft);
  return (
    <>
      <PageHeading
        title="Fluxos de atendimento"
        description="Quais etapas a equipe executa, quem pode concluir e quais evidências registrar. Depois de publicar, vincule o fluxo a um serviço do catálogo."
      >
        {manager && (
          <Button onClick={() => setFresh(blankDefinition())}>
            <Plus />
            Novo fluxo
          </Button>
        )}
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {code && !query.isLoading && !row && (
        <p role="alert" className="mb-4 text-sm text-danger">
          Fluxo {code} não encontrado.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const definition = t.draft || t.definition;
          const steps = definition.nodes.filter((n) => n.kind === 'task').length;
          const services = (catalog.data || []).filter((s) => s.workflowTemplateCode === t.code);
          return (
            <button
              key={t.code}
              type="button"
              onClick={() => open(t.code)}
              className="panel flex flex-col gap-3 p-5 text-left transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="metric-icon">
                  <Workflow />
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {t.publishedAt && (
                    <span className="status-badge status-success">
                      Publicado v{t.definition.version}
                    </span>
                  )}
                  {t.draft && (
                    <span className="status-badge status-warning">
                      {t.publishedAt ? 'Alterações não publicadas' : 'Rascunho'}
                    </span>
                  )}
                </span>
              </div>
              <div>
                <h3 className="font-semibold">{definition.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {steps} {steps === 1 ? 'etapa' : 'etapas'}
                  {t.updatedAt
                    ? ` · alterado em ${new Date(t.updatedAt).toLocaleDateString('pt-BR')}`
                    : ''}
                </p>
              </div>
              <p className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">
                {services.length
                  ? `Usado por: ${services.map((s) => s.name).join(', ')}`
                  : 'Ainda não vinculado a um serviço do catálogo'}
              </p>
            </button>
          );
        })}
      </div>
      {!query.isLoading && !templates.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum fluxo cadastrado. Use “Novo fluxo” para criar o primeiro.
        </p>
      )}
      <Link className="text-link mt-6 inline-flex text-sm" href="/gerencia/servicos?tab=catalog">
        Vincular um fluxo publicado ao catálogo de serviços →
      </Link>
    </>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      {children}
      {hint && <span className="text-[11px]">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function FlowEditor({
  initial,
  template,
  revision,
  manager,
  catalog,
  onCatalogChanged,
  onDirtyChange,
  onBack,
  onSaved,
}: {
  initial: FlowDefinition;
  template?: FlowTemplate;
  revision: number;
  manager: boolean;
  catalog: CatalogItem[];
  onCatalogChanged: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onBack: () => void;
  onSaved: (code: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [selected, setSelected] = useState(initial.start);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [decisions, setDecisions] = useState<{ nodeId: string; outcome: string }[]>([]);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const people = useErpQuery<Person[]>(`${endpoint}/assignees`);
  const action = useErpAction();
  const node = draft.nodes.find((n) => n.id === selected) || draft.nodes[0];
  const simulation = useMemo(() => simulateFlow(draft, decisions), [draft, decisions]);
  const routes = Object.entries(node.routes);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);
  const [confirm, setConfirm] = useState<'leave' | 'publish' | null>(null);
  // Serviço que já segue outro fluxo: trocar exige confirmação.
  const [pendingLink, setPendingLink] = useState<CatalogItem | null>(null);
  const services = catalog.filter((s) => s.workflowTemplateCode === draft.code);
  const others = catalog.filter((s) => s.workflowTemplateCode !== draft.code && s.active !== false);
  // Avisa o resto da página e o navegador (fechar/recarregar) enquanto houver alterações.
  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, onDirtyChange]);
  async function linkService(id: string) {
    setError('');
    try {
      await action.execute({
        path: `/service-catalog/${id}`,
        method: 'PUT',
        body: { workflowTemplateCode: draft.code },
      });
      await onCatalogChanged();
      toast.success('Serviço vinculado a este fluxo');
    } catch (e) {
      setError(errorText(e));
    }
  }
  const canAddNext = node.kind === 'task' && routes.length === 1;
  const canAddParallel =
    node.kind === 'task' &&
    node.orderKey === 'root' &&
    routes.length === 1 &&
    node.closeOn.includes(routes[0][0]) &&
    draft.nodes.find((n) => n.id === routes[0][1])?.kind === 'end';
  const endId = draft.nodes.find((n) => n.kind === 'end')?.id || draft.start;

  function change(patch: Partial<FlowNode>) {
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === node.id ? { ...n, ...patch } : n)),
    }));
    setPreview(false);
  }
  function addNext() {
    const id = `etapa_${draftId()}`;
    const [outcome, target] = routes[0];
    const next: FlowNode = {
      ...node,
      id,
      name: 'Nova etapa',
      requiredFields: ['Resultado técnico'],
      routes: { Concluído: target },
      closeOn: node.closeOn.includes(outcome) ? ['Concluído'] : [],
      waitFor: [],
      position: { x: node.position.x + 280, y: node.position.y },
    };
    setDraft({
      ...draft,
      nodes: [
        ...draft.nodes.map((n) =>
          n.id === node.id
            ? { ...n, routes: { [outcome]: id }, closeOn: [] }
            : n.position.x > node.position.x
              ? { ...n, position: { ...n.position, x: n.position.x + 280 } }
              : n,
        ),
        next,
      ],
    });
    setSelected(id);
  }
  function addParallelDeliveries() {
    const suffix = draftId();
    const [outcome, target] = routes[0];
    const fork = `paralelo_${suffix}`,
      join = `reunir_${suffix}`;
    const children = [1, 2].map((number): FlowNode => ({
      ...node,
      id: `entrega_${number}_${suffix}`,
      name: `Entrega complementar ${number}`,
      orderKey: `entrega_${number}_${suffix}`,
      requiredFields: ['Resultado técnico'],
      routes: { Concluído: join },
      closeOn: ['Concluído'],
      waitFor: [],
      position: { x: node.position.x + 560, y: node.position.y + (number - 1) * 200 },
    }));
    const control = { ...node, closeOn: [], requiredFields: [], waitFor: [] };
    setDraft({
      ...draft,
      nodes: [
        ...draft.nodes.map((n) =>
          n.id === node.id
            ? { ...n, routes: { [outcome]: fork } }
            : n.id === target
              ? { ...n, position: { x: node.position.x + 1120, y: node.position.y } }
              : n,
        ),
        {
          ...control,
          id: fork,
          name: 'Distribuir entregas',
          kind: 'fork',
          routes: { 'Entrega 1': children[0].id, 'Entrega 2': children[1].id },
          position: { x: node.position.x + 280, y: node.position.y },
        },
        ...children,
        {
          ...control,
          id: join,
          name: 'Aguardar as duas entregas',
          kind: 'join',
          waitFor: children.map((n) => n.id),
          routes: { Pronto: target },
          position: { x: node.position.x + 840, y: node.position.y },
        },
      ],
    });
    setSelected(children[0].id);
  }
  function addLoose() {
    const id = `etapa_${draftId()}`;
    setDraft({
      ...draft,
      nodes: [
        ...draft.nodes,
        {
          ...node,
          id,
          name: 'Nova etapa',
          kind: 'task',
          orderKey: 'root',
          routes: { Concluído: endId },
          closeOn: ['Concluído'],
          requiredFields: ['Resultado técnico'],
          waitFor: [],
          position: { x: node.position.x + 280, y: node.position.y + 180 },
        },
      ],
    });
    setSelected(id);
  }
  function removeNode() {
    setDraft({
      ...draft,
      nodes: draft.nodes
        .filter((n) => n.id !== node.id)
        .map((n) => ({
          ...n,
          routes: Object.fromEntries(
            Object.entries(n.routes).filter(([, target]) => target !== node.id),
          ),
          waitFor: n.waitFor.filter((id) => id !== node.id),
        })),
    });
    setSelected(draft.start);
  }
  async function validate() {
    setError('');
    try {
      await action.execute({ path: `${endpoint}/validate`, method: 'POST', body: draft });
      toast.success('Fluxo válido');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  }
  async function save(publish: boolean) {
    setError('');
    try {
      await action.execute({
        path: `${endpoint}/templates`,
        method: 'PUT',
        body: { definition: draft, expectedVersion: revision, publish },
      });
      toast.success(publish ? 'Versão publicada' : 'Rascunho salvo');
      await onSaved(draft.code);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const status = !template
    ? { text: 'Novo · não salvo', tone: 'status-neutral' }
    : template.draft
      ? {
          text: template.publishedAt ? 'Alterações não publicadas' : 'Rascunho',
          tone: 'status-warning',
        }
      : { text: `Publicado v${template.definition.version}`, tone: 'status-success' };

  return (
    <div className="flex flex-col gap-4">
      {/* Barra do fluxo inteiro: nome, situação e ações que valem para todas as etapas. */}
      <header className="panel sticky top-2 z-20 flex flex-wrap items-center gap-3 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (dirty ? setConfirm('leave') : onBack())}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft />
          Fluxos
        </Button>
        <input
          aria-label="Nome do fluxo"
          className="min-w-48 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold hover:border-border focus:border-border focus:outline-none"
          value={draft.name}
          disabled={!manager}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <span className={`status-badge ${dirty ? 'status-warning' : status.tone}`}>
          {dirty ? 'Alterações não salvas' : status.text}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void validate()}>
            Validar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (preview) return setPreview(false);
              if (await validate()) {
                setPreview(true);
                setDecisions([]);
              }
            }}
          >
            {preview ? 'Sair da simulação' : 'Simular'}
          </Button>
          {manager && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={action.pending}
                onClick={() => void save(false)}
              >
                Salvar rascunho
              </Button>
              <Button size="sm" disabled={action.pending} onClick={() => setConfirm('publish')}>
                Publicar
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 text-xs text-muted-foreground">
        <span>
          {services.length
            ? `Usado por: ${services.map((s) => s.name).join(', ')}.`
            : 'Ainda não vinculado a um serviço do catálogo.'}
        </span>
        {manager && template?.publishedAt && others.length > 0 && (
          <select
            aria-label="Vincular um serviço do catálogo a este fluxo"
            className="native-select h-8 w-auto py-0 text-xs"
            value=""
            disabled={action.pending}
            onChange={(e) => {
              const chosen = others.find((s) => s.id === e.target.value);
              if (!chosen) return;
              if (chosen.workflowTemplateCode) setPendingLink(chosen);
              else void linkService(chosen.id);
            }}
          >
            <option value="">Vincular um serviço…</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.workflowTemplateCode ? ' · já usa outro fluxo' : ''}
              </option>
            ))}
          </select>
        )}
        {manager && !template?.publishedAt && (
          <span>Publique o fluxo para poder vincular um serviço.</span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-surface p-4 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Diagrama: clicar numa caixa abre a etapa no painel ao lado. */}
        <section className="panel flex min-w-0 flex-col gap-3 p-3">
          {manager && !preview && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={!canAddNext} onClick={addNext}>
                <Plus />
                Próxima etapa
              </Button>
              {canAddParallel && (
                <Button variant="outline" size="sm" onClick={addParallelDeliveries}>
                  <GitBranch />
                  Trabalho em paralelo
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={addLoose}>
                <Plus />
                Etapa avulsa
              </Button>
              <span className="ml-auto text-[11px] text-muted-foreground">
                Clique numa caixa para editar · arraste para reorganizar
              </span>
            </div>
          )}
          <Graph
            className="h-[520px]"
            minFitZoom={0.7}
            definition={draft}
            selected={selected}
            onSelect={setSelected}
            onChange={manager && !preview ? setDraft : undefined}
            active={preview ? simulation.active : []}
            completed={preview ? simulation.completed : []}
          />
        </section>

        {/* Painel da etapa selecionada (ou da simulação). */}
        <aside className="panel flex flex-col gap-4 p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {preview ? (
            <SimulationPanel
              draft={draft}
              simulation={simulation}
              decisions={decisions}
              onDecide={(nodeId, outcome) => setDecisions([...decisions, { nodeId, outcome }])}
              onRestart={() => setDecisions([])}
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="status-badge status-info">{KINDS[node.kind].chip}</span>
                <select
                  aria-label="Etapa em edição"
                  className="native-select min-w-0 flex-1"
                  value={node.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {draft.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
                {manager && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover esta etapa"
                    title={
                      node.id === draft.start
                        ? 'A primeira etapa não pode ser removida'
                        : 'Remover esta etapa'
                    }
                    disabled={node.id === draft.start}
                    onClick={removeNode}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <fieldset disabled={!manager} className="flex flex-col gap-4">
                <Labeled label="Nome da etapa">
                  <input
                    className="native-select"
                    value={node.name}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </Labeled>
                <Labeled label="O que esta etapa faz" hint={KINDS[node.kind].help}>
                  <select
                    className="native-select"
                    value={node.kind}
                    onChange={(e) => {
                      const kind = e.target.value as FlowNode['kind'];
                      change({
                        kind,
                        closeOn: kind === 'task' ? node.closeOn : [],
                        requiredFields: kind === 'task' ? node.requiredFields : [],
                        routes:
                          kind === 'end'
                            ? {}
                            : Object.keys(node.routes).length
                              ? node.routes
                              : {
                                  Concluído:
                                    draft.nodes.find((n) => n.kind === 'end' && n.id !== node.id)
                                      ?.id || draft.start,
                                },
                        waitFor: kind === 'join' ? node.waitFor : [],
                      });
                    }}
                  >
                    {(Object.keys(KINDS) as FlowNode['kind'][]).map((k) => (
                      <option key={k} value={k}>
                        {KINDS[k].label}
                      </option>
                    ))}
                  </select>
                </Labeled>

                {node.kind === 'task' && (
                  <>
                    <Section title="Execução">
                      <Labeled
                        label="Onde o trabalho é registrado"
                        hint="Na própria O.S. do atendimento, ou numa O.S. separada para esta entrega."
                      >
                        <select
                          className="native-select"
                          value={node.orderKey}
                          onChange={(e) =>
                            change({
                              orderKey:
                                e.target.value === '__new__' ? `os_${draftId()}` : e.target.value,
                            })
                          }
                        >
                          <option value="root">Na O.S. do atendimento</option>
                          {[...new Set(draft.nodes.map((n) => n.orderKey))]
                            .filter((key) => key !== 'root')
                            .map((key) => (
                              <option key={key} value={key}>
                                O.S. separada ·{' '}
                                {draft.nodes.find((n) => n.orderKey === key && n.kind === 'task')
                                  ?.name || key}
                              </option>
                            ))}
                          <option value="__new__">Abrir uma nova O.S. separada</option>
                        </select>
                      </Labeled>
                      <div className="grid grid-cols-2 gap-3">
                        <Labeled label="Setor">
                          <input
                            className="native-select"
                            value={node.sector}
                            onChange={(e) => change({ sector: e.target.value })}
                          />
                        </Labeled>
                        <Labeled label="Prazo da etapa (min)">
                          <input
                            className="native-select"
                            type="number"
                            min={1}
                            value={node.slaMinutes}
                            onChange={(e) => change({ slaMinutes: Number(e.target.value) })}
                          />
                        </Labeled>
                      </div>
                      <Labeled label="Tipo de serviço">
                        <select
                          className="native-select"
                          value={node.serviceType}
                          onChange={(e) => change({ serviceType: e.target.value })}
                        >
                          {Object.entries(orderTypes).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </Labeled>
                      <Labeled
                        label="Responsável"
                        hint="O prazo da etapa serve para acompanhar o fluxo; o SLA da O.S. vem das políticas de SLA."
                      >
                        <select
                          className="native-select"
                          value={node.assigneeUserId || ''}
                          onChange={(e) => {
                            const { assigneeUserId: _, ...rest } = node;
                            change(
                              e.target.value
                                ? { assigneeUserId: e.target.value }
                                : { ...rest, assigneeUserId: undefined },
                            );
                          }}
                        >
                          <option value="">Fila do setor (quem pegar primeiro)</option>
                          {people.data
                            ?.filter((p) => node.roles.includes(p.role) && !p.accessBlocked)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </Labeled>
                    </Section>
                    <Section title="Evidências exigidas">
                      <Labeled label="Uma por linha. A etapa só conclui com todas preenchidas.">
                        <textarea
                          aria-label="Evidências obrigatórias (uma por linha)"
                          className="native-select min-h-24"
                          value={fieldDrafts[node.id] ?? node.requiredFields.join('\n')}
                          onChange={(e) => {
                            setFieldDrafts((current) => ({
                              ...current,
                              [node.id]: e.target.value,
                            }));
                            change({
                              requiredFields: [
                                ...new Set(
                                  e.target.value
                                    .split('\n')
                                    .map((field) => field.trim())
                                    .filter(Boolean),
                                ),
                              ],
                            });
                          }}
                        />
                      </Labeled>
                    </Section>
                    <Section title="Quem pode concluir">
                      <div className="flex flex-wrap gap-4 text-sm">
                        {['super_admin', 'gerente', 'analista'].map((role) => (
                          <label key={role} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={node.roles.includes(role)}
                              onChange={(e) =>
                                change({
                                  roles: e.target.checked
                                    ? [...node.roles, role]
                                    : node.roles.filter((x) => x !== role),
                                })
                              }
                            />
                            {ROLE_LABEL[role]}
                          </label>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                {node.kind === 'join' && (
                  <Section title="Entregas que precisam terminar antes de seguir">
                    {draft.nodes
                      .filter((n) => n.kind === 'task' && n.orderKey !== 'root')
                      .map((n) => (
                        <label key={n.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={node.waitFor.includes(n.id)}
                            onChange={(e) =>
                              change({
                                waitFor: e.target.checked
                                  ? [...node.waitFor, n.id]
                                  : node.waitFor.filter((id) => id !== n.id),
                              })
                            }
                          />
                          {n.name}
                        </label>
                      ))}
                  </Section>
                )}

                {node.kind !== 'end' && (
                  <Section title="Depois desta etapa">
                    <p className="-mt-1 text-[11px] text-muted-foreground">
                      Cada resultado leva a uma próxima etapa. Também dá para ligar caixas
                      arrastando no diagrama.
                    </p>
                    {routes.map(([outcome, target]) => (
                      <div
                        key={outcome}
                        className="flex flex-col gap-2 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{outcome}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover o resultado ${outcome}`}
                            onClick={() =>
                              change({
                                routes: Object.fromEntries(routes.filter(([x]) => x !== outcome)),
                                closeOn: node.closeOn.filter((x) => x !== outcome),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <Labeled label="Segue para">
                          <select
                            className="native-select"
                            aria-label={`Próxima etapa para ${outcome}`}
                            value={target}
                            onChange={(e) =>
                              change({ routes: { ...node.routes, [outcome]: e.target.value } })
                            }
                          >
                            {draft.nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                        </Labeled>
                        {node.kind === 'task' && (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              aria-label={`Encerrar esta O.S. ao selecionar ${outcome}`}
                              checked={node.closeOn.includes(outcome)}
                              onChange={(e) =>
                                change({
                                  closeOn: e.target.checked
                                    ? [...node.closeOn, outcome]
                                    : node.closeOn.filter((x) => x !== outcome),
                                })
                              }
                            />
                            Este resultado encerra a O.S. desta etapa
                          </label>
                        )}
                      </div>
                    ))}
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const result = String(
                          new FormData(e.currentTarget).get('result') || '',
                        ).trim();
                        if (result && !(result in node.routes))
                          change({ routes: { ...node.routes, [result]: endId } });
                        e.currentTarget.reset();
                      }}
                    >
                      <input
                        className="native-select min-w-0 flex-1"
                        name="result"
                        aria-label="Novo resultado"
                        placeholder="Novo resultado (ex.: Sem acesso)"
                        required
                      />
                      <Button type="submit" variant="outline" size="sm" className="self-center">
                        Adicionar
                      </Button>
                    </form>
                  </Section>
                )}

                <details className="border-t border-border pt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer text-sm text-foreground">Avançado</summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <Labeled
                      label="Quantas vezes uma etapa pode se repetir"
                      hint="Vale para o fluxo inteiro; evita voltas infinitas."
                    >
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="native-select w-24"
                        value={draft.maxVisits}
                        onChange={(e) => setDraft({ ...draft, maxVisits: Number(e.target.value) })}
                      />
                    </Labeled>
                    <p>
                      Identificador da etapa: <code>{node.id}</code> · do fluxo:{' '}
                      <code>{draft.code}</code>
                    </p>
                  </div>
                </details>
              </fieldset>
            </>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={confirm === 'leave'}
        title="Sair sem salvar?"
        description="As alterações deste fluxo ainda não foram salvas e serão perdidas."
        confirm="Sair sem salvar"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          onBack();
        }}
      />
      <ConfirmDialog
        open={!!pendingLink}
        title="Trocar o fluxo deste serviço?"
        description={`“${pendingLink?.name}” hoje segue o fluxo ${pendingLink?.workflowTemplateCode}. Se confirmar, as próximas O.S. desse serviço passam a seguir “${draft.name}”. Atendimentos em andamento não mudam.`}
        confirm="Trocar fluxo"
        onCancel={() => setPendingLink(null)}
        onConfirm={() => {
          const id = pendingLink!.id;
          setPendingLink(null);
          void linkService(id);
        }}
      />
      <ConfirmDialog
        open={confirm === 'publish'}
        title="Publicar esta versão?"
        description={
          (services.length
            ? `Novas O.S. de ${services.map((s) => s.name).join(', ')} passam a seguir esta versão. `
            : 'O fluxo ainda não está vinculado a nenhum serviço; depois de publicar, vincule um. ') +
          'Atendimentos em andamento continuam na versão em que começaram.'
        }
        confirm="Publicar"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void save(true);
        }}
      />
    </div>
  );
}

function SimulationPanel({
  draft,
  simulation,
  decisions,
  onDecide,
  onRestart,
}: {
  draft: FlowDefinition;
  simulation: ReturnType<typeof simulateFlow>;
  decisions: { nodeId: string; outcome: string }[];
  onDecide: (nodeId: string, outcome: string) => void;
  onRestart: () => void;
}) {
  return (
    <>
      <div>
        <h3 className="font-semibold">Simulação</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Nada é gravado. Escolha os resultados e acompanhe no diagrama. Na execução real, o ERP
          ainda exige evidências e responsáveis.
        </p>
      </div>
      {simulation.active.map((id) => {
        const n = draft.nodes.find((x) => x.id === id)!;
        return (
          <div key={id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{n.name}</p>
            {n.kind === 'task' ? (
              <div className="flex flex-wrap gap-2">
                {Object.keys(n.routes).map((outcome) => (
                  <Button
                    key={outcome}
                    variant="outline"
                    size="sm"
                    onClick={() => onDecide(id, outcome)}
                  >
                    {outcome}
                  </Button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Aguardando os trabalhos paralelos
              </span>
            )}
          </div>
        );
      })}
      {simulation.active.length === 0 && (
        <p className="text-sm text-success">O fluxo chegou ao fim.</p>
      )}
      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {decisions.length}{' '}
          {decisions.length === 1 ? 'resultado escolhido' : 'resultados escolhidos'}
          {simulation.limited ? ' · limite de repetições atingido' : ''}
        </span>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          Recomeçar
        </Button>
      </div>
    </>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
