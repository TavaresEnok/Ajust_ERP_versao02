'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { orderTypes, orderStatuses } from '@/lib/erp/contracts';
import {
  flowStatuses,
  simulateFlow,
  type FlowDefinition,
  type FlowNode,
  type FlowTemplate,
  type FlowInstance,
  trackingSteps,
} from '@/lib/erp/operational-flow';
import { ExecutionTracking, ImportedFlowSummary } from './execution-tracking';
import { PageHeading, PanelHeading } from './primitives';
import { QueryState } from './contract-form';
import { WorkflowsPage } from './catalog-pages';
import { ServiceProcessesPage } from './service-processes';
const Graph = dynamic(
  () => import('./operational-flow-graph').then((m) => m.OperationalFlowGraph),
  { ssr: false },
);
const endpoint = '/service-processes/operational';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Falha na operação');
const date = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
type Person = { id: string; name: string; role: string; accessBlocked: boolean };

// Draft identifiers are not credentials. getRandomValues also works on the HTTP pilot address,
// whereas randomUUID is available only in secure browser contexts.
function draftId() {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('');
}

function blankDefinition(): FlowDefinition {
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

export function WorkflowsHub({ id }: { id?: string }) {
  const [tab, setTab] = useState(id && !/^(ATEND_|AJUST_)/.test(id) ? 'events' : 'operational');
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={tab === 'operational' ? 'default' : 'outline'}
          onClick={() => setTab('operational')}
        >
          Fluxos de atendimento
        </Button>
        <Button variant={tab === 'events' ? 'default' : 'outline'} onClick={() => setTab('events')}>
          Automações por evento
        </Button>
        <Link className="text-link self-center px-3" href="/gerencia/processos">
          Acompanhar execuções →
        </Link>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {tab === 'operational'
          ? 'Organize o trabalho: quais etapas a equipe executa, quem pode concluir e quais evidências registrar. Depois de publicar, vincule o fluxo a um serviço do catálogo.'
          : 'Automatize respostas a eventos, como solicitar uma pesquisa após fechar uma O.S. As etapas de trabalho da equipe ficam em Fluxos de atendimento.'}
      </p>
      {tab === 'operational' ? (
        <OperationalTemplates code={id && /^(ATEND_|AJUST_)/.test(id) ? id : undefined} />
      ) : (
        <WorkflowsPage id={id?.startsWith('ATEND_') ? undefined : id} />
      )}
    </>
  );
}

function OperationalTemplates({ code }: { code?: string }) {
  const { scope } = useErp();
  const manager = ['super_admin', 'gerente'].includes(scope?.role || '');
  const query = useErpQuery<FlowTemplate[]>(`${endpoint}/templates`);
  const [selected, setSelected] = useState(code || '');
  const [fresh, setFresh] = useState<FlowDefinition | null>(null);
  const row =
    query.data?.find((t) => t.code === selected) ||
    (!selected ? query.data?.find((t) => t.publishedAt || t.draft) || query.data?.[0] : undefined);
  return (
    <>
      <PageHeading
        title="Fluxos de atendimento"
        description="Defina etapas na mesma O.S., decisões e trabalhos independentes. Publicar preserva as versões já em execução."
      >
        {manager && (
          <Button
            onClick={() => {
              const d = blankDefinition();
              setFresh(d);
              setSelected(d.code);
            }}
          >
            Novo fluxo
          </Button>
        )}
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <select
          className="native-select max-w-full"
          value={row?.code || fresh?.code || ''}
          aria-label="Tipo de atendimento"
          onChange={(e) => {
            setSelected(e.target.value);
            setFresh(null);
          }}
        >
          {fresh && !query.data?.some((t) => t.code === fresh.code) && (
            <option value={fresh.code}>{fresh.name}</option>
          )}
          {query.data
            ?.filter((t) => t.publishedAt || t.draft || t.code === row?.code)
            .map((t) => (
              <option key={t.code} value={t.code}>
                {t.definition.name}
                {t.publishedAt
                  ? ` · publicada v${t.definition.version}`
                  : t.draft
                    ? ' · rascunho'
                    : ' · arquivo de compatibilidade'}
              </option>
            ))}
        </select>
        <p className="self-center text-xs text-muted-foreground">
          {row?.draft
            ? 'Há um rascunho salvo. Publique para aplicá-lo às novas O.S.'
            : 'Alterações publicadas valem para novas O.S.; atendimentos em andamento mantêm sua versão.'}
        </p>
      </div>
      <Link className="text-link mb-5 inline-flex" href="/gerencia/servicos?tab=catalog">
        Vincular um fluxo publicado ao catálogo de serviços →
      </Link>
      {(row || fresh) && (
        <FlowEditor
          key={`${row?.code || fresh!.code}:${row?.version || 0}`}
          initial={row?.draft || row?.definition || fresh!}
          revision={row?.version || 0}
          manager={manager}
          onSaved={async () => {
            await query.mutate();
            setFresh(null);
          }}
        />
      )}
      {!query.isLoading && !row && !fresh && (
        <p className="text-sm text-muted-foreground">
          Nenhum modelo cadastrado. Importe a amostra ou crie um fluxo.
        </p>
      )}
    </>
  );
}

function FlowEditor({
  initial,
  revision,
  manager,
  onSaved,
}: {
  initial: FlowDefinition;
  revision: number;
  manager: boolean;
  onSaved: () => Promise<void>;
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
  const simulation = simulateFlow(draft, decisions);
  const routes = Object.entries(node.routes);
  const canAddParallel =
    node.kind === 'task' &&
    node.orderKey === 'root' &&
    routes.length === 1 &&
    node.closeOn.includes(routes[0][0]) &&
    draft.nodes.find((n) => n.id === routes[0][1])?.kind === 'end';
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
  function change(patch: Partial<FlowNode>) {
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === node.id ? { ...n, ...patch } : n)),
    }));
    setPreview(false);
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
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <section className="panel space-y-5 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs">
          Nome do serviço
          <input
            className="native-select mt-2"
            value={draft.name}
            disabled={!manager}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Dê um nome ao fluxo, configure a primeira etapa e use “Adicionar próxima etapa” para
        continuar na mesma O.S. Simule os resultados antes de publicar. O diagrama acompanha as
        alterações.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-surface p-4 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Graph
        definition={draft}
        selected={selected}
        onSelect={setSelected}
        onChange={manager && !preview ? setDraft : undefined}
        active={preview ? simulation.active : []}
        completed={preview ? simulation.completed : []}
      />
      <div className="flex flex-wrap gap-2">
        {manager && (
          <>
            <Button variant="outline" disabled={action.pending} onClick={() => void save(false)}>
              Salvar rascunho
            </Button>
            <Button disabled={action.pending} onClick={() => void save(true)}>
              Publicar nova versão
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => void validate()}>
          Validar configuração
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (await validate()) {
              setPreview(true);
              setDecisions([]);
            }
          }}
        >
          Simular sem criar O.S.
        </Button>
        {preview && (
          <Button variant="ghost" onClick={() => setPreview(false)}>
            Sair da simulação
          </Button>
        )}
      </div>
      {preview && (
        <div className="rounded-lg border border-info/30 p-4 text-sm">
          <strong>Simulação visual · nenhuma gravação operacional</strong>
          <p className="my-3 text-xs">
            Escolha os resultados. A execução real exige evidências, responsáveis e validações do
            ERP.
          </p>
          <div className="flex flex-wrap gap-3">
            {simulation.active.map((id) => {
              const n = draft.nodes.find((x) => x.id === id)!;
              return (
                <div key={id} className="rounded-lg border border-border p-3">
                  <p className="mb-2 font-medium">{n.name}</p>
                  {n.kind === 'task' ? (
                    Object.keys(n.routes).map((outcome) => (
                      <Button
                        className="m-1"
                        key={outcome}
                        variant="outline"
                        onClick={() => setDecisions([...decisions, { nodeId: id, outcome }])}
                      >
                        {outcome}
                      </Button>
                    ))
                  ) : (
                    <span>Aguardando os ramos obrigatórios</span>
                  )}
                </div>
              );
            })}
            {simulation.active.length === 0 && <p>Fluxo chegou ao encerramento.</p>}
          </div>
          <p className="mt-3 text-xs">
            {decisions.length} resultados simulados
            {simulation.limited ? ' · limite de simulação atingido' : ''}
          </p>
        </div>
      )}
      {manager && !preview && (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              className="native-select"
              aria-label="Selecionar bloco"
              value={node.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {draft.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            {node.kind === 'task' && Object.keys(node.routes).length === 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  const id = `etapa_${draftId()}`;
                  const [outcome, target] = Object.entries(node.routes)[0];
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
                }}
              >
                Adicionar próxima etapa
              </Button>
            )}
            {canAddParallel && (
              <Button variant="outline" onClick={addParallelDeliveries}>
                Adicionar duas entregas paralelas
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
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
                      routes: {
                        Concluído: draft.nodes.find((n) => n.kind === 'end')?.id || draft.start,
                      },
                      closeOn: ['Concluído'],
                      requiredFields: ['Resultado técnico'],
                      waitFor: [],
                      position: { x: node.position.x + 280, y: node.position.y + 180 },
                    },
                  ],
                });
                setSelected(id);
              }}
            >
              Adicionar bloco independente
            </Button>
            <Button
              variant="outline"
              disabled={node.id === draft.start}
              onClick={() => {
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
              }}
            >
              Remover bloco
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs">
              Nome da etapa
              <input
                className="native-select mt-2"
                value={node.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
            <label className="text-xs">
              Comportamento
              <select
                className="native-select mt-2"
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
                                draft.nodes.find((n) => n.kind === 'end' && n.id !== node.id)?.id ||
                                draft.start,
                            },
                    waitFor: kind === 'join' ? node.waitFor : [],
                  });
                }}
              >
                {[
                  ['task', 'Etapa humana / decisão'],
                  ['fork', 'Abrir ramos em paralelo'],
                  ['join', 'Aguardar todos os ramos'],
                  ['end', 'Concluir processo'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {node.kind === 'task' && (
              <label className="text-xs">
                Trabalho desta etapa
                <select
                  className="native-select mt-2"
                  value={node.orderKey}
                  onChange={(e) =>
                    change({
                      orderKey: e.target.value === '__new__' ? `os_${draftId()}` : e.target.value,
                    })
                  }
                >
                  <option value="root">Mesma O.S. principal</option>
                  {[...new Set(draft.nodes.map((n) => n.orderKey))]
                    .filter((key) => key !== 'root')
                    .map((key) => (
                      <option key={key} value={key}>
                        O.S. complementar ·{' '}
                        {draft.nodes.find((n) => n.orderKey === key && n.kind === 'task')?.name ||
                          key}
                      </option>
                    ))}
                  <option value="__new__">Criar outra O.S. para esta entrega</option>
                </select>
              </label>
            )}
            {node.kind === 'task' && (
              <>
                <label className="text-xs">
                  Setor de destino
                  <input
                    className="native-select mt-2"
                    value={node.sector}
                    onChange={(e) => change({ sector: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Tipo de serviço
                  <select
                    className="native-select mt-2"
                    value={node.serviceType}
                    onChange={(e) => change({ serviceType: e.target.value })}
                  >
                    {Object.entries(orderTypes).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Prazo da etapa (minutos)
                  <input
                    className="native-select mt-2"
                    type="number"
                    min={1}
                    value={node.slaMinutes}
                    onChange={(e) => change({ slaMinutes: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs">
                  Responsável padrão
                  <select
                    className="native-select mt-2"
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
                    <option value="">Fila do setor</option>
                    {people.data
                      ?.filter((p) => node.roles.includes(p.role) && !p.accessBlocked)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.accessBlocked ? ' · acesso bloqueado' : ''}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs">
                  Evidências obrigatórias (uma por linha)
                  <textarea
                    aria-label="Evidências obrigatórias (uma por linha)"
                    className="native-select mt-2 min-h-24"
                    value={fieldDrafts[node.id] ?? node.requiredFields.join('\n')}
                    onChange={(e) => {
                      setFieldDrafts((current) => ({ ...current, [node.id]: e.target.value }));
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
                </label>
              </>
            )}
            {node.kind === 'join' && (
              <fieldset className="space-y-2 text-xs">
                <legend className="mb-2">Entregas que precisam terminar antes de continuar</legend>
                {draft.nodes
                  .filter((n) => n.kind === 'task' && n.orderKey !== 'root')
                  .map((n) => (
                    <label key={n.id} className="block">
                      <input
                        type="checkbox"
                        checked={node.waitFor.includes(n.id)}
                        onChange={(e) =>
                          change({
                            waitFor: e.target.checked
                              ? [...node.waitFor, n.id]
                              : node.waitFor.filter((id) => id !== n.id),
                          })
                        }
                      />{' '}
                      {n.name}
                    </label>
                  ))}
              </fieldset>
            )}
          </div>
          {node.kind === 'task' && (
            <>
              <p className="text-xs text-muted-foreground">
                O prazo desta etapa ajuda a acompanhar o fluxo. O prazo de SLA da O.S. é definido
                nas políticas por tipo de serviço.
              </p>
              <fieldset className="flex flex-wrap gap-4 text-xs">
                <legend className="mb-2">Perfis autorizados</legend>
                {['super_admin', 'gerente', 'analista'].map((role) => (
                  <label key={role}>
                    <input
                      type="checkbox"
                      checked={node.roles.includes(role)}
                      onChange={(e) =>
                        change({
                          roles: e.target.checked
                            ? [...node.roles, role]
                            : node.roles.filter((x) => x !== role),
                        })
                      }
                    />{' '}
                    {
                      { super_admin: 'Administrador', gerente: 'Gerente', analista: 'Analista' }[
                        role
                      ]
                    }
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Resultados, conexões e conclusão da O.S.</h3>
            {Object.entries(node.routes).map(([outcome, target]) => (
              <div key={outcome} className="flex flex-wrap items-center gap-3">
                <span className="min-w-40 text-xs">{outcome}</span>
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
                {node.kind === 'task' && (
                  <label className="text-xs">
                    <input
                      type="checkbox"
                      aria-label={`Encerrar esta O.S. ao selecionar ${outcome}`}
                      checked={node.closeOn.includes(outcome)}
                      onChange={(e) =>
                        change({
                          closeOn: e.target.checked
                            ? [...node.closeOn, outcome]
                            : node.closeOn.filter((x) => x !== outcome),
                        })
                      }
                    />{' '}
                    Conclui esta O.S.
                  </label>
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    change({
                      routes: Object.fromEntries(
                        Object.entries(node.routes).filter(([x]) => x !== outcome),
                      ),
                      closeOn: node.closeOn.filter((x) => x !== outcome),
                    })
                  }
                >
                  Remover saída
                </Button>
              </div>
            ))}
          </div>
          {node.kind !== 'end' && (
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const result = String(new FormData(e.currentTarget).get('result') || '').trim();
                if (result && !(result in node.routes))
                  change({
                    routes: {
                      ...node.routes,
                      [result]: draft.nodes.find((n) => n.kind === 'end')?.id || draft.start,
                    },
                  });
                e.currentTarget.reset();
              }}
            >
              <input
                className="native-select"
                name="result"
                placeholder="Novo resultado / decisão"
                required
              />
              <Button variant="outline">Adicionar saída</Button>
            </form>
          )}
          <details className="rounded-lg border border-border p-3 text-xs">
            <summary className="cursor-pointer font-medium">Configurações avançadas</summary>
            <label className="mt-3 block">
              Limite de repetições de uma etapa
              <input
                type="number"
                min={1}
                max={10}
                className="native-select ml-2"
                value={draft.maxVisits}
                onChange={(e) => setDraft({ ...draft, maxVisits: Number(e.target.value) })}
              />
            </label>
            <p className="mt-3">
              Identificador da etapa: {node.id}. As entregas paralelas devem partir da mesma divisão
              e podem gerar O.S. complementares em um nível.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

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
  const instance = query.data;
  const status = instance?.status;
  const refresh = query.mutate;
  useEffect(() => {
    if (!status || !['ACTIVE', 'WAITING', 'FAILED'].includes(status)) return;
    const timer = setInterval(() => {
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
              <Button disabled={action.pending || instance.status !== 'ACTIVE'}>
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
            return (
              <div key={step.id} className="space-y-4 rounded-lg border border-info/30 p-4">
                <h3 className="text-sm font-semibold">{node.name}</h3>
                <p className="text-xs">
                  {order?.protocol} · {node.sector} · responsável:{' '}
                  {order?.analystName || 'Fila do setor'} · meta da etapa: {date(step.dueAt)} ·
                  tentativa {step.attempt}
                </p>
                {['super_admin', 'gerente', 'analista'].includes(scope?.role || '') && (
                  <form
                    className="flex flex-wrap gap-3"
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
                      <option value="">Encaminhar a mesma O.S. para…</option>
                      {people.data
                        ?.filter((p) => node.roles.includes(p.role))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.accessBlocked ? ' · acesso bloqueado' : ''}
                          </option>
                        ))}
                    </select>
                    <input
                      className="native-select"
                      name="reason"
                      placeholder="Motivo do encaminhamento"
                      minLength={3}
                      required
                    />
                    <Button
                      variant="outline"
                      disabled={action.pending || instance.status !== 'ACTIVE'}
                    >
                      Encaminhar
                    </Button>
                  </form>
                )}
                {node.roles.includes(scope?.role || '') && (
                  <form
                    key={`${step.id}:${instance.version}`}
                    className="space-y-3"
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
                      <label key={field} className="block text-xs">
                        {field}
                        <textarea
                          className="native-select mt-2 min-h-20 w-full"
                          name={`field_${i}`}
                          required
                        />
                      </label>
                    ))}
                    <div className="flex flex-wrap gap-3">
                      <select
                        className="native-select"
                        name="outcome"
                        aria-label={`Resultado: ${node.name}`}
                        required
                      >
                        <option value="">Selecione o resultado</option>
                        {Object.keys(node.routes).map((outcome) => (
                          <option key={outcome}>{outcome}</option>
                        ))}
                      </select>
                      <input
                        name="reason"
                        className="native-select"
                        placeholder="Resumo da etapa"
                        required
                        minLength={3}
                      />
                      <Button disabled={action.pending || instance.status !== 'ACTIVE'}>
                        Registrar e avançar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
      {!history && (
        <form
          className="flex flex-wrap gap-3 border-t border-border pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            void perform({ action: values.get('action'), reason: values.get('reason') });
          }}
        >
          <select name="action" className="native-select" aria-label="Ação do processo">
            {instance.status === 'ACTIVE' && <option value="pause">Pausar processo</option>}
            {instance.status === 'PAUSED' && <option value="resume">Retomar processo</option>}
            {instance.status === 'FAILED' && manager && (
              <option value="retry">Repetir comando que falhou</option>
            )}
            {['COMPLETED', 'CANCELED'].includes(instance.status) && manager && (
              <option value="reopen">Reabrir reutilizando as O.S. existentes</option>
            )}
            {['ACTIVE', 'PAUSED', 'WAITING', 'FAILED'].includes(instance.status) && manager && (
              <option value="cancel">Cancelar processo e ordens pendentes</option>
            )}
          </select>
          <input
            className="native-select"
            name="reason"
            placeholder="Justificativa obrigatória"
            minLength={3}
            required
          />
          <Button variant="outline" disabled={action.pending}>
            Aplicar ação
          </Button>
        </form>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Histórico de etapas e evidências ({instance.steps.length})
        </summary>
        <div className="mt-4 space-y-3">
          {instance.steps.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">
                {instance.definition.nodes.find((n) => n.id === s.nodeId)?.name} · {s.status} ·
                tentativa {s.attempt}
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
              <Button variant="outline" disabled={action.pending}>
                Retomar eventos com falha
              </Button>
            </form>
          )}
        </details>
      )}
    </section>
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
      <Button disabled={action.pending}>Iniciar fluxo</Button>
    </form>
  );
}
