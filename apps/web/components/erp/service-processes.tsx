'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeading, PanelHeading } from './primitives';
import { ConnectionNotice, QueryState } from './contract-form';
import { ProcessTemplatesPage } from './process-templates';
import {
  ServiceProcessGraph,
  type HumanDefinition as Definition,
  type HumanStage as Stage,
  type HumanVisit as Visit,
} from './service-process-graph';

type Order = {
  id: string;
  protocol: string;
  status: string;
  processNodeId: string;
  occurrences?: { id: string; message: string; sourceAuthorName?: string; createdAt: string }[];
};
type Instance = {
  id: string;
  version: number;
  status: string;
  templateVersion: number;
  definition: Definition;
  occurrence: { id: string; number: string; provider: string; description: string };
  orders: Order[];
  state: {
    current: Visit | null;
    history: Visit[];
    events: { type: string; at: string; reason: string }[];
  };
  createdAt: string;
};
const statuses: Record<string, string> = {
  ACTIVE: 'Em execução',
  WAITING: 'Aguardando',
  PAUSED: 'Interrompido',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};
const date = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Não foi possível concluir a operação';

function DefinitionEditor({
  definition,
  onSave,
}: {
  definition: Definition;
  onSave: (d: Definition) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(definition));
  const [selected, setSelected] = useState(definition.start);
  const [saving, setSaving] = useState(false);
  const node = draft.nodes.find((n) => n.id === selected)!;
  function change(patch: Partial<Stage>) {
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === selected ? { ...n, ...patch } : n)),
    }));
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Clique na etapa para configurar ou arraste para organizar. Salvar cria uma versão nova;
        atendimentos iniciados conservam a versão original.
      </p>
      <ServiceProcessGraph
        definition={draft}
        onSelect={setSelected}
        onMove={(id, position) =>
          setDraft((d) => ({
            ...d,
            nodes: d.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
          }))
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs">
          Etapa
          <select
            className="native-select mt-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {draft.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Nome
          <input
            className="native-select mt-2"
            value={node.name}
            onChange={(e) => change({ name: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Setor
          <input
            className="native-select mt-2"
            value={node.sector}
            onChange={(e) => change({ sector: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Meta em minutos (proposta)
          <input
            className="native-select mt-2"
            type="number"
            min="1"
            value={node.slaMinutes}
            onChange={(e) => change({ slaMinutes: Number(e.target.value) })}
          />
        </label>
        <label className="text-xs">
          Evidências obrigatórias (uma por linha)
          <Textarea
            className="mt-2"
            value={node.requiredFields.join('\n')}
            onChange={(e) => change({ requiredFields: e.target.value.split('\n').filter(Boolean) })}
          />
        </label>
        <label className="text-xs">
          Tipo
          <select
            className="native-select mt-2"
            value={node.kind}
            onChange={(e) => change({ kind: e.target.value as Stage['kind'] })}
          >
            <option value="task">Trabalho / O.S.</option>
            <option value="decision">Decisão</option>
            <option value="wait">Espera</option>
            <option value="end">Fim</option>
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-3 text-xs">
        <legend className="mb-2">Perfis autorizados a concluir</legend>
        {['super_admin', 'gerente', 'analista'].map((role) => (
          <label key={role}>
            <input
              type="checkbox"
              checked={node.roles.includes(role)}
              onChange={(e) =>
                change({
                  roles: e.target.checked
                    ? [...node.roles, role]
                    : node.roles.filter((r) => r !== role),
                })
              }
            />{' '}
            {role}
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <p className="text-xs font-medium">Resultados e próximos passos</p>
        {Object.entries(node.routes).map(([outcome, target]) => (
          <div key={outcome} className="flex gap-2">
            <span className="flex-1 text-xs">{outcome}</span>
            <select
              className="native-select flex-1"
              value={target}
              onChange={(e) => change({ routes: { ...node.routes, [outcome]: e.target.value } })}
            >
              {draft.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() =>
                change({
                  routes: Object.fromEntries(
                    Object.entries(node.routes).filter(([k]) => k !== outcome),
                  ),
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
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get('outcome') || '').trim();
            if (name) change({ routes: { ...node.routes, [name]: draft.start } });
            e.currentTarget.reset();
          }}
        >
          <input name="outcome" className="native-select" placeholder="Novo resultado" required />
          <Button type="submit" variant="outline">
            Adicionar saída
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            const id = `etapa_${'abcdefghijklmnopqrstuvwxyz'[draft.nodes.length % 26]}_${'abcdefghijklmnopqrstuvwxyz'[Math.floor(draft.nodes.length / 26)]}`;
            setDraft((d) => ({
              ...d,
              nodes: [
                ...d.nodes,
                {
                  ...node,
                  id,
                  name: 'Nova etapa',
                  routes: { Concluido: d.nodes.find((n) => n.kind === 'end')!.id },
                  kind: 'task',
                },
              ],
            }));
            setSelected(id);
          }}
        >
          Adicionar etapa
        </Button>
        <Button
          variant="outline"
          disabled={node.id === draft.start}
          onClick={() => {
            setDraft((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== node.id) }));
            setSelected(draft.start);
          }}
        >
          Excluir etapa
        </Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
        >
          Salvar nova versão
        </Button>
      </div>
    </div>
  );
}

export function ServiceProcessesPage({ id, base = '/gerencia' }: { id?: string; base?: string }) {
  const { scope } = useErp();
  const allowed = !!scope && ['super_admin', 'gerente', 'analista'].includes(scope.role);
  const manager = !!scope && ['super_admin', 'gerente'].includes(scope.role);
  const templates = useErpQuery<Definition[]>(allowed ? '/service-processes/templates' : null);
  const list = useErpQuery<Instance[]>(allowed ? '/service-processes' : null);
  const assignees = useErpQuery<{ id: string; name: string; role: string }[]>(
    allowed ? '/service-processes/assignees' : null,
  );
  const [selected, setSelected] = useState<string | undefined>(id);
  const detail = useErpQuery<Instance>(
    allowed && selected ? `/service-processes/${selected}` : null,
  );
  const [templateCode, setTemplateCode] = useState('MEGANET_ZABBIX');
  const [editing, setEditing] = useState<Definition | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [starting, setStarting] = useState(false);
  const occurrences = useErpQuery<
    { id: string; number: string; provider: string; status: string }[]
  >(starting && allowed ? '/service-orders/occurrences?limit=200' : null);
  const action = useErpAction();
  const instance = detail.data;
  const current = instance?.state.current;
  const node = instance?.definition.nodes.find((n) => n.id === current?.nodeId);
  const definition = templates.data?.find((t) => t.code === templateCode);
  async function execute(operation: string, values: Record<string, unknown>) {
    if (!instance) return;
    try {
      await action.execute({
        path: `/service-processes/${instance.id}/actions`,
        method: 'POST',
        body: { action: operation, expectedVersion: instance.version, ...values },
      });
      await Promise.all([detail.mutate(), list.mutate()]);
      toast.success('Processo atualizado');
    } catch (e) {
      toast.error(message(e));
      await detail.mutate();
    }
  }
  if (legacy)
    return (
      <>
        <Button variant="outline" onClick={() => setLegacy(false)}>
          Voltar aos processos de atendimento
        </Button>
        <ProcessTemplatesPage />
      </>
    );
  return (
    <>
      <PageHeading
        title="Processos de atendimento"
        description="Fluxos próprios por demanda: etapas, decisões, evidências e auditoria."
      >
        {allowed && <Button onClick={() => setStarting(true)}>Iniciar atendimento</Button>}
        {manager && (
          <Button variant="outline" onClick={() => setLegacy(true)}>
            Templates legados
          </Button>
        )}
      </PageHeading>
      {!templates.connected && <ConnectionNotice />}
      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
        Piloto Meganet · Metas por etapa propostas para demonstração, em horas corridas. Fora dos
        alertas e indicadores de SLA contratual.
      </div>
      <QueryState
        error={templates.error || list.error || detail.error}
        loading={templates.isLoading || list.isLoading || detail.isLoading}
        onRetry={() => {
          void templates.mutate();
          void list.mutate();
          void detail.mutate();
        }}
      />
      <section className="panel mb-6 p-5">
        <PanelHeading
          title="Fluxos por demanda"
          description="Modelos nativos, versionados por empresa."
        />
        <div className="mb-5 flex flex-wrap gap-2">
          {templates.data?.map((t) => (
            <Button
              key={t.code}
              variant={t.code === templateCode ? 'default' : 'outline'}
              onClick={() => setTemplateCode(t.code)}
            >
              {t.name}
            </Button>
          ))}
        </div>
        {definition && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {definition.description} · Versão {definition.version}
            </p>
            <ServiceProcessGraph
              key={`${definition.code}-${definition.version}`}
              definition={definition}
            />
            {manager && (
              <Button className="mt-3" variant="outline" onClick={() => setEditing(definition)}>
                Editar etapas, saídas e metas
              </Button>
            )}
          </>
        )}
      </section>
      <section className="panel mb-6 p-5">
        <PanelHeading
          title="Atendimentos em processo"
          description="Etapa atual e caminho executado."
        />
        {list.data?.length ? (
          list.data.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center justify-between gap-4 border-t border-border py-4 text-left text-xs"
              onClick={() => setSelected(p.id)}
            >
              <span>
                <strong>{p.occurrence.provider}</strong> · {p.occurrence.number}
                <br />
                {p.definition.name} ·{' '}
                {p.state.current
                  ? p.definition.nodes.find((n) => n.id === p.state.current?.nodeId)?.name
                  : 'Encerrado'}
              </span>
              <span>{statuses[p.status] || p.status}</span>
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum processo iniciado nesta empresa.</p>
        )}
      </section>
      {instance && (
        <section className="panel space-y-5 p-5">
          <PanelHeading
            title={`${instance.occurrence.provider} · ${instance.occurrence.number}`}
            description={`${statuses[instance.status]} · modelo v${instance.templateVersion} · revisão ${instance.version}`}
          />
          <p className="text-sm">{instance.occurrence.description}</p>
          <div className="flex gap-4 text-xs">
            <Link href={`${base}/ocorrencias/${instance.occurrence.id}`}>Abrir ocorrência</Link>
            <Link href={`${base}/processos/${instance.id}`}>Link deste processo</Link>
          </div>
          <ServiceProcessGraph
            definition={instance.definition}
            current={current?.nodeId}
            history={instance.state.history}
          />
          {node && current && (
            <div className="rounded-xl border border-blue-300 p-5">
              <h2 className="mb-2 font-semibold">Etapa atual: {node.name}</h2>
              <p className="mb-3 text-xs">
                Responsável:{' '}
                {assignees.data?.find((p) => p.id === current.assigneeUserId)?.name ||
                  'Aguardando atribuição no ERP (o nome de origem permanece na O.S.)'}
              </p>
              {['super_admin', 'gerente', 'analista'].includes(scope?.role || '') && (
                <form
                  className="mb-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = new FormData(e.currentTarget);
                    void execute('assign', {
                      assigneeUserId: values.get('assigneeUserId'),
                      reason: 'Responsável definido pela equipe no processo',
                    });
                  }}
                >
                  <select
                    className="native-select"
                    name="assigneeUserId"
                    aria-label="Responsável pela etapa"
                    required
                    defaultValue={current.assigneeUserId || ''}
                  >
                    <option value="">Escolha um responsável</option>
                    {assignees.data
                      ?.filter((p) => node.roles.includes(p.role))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <Button variant="outline" disabled={action.pending}>
                    Atribuir
                  </Button>
                </form>
              )}
              <p className="mb-4 text-xs">
                {node.sector} · Tentativa {current.attempt} · Meta piloto: {date(current.dueAt)}
                {instance.status === 'PAUSED' ? ' · relógio pausado' : ''}
              </p>
              {current.orderId && (
                <Link
                  className="mb-3 block text-xs text-primary"
                  href={`${base}/ordens/${current.orderId}`}
                >
                  Abrir O.S. desta etapa
                </Link>
              )}
              {['ACTIVE', 'WAITING'].includes(instance.status) &&
                node.roles.includes(scope?.role || '') && (
                  <form
                    key={`${instance.id}:${instance.version}`}
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      const evidence = Object.fromEntries(
                        node.requiredFields.map((field) => [field, String(data.get(field) || '')]),
                      );
                      void execute('advance', {
                        evidence,
                        outcome: data.get('outcome'),
                        reason: data.get('reason'),
                      });
                    }}
                  >
                    {node.requiredFields.map((field) => (
                      <label key={field} className="block text-xs">
                        {field}
                        <Textarea className="mt-2" name={field} required maxLength={8000} />
                      </label>
                    ))}
                    <label className="block text-xs">
                      Resultado
                      <select className="native-select mt-2" name="outcome" required>
                        <option value="">Selecione o próximo caminho</option>
                        {Object.keys(node.routes).map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs">
                      Registro da conclusão
                      <Textarea
                        name="reason"
                        className="mt-2"
                        required
                        minLength={3}
                        maxLength={2000}
                      />
                    </label>
                    <Button type="submit" disabled={action.pending}>
                      Concluir etapa e seguir fluxo
                    </Button>
                  </form>
                )}
              {!node.roles.includes(scope?.role || '') && (
                <p className="text-xs text-muted-foreground">
                  Etapa exige um dos perfis: {node.roles.join(', ')}.
                </p>
              )}
            </div>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void execute(String(data.get('operation')), { reason: data.get('reason') });
            }}
          >
            <input
              className="native-select flex-1"
              name="reason"
              placeholder="Justificativa para interrupção, retomada ou encerramento"
              required
              minLength={3}
              maxLength={2000}
            />
            <select name="operation" className="native-select w-auto">
              {['ACTIVE', 'WAITING'].includes(instance.status) && (
                <option value="pause">Interromper / pausar meta</option>
              )}
              {instance.status === 'PAUSED' && <option value="resume">Retomar</option>}
              {manager && ['ACTIVE', 'WAITING', 'PAUSED'].includes(instance.status) && (
                <option value="cancel">Cancelar atendimento</option>
              )}
              {manager && ['COMPLETED', 'CANCELED'].includes(instance.status) && (
                <option value="reopen">Reabrir atendimento</option>
              )}
            </select>
            <Button
              variant="outline"
              disabled={
                action.pending || (!manager && ['COMPLETED', 'CANCELED'].includes(instance.status))
              }
            >
              Aplicar
            </Button>
          </form>
          <h2 className="font-semibold">Etapas executadas</h2>
          {instance.state.history.map((h, i) => (
            <details
              className="rounded-lg border border-border p-3 text-xs"
              key={`${h.nodeId}-${i}`}
            >
              <summary>
                {instance.definition.nodes.find((n) => n.id === h.nodeId)?.name} · tentativa{' '}
                {h.attempt} · {h.outcome} · {date(h.completedAt)}
              </summary>
              {Object.entries(h.evidence || {}).map(([key, value]) => (
                <p key={key} className="mt-3 whitespace-pre-wrap">
                  <strong>{key}:</strong> {value}
                </p>
              ))}
            </details>
          ))}
          <h2 className="font-semibold">Ordens de serviço e histórico de origem</h2>
          {instance.orders.map((order) => (
            <details key={order.id} className="rounded-lg border border-border p-3 text-xs">
              <summary>
                {order.protocol} · {order.status} ·{' '}
                <Link href={`${base}/ordens/${order.id}`}>Abrir O.S.</Link>
              </summary>
              {order.occurrences?.map((note) => (
                <div key={note.id} className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-muted-foreground">
                    {date(note.createdAt)} · {note.sourceAuthorName || 'Equipe ERP'}
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{note.message}</pre>
                </div>
              ))}
            </details>
          ))}
          <h2 className="font-semibold">Trilha do processo</h2>
          {instance.state.events.map((event, i) => (
            <p key={i} className="text-xs">
              {date(event.at)} · {event.type} · {event.reason}
            </p>
          ))}
        </section>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Configurar fluxo de atendimento</DialogTitle>
          </DialogHeader>
          {editing && (
            <DefinitionEditor
              key={`${editing.code}-${editing.version}`}
              definition={editing}
              onSave={async (d) => {
                try {
                  await action.execute({
                    path: '/service-processes/templates',
                    method: 'PUT',
                    body: { definition: d, expectedVersion: editing.version },
                  });
                  await templates.mutate();
                  setEditing(null);
                  toast.success('Nova versão salva');
                } catch (e) {
                  toast.error(message(e));
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar processo em uma ocorrência</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              try {
                const created = await action.execute<{ id: string }>({
                  path: '/service-processes',
                  method: 'POST',
                  body: {
                    occurrenceId: data.get('occurrenceId'),
                    templateCode: data.get('templateCode'),
                  },
                });
                setSelected(created.id);
                setStarting(false);
                await list.mutate();
              } catch (error) {
                toast.error(message(error));
              }
            }}
          >
            <label className="block text-xs">
              Ocorrência
              <select name="occurrenceId" className="native-select mt-2" required>
                {occurrences.data
                  ?.filter((o) => o.status !== 'ENCERRADA')
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.provider} · {o.number}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs">
              Fluxo
              <select name="templateCode" className="native-select mt-2" required>
                {templates.data?.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={action.pending}>Iniciar processo</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
