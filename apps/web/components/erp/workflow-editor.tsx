'use client';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Plus, Workflow, Trash2, GitBranch, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpQuery, useErpAction } from '@/lib/erp/gateway';
import { type WorkflowDefinition, type WorkflowNode, type ErpRecord } from '@/lib/erp/contracts';
import { workflowSubtypes, validateWorkflow, workflowWarnings } from '@/lib/erp/workflow';
import { ContractForm, ConnectionNotice, ErpEmpty, QueryState } from './contract-form';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import { WorkflowNodeForm } from './workflow-node-form';
import { WorkflowVersions } from './workflow-versions';
import { DataReport } from './data-report';
import { OperationControl } from './operation-controls';
import { useRouter } from 'next/navigation';
const WorkflowGraph = dynamic(
  () => import('./workflow-graph').then((module) => module.WorkflowGraph),
  { ssr: false },
);
type WorkflowRecord = ErpRecord & {
  definition: WorkflowDefinition;
  name: string;
  description?: string;
  enabled: boolean;
};
export function WorkflowEditorPage({ id }: { id?: string }) {
  const { scope } = useErp();
  const allowed = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const router = useRouter();
  const query = useErpQuery<WorkflowRecord[]>(allowed && !id ? '/workflows' : null);
  const detail = useErpQuery<WorkflowRecord>(
    allowed && id && id !== 'novo' ? `/workflows/${encodeURIComponent(id)}` : null,
  );
  const selected = detail.data;
  if (!allowed)
    return (
      <PageHeading
        title="Workflows"
        description="O gerenciamento de workflows exige perfil gerencial."
      />
    );
  return (
    <>
      <PageHeading
        title="Automação de workflows"
        description="Gatilhos, condições, ações e governança no contrato original do ERP."
      >
        <Link href="/gerencia/automacoes/novo" className="text-link">
          <Plus className="size-3" />
          Novo workflow
        </Link>
        {selected && (
          <>
            <OperationControl
              title={selected.enabled ? 'Desativar workflow' : 'Ativar workflow'}
              description="Altera a ativação da regra no motor original, somente após confirmação do ERP."
              path={`/workflows/${encodeURIComponent(selected.id)}/toggle`}
              method="PATCH"
              roles={['super_admin', 'gerente']}
              after={() => detail.mutate()}
            />
            <OperationControl
              title="Remover workflow"
              description="Remove a regra no servidor. Esta operação não é desfeita pelo histórico de versões."
              path={`/workflows/${encodeURIComponent(selected.id)}`}
              method="DELETE"
              roles={['super_admin', 'gerente']}
              after={async () => {
                router.push('/gerencia/automacoes');
              }}
            />
          </>
        )}
      </PageHeading>
      {!query.connected && <ConnectionNotice />}
      {!id ? (
        <section className="panel">
          <PanelHeading title="Workflows do ERP" />
          <QueryState
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void query.mutate()}
          />
          {query.data?.length
            ? query.data.map((row) => (
                <Link
                  key={row.id}
                  href={`/gerencia/automacoes/${row.id}`}
                  className="flex items-center justify-between border-t border-border p-5 text-xs"
                >
                  <span>{row.name}</span>
                  <StatusBadge status={row.enabled ? 'Ativo' : 'Inativo'} />
                </Link>
              ))
            : !query.isLoading && !query.error && <ErpEmpty connected={query.connected} />}
        </section>
      ) : (
        <>
          {query.connected && id !== 'novo' && !selected ? (
            <QueryState
              loading={detail.isLoading}
              error={
                detail.error ||
                (!detail.isLoading ? new Error('Workflow não encontrado no ERP.') : undefined)
              }
              onRetry={() => void detail.mutate()}
            />
          ) : (
            <WorkflowDraft
              key={(selected?.updatedAt as string) || id}
              initial={selected}
              connected={query.connected}
              onSaved={async () => {
                await query.mutate();
                if (id && id !== 'novo') await detail.mutate();
              }}
            />
          )}
        </>
      )}
    </>
  );
}
function WorkflowDraft({
  initial,
  connected,
  onSaved,
}: {
  initial?: WorkflowRecord;
  connected: boolean;
  onSaved: () => Promise<void>;
}) {
  const action = useErpAction();
  const [definition, setDefinition] = useState<WorkflowDefinition>(
    initial?.definition || { nodes: [], edges: [], governance: {} },
  );
  const [metadata, setMetadata] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    enabled: initial?.enabled || false,
  });
  const [nodeType, setNodeType] = useState<WorkflowNode['type']>('trigger');
  const [subtype, setSubtype] = useState('start_os_criada');
  const [editing, setEditing] = useState<WorkflowNode | null>(null);
  const [nodeOpen, setNodeOpen] = useState(false);
  const [edgeOpen, setEdgeOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const warnings = workflowWarnings(definition);
  const nodeOptions = Object.fromEntries(
    definition.nodes.map((node) => [
      node.id,
      `${node.type} · ${node.subtype} · ${node.id.slice(0, 8)}`,
    ]),
  );
  const updateDefinition = useCallback((next: WorkflowDefinition) => {
    setDefinition(next);
    setChecked(false);
    setLastSaved(null);
  }, []);
  const editNode = useCallback((node: WorkflowNode) => {
    setEditing(node);
    setNodeType(node.type);
    setSubtype(node.subtype);
    setNodeOpen(true);
  }, []);
  return (
    <Tabs defaultValue="Definição" className="gap-5">
      <div className="overflow-x-auto">
        <TabsList variant="line">
          {['Definição', 'Governança', 'Versões', 'Execução e logs'].map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="Definição">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_320px]">
          <section className="panel min-w-0">
            <PanelHeading
              title="Nós e conexões"
              description="Editor estruturado · alterações são rascunhos até o envio"
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setNodeType('trigger');
                  setSubtype('start_os_criada');
                  setNodeOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                Nó
              </Button>
            </PanelHeading>
            <WorkflowGraph definition={definition} onChange={updateDefinition} onEdit={editNode} />
            <p className="px-5 pb-4 text-[10px] text-muted-foreground">
              Arraste nós para posicionar, una os conectores ou use o formulário Conectar. Duplo
              clique abre a configuração. Todas as mudanças são rascunhos.
            </p>
            <div className="flex flex-col gap-3 p-5 pt-0">
              {definition.nodes.length ? (
                definition.nodes.map((node) => (
                  <article key={node.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <Workflow className="size-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-muted-foreground">
                          {node.type === 'trigger'
                            ? 'GATILHO'
                            : node.type === 'condition'
                              ? 'CONDIÇÃO'
                              : 'AÇÃO'}
                        </p>
                        <h3 className="mt-1 truncate text-xs">{node.subtype}</h3>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Configurar ${node.subtype}`}
                        onClick={() => {
                          setEditing(node);
                          setNodeType(node.type);
                          setSubtype(node.subtype);
                          setNodeOpen(true);
                        }}
                      >
                        <Settings2 />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remover ${node.subtype}`}
                        onClick={() =>
                          updateDefinition({
                            ...definition,
                            nodes: definition.nodes.filter((n) => n.id !== node.id),
                            edges: definition.edges.filter(
                              (e) => e.source !== node.id && e.target !== node.id,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <p className="mt-3 break-all font-mono text-[9px] text-muted-foreground">
                      {node.id}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Posição: {node.position.x}, {node.position.y}
                    </p>
                  </article>
                ))
              ) : (
                <ErpEmpty />
              )}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <h3 className="section-title">Conexões</h3>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={definition.nodes.length < 2}
                  onClick={() => setEdgeOpen(true)}
                >
                  <GitBranch data-icon="inline-start" />
                  Conectar
                </Button>
              </div>
              {definition.edges.map((edge) => (
                <div
                  key={edge.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-[10px]"
                >
                  <span className="break-all">
                    {edge.source.slice(0, 8)} → {edge.target.slice(0, 8)}{' '}
                    {edge.label ? `· ${edge.label}` : ''}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remover conexão"
                    onClick={() =>
                      updateDefinition({
                        ...definition,
                        edges: definition.edges.filter((e) => e.id !== edge.id),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </section>
          <section
            className="panel h-fit p-5"
            onChangeCapture={(event) => {
              const target = event.target;
              if (
                (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
                ['name', 'description', 'enabled'].includes(target.name)
              )
                setMetadata((previous) => ({
                  ...previous,
                  [target.name]:
                    target instanceof HTMLInputElement && target.type === 'checkbox'
                      ? target.checked
                      : target.value,
                }));
            }}
          >
            {warnings.length > 0 && (
              <Alert className="mb-5">
                <AlertTitle>Revisar antes de ativar</AlertTitle>
                <AlertDescription>
                  <ul className="flex flex-col gap-2">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <h2 className="section-title mb-5">Identificação e publicação</h2>
            <ContractForm
              fields={[
                { name: 'name', label: 'Nome', required: true, min: 3, max: 120 },
                { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 },
                { name: 'enabled', label: 'Ativar regra no servidor', type: 'checkbox' },
              ]}
              values={metadata}
              connected={connected}
              pending={action.pending}
              draft={!connected}
              onSubmit={async (values) => {
                validateWorkflow(definition);
                if (!connected) {
                  setChecked(true);
                  setResult('Estrutura validada. Rascunho não enviado e não salvo.');
                  return;
                }
                const saved = await action.execute<WorkflowRecord>({
                  path: initial ? `/workflows/${initial.id}` : '/workflows',
                  method: initial ? 'PATCH' : 'POST',
                  body: {
                    ...values,
                    definition: {
                      nodes: definition.nodes,
                      edges: definition.edges,
                      governance: definition.governance,
                    },
                  },
                });
                setLastSaved(saved.id);
                toast.success('Workflow confirmado pelo ERP');
                await onSaved();
              }}
              label="Salvar workflow no ERP"
            />
            {checked && (
              <p role="status" className="mt-4 text-xs text-primary">
                {result}
              </p>
            )}
            {lastSaved && (
              <Link className="text-link mt-4" href={`/gerencia/automacoes/${lastSaved}`}>
                Abrir workflow salvo
              </Link>
            )}
          </section>
        </div>
      </TabsContent>
      <TabsContent value="Governança">
        <section className="panel p-6">
          <h2 className="section-title mb-5">Limites e responsabilidade</h2>
          <ContractForm
            draft
            fields={[
              { name: 'ownerTeam', label: 'Equipe responsável', max: 120 },
              {
                name: 'maxExecutionsPerHour',
                label: 'Máximo de execuções por hora',
                type: 'number',
                min: 0,
                max: 100000,
              },
              { name: 'requiresApproval', label: 'Exigir aprovação', type: 'checkbox' },
              {
                name: 'changeTicketRequired',
                label: 'Exigir registro de mudança',
                type: 'checkbox',
              },
              { name: 'stopOnFailure', label: 'Interromper ao falhar', type: 'checkbox' },
            ]}
            values={definition.governance}
            connected={false}
            onSubmit={async (values) => {
              updateDefinition({
                ...definition,
                governance: values as WorkflowDefinition['governance'],
              });
              setResult('Governança aplicada ao rascunho. Salve o workflow para enviar ao ERP.');
            }}
          />
          <p className="mt-4 text-xs text-muted-foreground">{result}</p>
        </section>
      </TabsContent>
      <TabsContent value="Versões">
        <WorkflowVersions
          id={initial?.id}
          definition={definition}
          current={metadata}
          onSaved={onSaved}
        />
      </TabsContent>
      <TabsContent value="Execução e logs">
        <div className="flex flex-col gap-5">
          <DataReport
            title="Estado do motor de workflows"
            path="/workflows/status"
            roles={['super_admin', 'gerente']}
            metrics={[
              { key: 'executionEnabled', label: 'Execução habilitada' },
              { key: 'maxExecutionsPerHour', label: 'Limite global por hora' },
            ]}
          />
          {initial && (
            <DataReport
              title="Auditoria da regra"
              path={`/audit/logs?resourceType=workflow_rule&resourceId=${encodeURIComponent(initial.id)}`}
              roles={['super_admin', 'gerente']}
              tables={[
                {
                  key: 'logs',
                  columns: [
                    { key: 'createdAt', label: 'Data' },
                    { key: 'action', label: 'Ação' },
                    { key: 'actorUserId', label: 'Autor' },
                  ],
                },
              ]}
            />
          )}
          <Alert>
            <AlertTitle>Execução pertence ao motor original</AlertTitle>
            <AlertDescription>
              Não há execução simulada nesta interface. Consulte /workflows/status para o estado do
              motor. O modelo WorkflowExecutionLog existe no Prisma, mas o controller do ZIP não
              expõe um endpoint de consulta de logs nem de execução manual. A auditoria acima não
              substitui logs de execução. Essas interfaces dependem da definição desse contrato.
            </AlertDescription>
          </Alert>
        </div>
      </TabsContent>
      <Dialog open={nodeOpen} onOpenChange={setNodeOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Configurar nó' : 'Adicionar nó ao rascunho'}</DialogTitle>
            <DialogDescription>
              Parâmetros do grafo original, sem executar nenhuma ação.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3">
            <select
              className="native-select"
              aria-label="Tipo de nó"
              value={nodeType}
              onChange={(event) => {
                const type = event.target.value as WorkflowNode['type'];
                setNodeType(type);
                setSubtype(Object.keys(workflowSubtypes[type])[0]);
              }}
            >
              <option value="trigger">Gatilho</option>
              <option value="condition">Condição</option>
              <option value="action">Ação</option>
            </select>
            <select
              className="native-select"
              aria-label="Subtipo do nó"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
            >
              {!(subtype in workflowSubtypes[nodeType]) && (
                <option value={subtype}>{subtype} · legado / não reconhecido</option>
              )}
              {Object.entries(workflowSubtypes[nodeType]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <WorkflowNodeForm
            key={`${editing?.id}-${nodeType}-${subtype}`}
            type={nodeType}
            subtype={subtype}
            initial={
              editing?.type === nodeType && editing?.subtype === subtype ? editing : undefined
            }
            onApply={(node) => {
              const nextNode = {
                ...node,
                id: editing?.id || node.id,
                position:
                  !editing && node.position.x === 0 && node.position.y === 0
                    ? {
                        x: (definition.nodes.length % 3) * 220,
                        y: Math.floor(definition.nodes.length / 3) * 150,
                      }
                    : node.position,
              };
              updateDefinition({
                ...definition,
                nodes: editing
                  ? definition.nodes.map((n) => (n.id === editing.id ? nextNode : n))
                  : [...definition.nodes, nextNode],
              });
              setNodeOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={edgeOpen} onOpenChange={setEdgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar nós</DialogTitle>
            <DialogDescription>
              Saídas condicionais devem usar true ou false. Os nós referenciados precisam existir.
            </DialogDescription>
          </DialogHeader>
          <ContractForm
            draft
            fields={[
              { name: 'source', label: 'Origem', options: nodeOptions, required: true },
              { name: 'target', label: 'Destino', options: nodeOptions, required: true },
              { name: 'label', label: 'Rótulo da conexão' },
            ]}
            connected={false}
            onSubmit={async (values) => {
              if (values.source === values.target) throw new Error('Escolha nós diferentes.');
              if (
                definition.edges.some(
                  (e) =>
                    e.source === values.source &&
                    e.target === values.target &&
                    (e.label || '') === (values.label || ''),
                )
              )
                throw new Error('Esta conexão já existe.');
              updateDefinition({
                ...definition,
                edges: [
                  ...definition.edges,
                  {
                    id: crypto.randomUUID(),
                    source: String(values.source),
                    target: String(values.target),
                    ...(values.label ? { label: String(values.label) } : {}),
                  },
                ],
              });
              setEdgeOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
