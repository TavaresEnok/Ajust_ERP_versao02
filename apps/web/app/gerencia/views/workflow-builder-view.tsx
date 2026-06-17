'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Save,
  ChevronDown,
  Check,
  Eye,
  Plus,
  Trash2,
  Settings2,
  FilePlus,
  CheckCircle2,
  Bell,
  FileText,
  ClipboardList,
  ArrowRightFromLine,
  Copy,
  Link2,
  GitBranch,
  LayoutTemplate,
  X,
  GripVertical,
  Minus,
  Move,
  ZoomIn,
} from 'lucide-react';
import {
  type StepAction,
  type StepStatus,
  type TriggerType,
  type WorkflowStep,
  type StepConfig,
  type WorkflowNodeApi,
  type WorkflowEdgeApi,
  type WorkflowVersionApi,
  type WorkflowDefinitionApi,
  type WorkflowRuleApi,
  TIPO_OS_LIST,
  PRIORIDADES,
  TECNICOS,
  TRIGGER_TYPES,
  TRIGGER_UI_TO_SUBTYPE,
  TRIGGER_SUBTYPE_TO_UI,
  SERVICE_TYPE_TO_API,
  API_SERVICE_TO_UI,
  genId,
  normalizeTriggerType,
  mapActionToSubtype,
  mapSubtypeToAction,
  mapServiceTypeToApi,
  mapServiceTypeFromApi,
} from './workflow-builder.types';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const actionMeta: Record<StepAction, { label: string; icon: React.ReactNode; color: string }> = {
  CRIAR_OS: { label: 'Criar O.S.', icon: <FilePlus className="w-4 h-4" />, color: 'blue' },
  FECHAR_OS: { label: 'Fechar O.S.', icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' },
  ATUALIZAR_OS: {
    label: 'Atualizar O.S.',
    icon: <ClipboardList className="w-4 h-4" />,
    color: 'amber',
  },
  NOTIFICAR: { label: 'Notificar', icon: <Bell className="w-4 h-4" />, color: 'purple' },
};

const TEMPLATE_WORKFLOWS = [
  {
    name: 'OS para Novo Equipamento',
    trigger: { type: 'os_created', filter: { tipoOS: 'NOVO_EQUIPAMENTO' } },
    steps: [
      {
        action: 'CRIAR_OS',
        title: 'Configurar Equipamento',
        tipoOS: 'CONFIGURACAO',
        prioridade: 'ALTA',
      },
      { action: 'FECHAR_OS', title: 'Fechar OS de Configuração' },
      {
        action: 'CRIAR_OS',
        title: 'Cadastrar no Monitoramento',
        tipoOS: 'MONITORAMENTO',
        prioridade: 'NORMAL',
      },
      { action: 'CRIAR_OS', title: 'Cadastrar no Backup', tipoOS: 'BACKUP', prioridade: 'NORMAL' },
      {
        action: 'CRIAR_OS',
        title: 'Cadastrar no Jump Server',
        tipoOS: 'ACESSO',
        prioridade: 'BAIXA',
      },
    ],
  },
  {
    name: 'Recuperação de Falha',
    trigger: { type: 'os_created', filter: { prioridade: 'CRITICA' } },
    steps: [
      {
        action: 'CRIAR_OS',
        title: 'Diagnóstico Remoto',
        tipoOS: 'CONFIGURACAO',
        prioridade: 'CRITICA',
      },
      {
        action: 'CRIAR_OS',
        title: 'Acionamento Campo',
        tipoOS: 'INSTALACAO',
        prioridade: 'CRITICA',
      },
      { action: 'FECHAR_OS', title: 'Fechar OS de Recuperação' },
      { action: 'NOTIFICAR', title: 'Notificar Cliente' },
    ],
  },
  {
    name: 'Auditoria Programada',
    trigger: { type: 'manual' },
    steps: [
      { action: 'CRIAR_OS', title: 'Coleta de Dados', tipoOS: 'AUDITORIA', prioridade: 'NORMAL' },
      {
        action: 'CRIAR_OS',
        title: 'Análise de Configurações',
        tipoOS: 'AUDITORIA',
        prioridade: 'NORMAL',
      },
      { action: 'CRIAR_OS', title: 'Relatório Final', tipoOS: 'AUDITORIA', prioridade: 'NORMAL' },
    ],
  },
];

function toStepConfig(config: Record<string, unknown>): StepConfig {
  const tipoOS =
    typeof config.tipoOS === 'string'
      ? config.tipoOS
      : mapServiceTypeFromApi(
          typeof config.serviceOrderType === 'string' ? config.serviceOrderType : undefined,
        );
  const prioridade =
    typeof config.priority === 'string'
      ? config.priority.toUpperCase()
      : typeof config.prioridade === 'string'
        ? config.prioridade.toUpperCase()
        : undefined;
  return {
    tipoOS,
    prioridade: (PRIORIDADES as readonly string[]).includes(prioridade || '')
      ? prioridade
      : undefined,
    titleTemplate: typeof config.titleTemplate === 'string' ? config.titleTemplate : undefined,
    tecnico:
      typeof config.team === 'string'
        ? config.team
        : typeof config.tecnico === 'string'
          ? config.tecnico
          : undefined,
    techAutoAssign: config.techAutoAssign === false ? false : true,
    notifyTarget: typeof config.webhookUrl === 'string' ? config.webhookUrl : undefined,
  };
}

function buildWorkflowDefinition(
  steps: WorkflowStep[],
  triggerType: TriggerType,
  triggerFilter: string,
): WorkflowDefinitionApi {
  const nodes: WorkflowNodeApi[] = [];
  const edges: WorkflowEdgeApi[] = [];

  nodes.push({
    id: 'trigger_start',
    type: 'trigger',
    subtype: TRIGGER_UI_TO_SUBTYPE[triggerType] || 'os_criada',
    config: { tipoOS: triggerFilter },
    position: { x: 140, y: 40 },
  });

  let previousId = 'trigger_start';
  steps.forEach((step, index) => {
    const nodeId = `step_${index + 1}_${step.id}`;
    const subtype = mapActionToSubtype(step.action);
    const config: Record<string, unknown> = {
      title: step.title,
      description: step.description,
      tipoOS: step.config.tipoOS || 'AUDITORIA',
      serviceOrderType: mapServiceTypeToApi(step.config.tipoOS),
      priority: (step.config.prioridade || 'NORMAL').toUpperCase(),
      team: step.config.techAutoAssign ? 'Auto-assign' : step.config.tecnico || 'Equipe',
      techAutoAssign: step.config.techAutoAssign !== false,
      titleTemplate: step.config.titleTemplate || '',
      webhookUrl: step.config.notifyTarget || '',
      taskName: step.title,
    };

    nodes.push({
      id: nodeId,
      type: 'action',
      subtype,
      config,
      position: { x: 140, y: 200 + index * 130 },
    });

    edges.push({
      id: `edge_${previousId}_${nodeId}`,
      source: previousId,
      target: nodeId,
    });
    previousId = nodeId;
  });

  return { nodes, edges, governance: { stopOnFailure: true } };
}

function extractWorkflowSteps(definition: WorkflowDefinitionApi | null | undefined): {
  triggerType: TriggerType;
  triggerFilter: string;
  steps: WorkflowStep[];
  versions: WorkflowVersionApi[];
} {
  const empty = {
    triggerType: 'os_created' as TriggerType,
    triggerFilter: 'NOVO_EQUIPAMENTO',
    steps: defaultSteps,
    versions: [] as WorkflowVersionApi[],
  };
  if (!definition || !Array.isArray(definition.nodes)) return empty;

  const nodes = definition.nodes;
  const edges = Array.isArray(definition.edges) ? definition.edges : [];
  const versions = Array.isArray(definition.versions) ? definition.versions : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outgoingMap = new Map<string, WorkflowEdgeApi[]>();
  edges.forEach((edge) => {
    const list = outgoingMap.get(edge.source) || [];
    list.push(edge);
    outgoingMap.set(edge.source, list);
  });

  const triggerNode = nodes.find((node) => node.type === 'trigger');
  const rawTriggerType = triggerNode ? TRIGGER_SUBTYPE_TO_UI[triggerNode.subtype] : undefined;
  const triggerType = normalizeTriggerType(rawTriggerType || 'os_created');
  const triggerConfig =
    triggerNode?.config && typeof triggerNode.config === 'object' ? triggerNode.config : {};
  const triggerFilter =
    typeof triggerConfig.tipoOS === 'string' ? triggerConfig.tipoOS : 'NOVO_EQUIPAMENTO';

  const collected: WorkflowStep[] = [];
  const visited = new Set<string>();
  let cursor = triggerNode?.id || '';
  while (cursor) {
    const nextEdges = outgoingMap.get(cursor) || [];
    if (nextEdges.length === 0) break;
    const nextNode = nodeMap.get(nextEdges[0].target);
    if (!nextNode || visited.has(nextNode.id)) break;
    visited.add(nextNode.id);
    cursor = nextNode.id;
    if (nextNode.type !== 'action') continue;

    const nodeConfig =
      nextNode.config && typeof nextNode.config === 'object' ? nextNode.config : {};
    const stepConfig = toStepConfig(nodeConfig);
    const title =
      typeof nodeConfig.taskName === 'string' && nodeConfig.taskName.trim()
        ? nodeConfig.taskName
        : typeof nodeConfig.title === 'string' && nodeConfig.title.trim()
          ? nodeConfig.title
          : `Passo ${collected.length + 1}`;
    const description = typeof nodeConfig.description === 'string' ? nodeConfig.description : '';

    collected.push({
      id: genId(),
      order: collected.length + 1,
      action: mapSubtypeToAction(nextNode.subtype),
      title,
      description,
      config: stepConfig,
      status: collected.length === 0 ? 'active' : 'pending',
    });
  }

  if (collected.length === 0) {
    const fallback = nodes
      .filter((node) => node.type === 'action')
      .sort((a, b) => a.position.y - b.position.y)
      .map((node, index) => {
        const nodeConfig = node.config && typeof node.config === 'object' ? node.config : {};
        const stepConfig = toStepConfig(nodeConfig);
        const title =
          typeof nodeConfig.taskName === 'string' && nodeConfig.taskName.trim()
            ? nodeConfig.taskName
            : typeof nodeConfig.title === 'string' && nodeConfig.title.trim()
              ? nodeConfig.title
              : `Passo ${index + 1}`;
        return {
          id: genId(),
          order: index + 1,
          action: mapSubtypeToAction(node.subtype),
          title,
          description: typeof nodeConfig.description === 'string' ? nodeConfig.description : '',
          config: stepConfig,
          status: index === 0 ? ('active' as const) : ('pending' as const),
        };
      });
    return {
      triggerType,
      triggerFilter,
      steps: fallback.length > 0 ? fallback : defaultSteps,
      versions,
    };
  }

  return { triggerType, triggerFilter, steps: collected, versions };
}

const defaultSteps: WorkflowStep[] = [
  {
    id: genId(),
    order: 1,
    action: 'CRIAR_OS',
    title: 'Configurar Equipamento',
    description: 'Cria OS para configurar o novo equipamento',
    config: { tipoOS: 'CONFIGURACAO', prioridade: 'ALTA', techAutoAssign: true },
    status: 'active',
  },
  {
    id: genId(),
    order: 2,
    action: 'FECHAR_OS',
    title: 'Fechar OS de Configuração',
    description: 'Finaliza a OS de configuração após conclusão',
    config: {},
    status: 'pending',
  },
  {
    id: genId(),
    order: 3,
    action: 'CRIAR_OS',
    title: 'Cadastrar no Monitoramento',
    description: 'Cria OS para cadastro no sistema de monitoramento',
    config: { tipoOS: 'MONITORAMENTO', prioridade: 'NORMAL', techAutoAssign: true },
    status: 'pending',
  },
  {
    id: genId(),
    order: 4,
    action: 'CRIAR_OS',
    title: 'Cadastrar no Backup',
    description: 'Cria OS para configurar backup automático',
    config: { tipoOS: 'BACKUP', prioridade: 'NORMAL', techAutoAssign: true },
    status: 'pending',
  },
  {
    id: genId(),
    order: 5,
    action: 'CRIAR_OS',
    title: 'Cadastrar no Jump Server',
    description: 'Cria OS para liberar acesso ao jump server',
    config: { tipoOS: 'ACESSO', prioridade: 'BAIXA', techAutoAssign: true },
    status: 'pending',
  },
];

// ─── OS Process Templates ─────────────────────────────────────────────────────

const OS_TYPES_API = [
  { value: 'ROMPIMENTO', label: 'Rompimento' },
  { value: 'LENTIDAO', label: 'Lentidão' },
  { value: 'CONFIGURACAO_ONU', label: 'Configuração de ONU' },
  { value: 'TROCA_SENHA', label: 'Troca de Senha' },
  { value: 'CANCELAMENTO', label: 'Cancelamento' },
  { value: 'AUDITORIA', label: 'Auditoria' },
  { value: 'INSTALACAO', label: 'Instalação' },
  { value: 'BGP', label: 'BGP' },
];

const PRIORITIES_API = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

interface ChildOrderSpec {
  id: string;
  title: string;
  type: string;
  priority: string;
  sector?: string;
  description?: string;
  deadlineHours?: number;
}

interface OsTemplateDefinition {
  childOrders: ChildOrderSpec[];
}

interface OsTemplate {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  triggerOsTypes: string[];
  definition: OsTemplateDefinition;
  createdAt: string;
}

function emptyChild(): ChildOrderSpec {
  return {
    id: genId(),
    title: '',
    type: 'AUDITORIA',
    priority: 'NORMAL',
    sector: '',
    description: '',
    deadlineHours: 24,
  };
}

function OsTemplatesTab({ dark, onToast }: { dark?: boolean; onToast?: (msg: string) => void }) {
  const notify = useCallback((message: string) => onToast?.(message), [onToast]);
  const [templates, setTemplates] = useState<OsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OsTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTypes, setFormTypes] = useState<string[]>([]);
  const [formChildren, setFormChildren] = useState<ChildOrderSpec[]>([emptyChild()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/os-templates');
      if (!res.ok) throw new Error('Falha ao carregar templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      notify('Erro ao carregar templates de OS.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDesc('');
    setFormTypes([]);
    setFormChildren([emptyChild()]);
    setModalOpen(true);
  };

  const openEdit = (t: OsTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormDesc(t.description || '');
    setFormTypes(t.triggerOsTypes);
    setFormChildren(
      t.definition.childOrders.length > 0 ? t.definition.childOrders : [emptyChild()],
    );
    setModalOpen(true);
  };

  const toggleType = (type: string) => {
    setFormTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const addChild = () => setFormChildren((prev) => [...prev, emptyChild()]);
  const removeChild = (id: string) => setFormChildren((prev) => prev.filter((c) => c.id !== id));
  const updateChild = (id: string, patch: Partial<ChildOrderSpec>) => {
    setFormChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const save = async () => {
    if (!formName.trim()) {
      notify('Nome do template é obrigatório.');
      return;
    }
    if (formTypes.length === 0) {
      notify('Selecione ao menos um tipo de OS.');
      return;
    }
    const validChildren = formChildren.filter((c) => c.title.trim());
    if (validChildren.length === 0) {
      notify('Adicione ao menos uma OS filha com título.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        triggerOsTypes: formTypes,
        definition: { childOrders: validChildren },
      };
      const url = editingTemplate ? `/api/os-templates/${editingTemplate.id}` : '/api/os-templates';
      const method = editingTemplate ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Falha ao salvar template.',
        );
      }
      notify(editingTemplate ? 'Template atualizado.' : 'Template criado com sucesso.');
      setModalOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover o template "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/os-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao remover template.');
      notify('Template removido.');
      load();
    } catch {
      notify('Falha ao remover template.');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      const res = await fetch(`/api/os-templates/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Falha ao alterar status.');
      const updated: OsTemplate = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
      notify(updated.enabled ? 'Template ativado.' : 'Template desativado.');
    } catch {
      notify('Falha ao alterar status do template.');
    } finally {
      setToggling(null);
    }
  };

  const inputCls = cn(
    'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all',
    dark
      ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-blue-400'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white',
  );

  const osTypeLabel = (v: string) => OS_TYPES_API.find((t) => t.value === v)?.label || v;
  const priorityLabel = (v: string) => PRIORITIES_API.find((p) => p.value === v)?.label || v;

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 pt-4">
        <div>
          <p className={cn('text-sm', dark ? 'text-white/60' : 'text-gray-500')}>
            Defina receitas de OS filhas criadas automaticamente ao fechar uma OS.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className={cn('h-20 rounded-xl animate-pulse', dark ? 'bg-white/5' : 'bg-gray-100')}
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div
          className={cn(
            'flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed',
            dark ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-400',
          )}
        >
          <LayoutTemplate className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum template criado</p>
          <p className="text-xs mt-1 opacity-70">
            Clique em &ldquo;Novo Template&rdquo; para começar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div
              key={t.id}
              className={cn(
                'rounded-2xl border transition-all flex flex-col',
                dark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm',
              )}
            >
              {/* Card header */}
              <div
                className={cn(
                  'px-4 pt-4 pb-3 border-b flex items-start justify-between gap-2',
                  dark ? 'border-white/10' : 'border-gray-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={cn(
                        'text-sm font-bold truncate',
                        dark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      {t.name}
                    </p>
                    <span
                      className={cn(
                        'text-2xs px-2 py-0.5 rounded-full font-semibold shrink-0',
                        t.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400',
                      )}
                    >
                      {t.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {t.description && (
                    <p
                      className={cn(
                        'text-xs mt-0.5 truncate',
                        dark ? 'text-white/40' : 'text-gray-400',
                      )}
                    >
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(t.id)}
                    disabled={toggling === t.id}
                    title={t.enabled ? 'Desativar' : 'Ativar'}
                    className={cn(
                      'relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0',
                      toggling === t.id ? 'opacity-50 cursor-not-allowed' : '',
                      t.enabled ? 'bg-emerald-500' : 'bg-gray-300',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200',
                        t.enabled ? 'left-[17px]' : 'left-[2px]',
                      )}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    title="Editar"
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      dark
                        ? 'text-white/40 hover:text-white hover:bg-white/10'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    disabled={deleting === t.id}
                    title="Remover"
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      deleting === t.id ? 'opacity-40 cursor-not-allowed' : '',
                      dark ? 'text-red-400 hover:bg-red-400/10' : 'text-red-400 hover:bg-red-50',
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Flowchart visual */}
              <div className="flex-1 px-4 py-4 flex flex-col items-center">
                {/* Trigger types */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-1">
                  {t.triggerOsTypes.map((type) => (
                    <span
                      key={type}
                      className={cn(
                        'text-2xs px-2.5 py-1 rounded-lg font-semibold border',
                        dark
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                          : 'bg-blue-50 border-blue-200 text-blue-700',
                      )}
                    >
                      {osTypeLabel(type)}
                    </span>
                  ))}
                </div>

                {/* Arrow + trigger label */}
                <div className="flex flex-col items-center my-1">
                  <div className={cn('w-px h-5', dark ? 'bg-white/20' : 'bg-gray-200')} />
                  <div
                    className={cn(
                      'px-3 py-1 rounded-full text-2xs font-bold border',
                      dark
                        ? 'bg-red-500/20 border-red-500/40 text-red-300'
                        : 'bg-red-50 border-red-200 text-red-600',
                    )}
                  >
                    ● FECHADA
                  </div>
                  <div className={cn('w-px h-5', dark ? 'bg-white/20' : 'bg-gray-200')} />
                </div>

                {/* Branch connector */}
                {t.definition.childOrders.length > 1 && (
                  <div className="w-full flex items-center justify-center mb-1">
                    <div className={cn('relative flex items-start justify-around w-full px-2')}>
                      {/* horizontal line spanning all children */}
                      <div
                        className={cn(
                          'absolute top-0 left-[10%] right-[10%] h-px',
                          dark ? 'bg-white/20' : 'bg-gray-200',
                        )}
                      />
                      {t.definition.childOrders.map((_, i) => (
                        <div
                          key={i}
                          className={cn('w-px h-4', dark ? 'bg-white/20' : 'bg-gray-200')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Child OS cards */}
                <div
                  className={cn(
                    'w-full grid gap-2',
                    t.definition.childOrders.length === 1
                      ? 'grid-cols-1'
                      : t.definition.childOrders.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-3',
                  )}
                >
                  {t.definition.childOrders.map((child, i) => {
                    const priorityColors: Record<string, string> = {
                      CRITICA: dark
                        ? 'border-red-500/40 bg-red-500/10'
                        : 'border-red-200 bg-red-50',
                      ALTA: dark
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-amber-200 bg-amber-50',
                      NORMAL: dark
                        ? 'border-blue-500/30 bg-blue-500/10'
                        : 'border-blue-100 bg-blue-50/50',
                      BAIXA: dark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50',
                    };
                    const priorityDot: Record<string, string> = {
                      CRITICA: 'bg-red-500',
                      ALTA: 'bg-amber-500',
                      NORMAL: 'bg-blue-500',
                      BAIXA: 'bg-gray-400',
                    };
                    return (
                      <div
                        key={child.id || i}
                        className={cn(
                          'rounded-xl border p-2.5 flex flex-col gap-1',
                          priorityColors[child.priority] ||
                            (dark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'),
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              priorityDot[child.priority] || 'bg-gray-400',
                            )}
                          />
                          <p
                            className={cn(
                              'text-xs font-semibold leading-tight truncate',
                              dark ? 'text-white' : 'text-gray-800',
                            )}
                          >
                            {child.title}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'text-2xs truncate',
                            dark ? 'text-white/40' : 'text-gray-400',
                          )}
                        >
                          {osTypeLabel(child.type)}
                        </p>
                        {child.sector && (
                          <p
                            className={cn(
                              'text-2xs truncate',
                              dark ? 'text-white/30' : 'text-gray-400',
                            )}
                          >
                            📍 {child.sector}
                          </p>
                        )}
                        <p className={cn('text-2xs', dark ? 'text-white/30' : 'text-gray-400')}>
                          ⏱ {child.deadlineHours ?? 24}h
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={cn(
              'w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]',
              dark ? 'bg-[#1e1e2e] border border-white/10' : 'bg-white',
            )}
          >
            {/* Modal header */}
            <div
              className={cn(
                'flex items-center justify-between px-6 py-4 border-b',
                dark ? 'border-white/10' : 'border-gray-100',
              )}
            >
              <div className="flex items-center gap-2">
                <LayoutTemplate
                  className={cn('w-5 h-5', dark ? 'text-blue-400' : 'text-blue-600')}
                />
                <h2
                  className={cn('text-base font-semibold', dark ? 'text-white' : 'text-gray-900')}
                >
                  {editingTemplate ? 'Editar Template' : 'Novo Template de OS'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  dark
                    ? 'text-white/50 hover:text-white hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label
                  className={cn(
                    'block text-xs font-semibold mb-1.5 uppercase tracking-wider',
                    dark ? 'text-white/50' : 'text-gray-500',
                  )}
                >
                  Nome do Template *
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Configuração de Equipamento"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className={cn(
                    'block text-xs font-semibold mb-1.5 uppercase tracking-wider',
                    dark ? 'text-white/50' : 'text-gray-500',
                  )}
                >
                  Descrição
                </label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className={inputCls}
                  placeholder="Descreva quando usar este template..."
                />
              </div>

              {/* Trigger OS Types */}
              <div>
                <label
                  className={cn(
                    'block text-xs font-semibold mb-2 uppercase tracking-wider',
                    dark ? 'text-white/50' : 'text-gray-500',
                  )}
                >
                  Aplicar quando fechar OS do tipo *
                </label>
                <div className="flex flex-wrap gap-2">
                  {OS_TYPES_API.map((t) => {
                    const selected = formTypes.includes(t.value);
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleType(t.value)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                          selected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'border-white/10 text-white/60 hover:border-blue-400 hover:text-blue-400'
                              : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
                        )}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {formTypes.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Selecione ao menos um tipo</p>
                )}
              </div>

              {/* Child orders */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      dark ? 'text-white/50' : 'text-gray-500',
                    )}
                  >
                    OS Filhas criadas automaticamente ao fechar *
                  </label>
                </div>

                <div className="space-y-3">
                  {formChildren.map((child, idx) => (
                    <div
                      key={child.id}
                      className={cn(
                        'rounded-xl border p-4',
                        dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <GripVertical
                          className={cn(
                            'w-4 h-4 shrink-0',
                            dark ? 'text-white/20' : 'text-gray-300',
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full text-white bg-blue-500 shrink-0',
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium flex-1',
                            dark ? 'text-white/60' : 'text-gray-500',
                          )}
                        >
                          OS Filha
                        </span>
                        {formChildren.length > 1 && (
                          <button
                            onClick={() => removeChild(child.id)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              dark
                                ? 'text-red-400 hover:bg-red-400/10'
                                : 'text-red-500 hover:bg-red-50',
                            )}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Título *
                          </label>
                          <input
                            value={child.title}
                            onChange={(e) => updateChild(child.id, { title: e.target.value })}
                            className={inputCls}
                            placeholder="Ex: Monitoramento pós-configuração"
                          />
                        </div>
                        <div>
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Tipo de OS
                          </label>
                          <select
                            value={child.type}
                            onChange={(e) => updateChild(child.id, { type: e.target.value })}
                            className={inputCls}
                          >
                            {OS_TYPES_API.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Prioridade
                          </label>
                          <select
                            value={child.priority}
                            onChange={(e) => updateChild(child.id, { priority: e.target.value })}
                            className={inputCls}
                          >
                            {PRIORITIES_API.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Setor
                          </label>
                          <input
                            value={child.sector || ''}
                            onChange={(e) => updateChild(child.id, { sector: e.target.value })}
                            className={inputCls}
                            placeholder="Ex: NOC, TI, Suporte..."
                          />
                        </div>
                        <div>
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Prazo (horas)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={child.deadlineHours ?? 24}
                            onChange={(e) =>
                              updateChild(child.id, { deadlineHours: Number(e.target.value) || 24 })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div className="col-span-2">
                          <label
                            className={cn(
                              'block text-2xs font-semibold mb-1 uppercase tracking-wider',
                              dark ? 'text-white/40' : 'text-gray-400',
                            )}
                          >
                            Descrição
                          </label>
                          <input
                            value={child.description || ''}
                            onChange={(e) => updateChild(child.id, { description: e.target.value })}
                            className={inputCls}
                            placeholder="O que deve ser feito nesta OS..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addChild}
                  className={cn(
                    'mt-3 w-full py-2 text-xs font-medium rounded-lg border-2 border-dashed transition-all',
                    dark
                      ? 'border-white/10 text-white/40 hover:border-blue-400 hover:text-blue-400'
                      : 'border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-600',
                  )}
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Adicionar OS filha
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div
              className={cn(
                'flex items-center justify-end gap-3 px-6 py-4 border-t',
                dark ? 'border-white/10' : 'border-gray-100',
              )}
            >
              <button
                onClick={() => setModalOpen(false)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  dark
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                )}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className={cn(
                  'px-5 py-2 text-sm font-medium rounded-lg text-white transition-colors',
                  saving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
                )}
              >
                {saving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkflowBuilderView(_props: {
  dark?: boolean;
  tenantId?: string | null;
  onToast?: (message: string) => void;
}) {
  const notify = useMemo(() => _props.onToast || (() => {}), [_props.onToast]);
  const [activeTab, setActiveTab] = useState<'automacoes' | 'templates'>('automacoes');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('O.S para Novo Equipamento');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(defaultSteps[0].id);
  const [steps, setSteps] = useState<WorkflowStep[]>(defaultSteps);
  const [triggerType, setTriggerType] = useState<TriggerType>('os_created');
  const [triggerFilter, setTriggerFilter] = useState('NOVO_EQUIPAMENTO');
  const [showTemplates, setShowTemplates] = useState(false);
  const [versionHistory, setVersionHistory] = useState<WorkflowVersionApi[]>([]);
  const [canvasZoom, setCanvasZoom] = useState(100);

  const applyWorkflow = useCallback((workflow: WorkflowRuleApi) => {
    const parsed = extractWorkflowSteps(workflow.definition);
    setWorkflowId(workflow.id);
    setWorkflowName(workflow.name || 'Workflow sem nome');
    setIsActive(Boolean(workflow.enabled));
    setTriggerType(parsed.triggerType);
    setTriggerFilter(parsed.triggerFilter);
    setSteps(parsed.steps);
    setSelectedStepId(parsed.steps[0]?.id || null);
    setVersionHistory(parsed.versions);
  }, []);

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workflows', { cache: 'no-store' });
      const payload = await res.json().catch(() => []);
      if (!res.ok) {
        const errorText =
          typeof payload?.error === 'string' ? payload.error : 'Falha ao carregar workflows.';
        throw new Error(errorText);
      }
      const workflows = Array.isArray(payload) ? (payload as WorkflowRuleApi[]) : [];
      if (workflows.length === 0) {
        setWorkflowId(null);
        setVersionHistory([]);
        setSteps(defaultSteps);
        setSelectedStepId(defaultSteps[0]?.id || null);
        return;
      }
      applyWorkflow(workflows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar workflows.';
      notify(message);
    } finally {
      setIsLoading(false);
    }
  }, [applyWorkflow, notify]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;
  const sortedVersions = useMemo(
    () => [...versionHistory].sort((a, b) => b.version - a.version),
    [versionHistory],
  );

  const addStep = (afterIndex?: number) => {
    const insertIndex =
      typeof afterIndex === 'number'
        ? Math.min(Math.max(afterIndex + 1, 0), steps.length)
        : steps.length;
    const newOrder = insertIndex + 1;
    const newStep: WorkflowStep = {
      id: genId(),
      order: newOrder,
      action: 'CRIAR_OS',
      title: `Novo Passo ${newOrder}`,
      description: 'Descreva esta etapa do fluxo',
      config: { tipoOS: 'CONFIGURACAO', prioridade: 'NORMAL', techAutoAssign: true },
      status: 'pending',
    };
    const next = [...steps.slice(0, insertIndex), newStep, ...steps.slice(insertIndex)].map(
      (step, index) => ({ ...step, order: index + 1 }),
    );
    setSteps(next);
    setSelectedStepId(newStep.id);
  };

  const removeStep = (id: string) => {
    const filtered = steps.filter((s) => s.id !== id);
    const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(reordered);
    if (selectedStepId === id) setSelectedStepId(reordered[0]?.id || null);
  };

  const loadTemplate = (idx: number) => {
    const tmpl = TEMPLATE_WORKFLOWS[idx];
    setWorkflowName(tmpl.name);
    setTriggerType(normalizeTriggerType(tmpl.trigger.type));
    if (tmpl.trigger.filter?.tipoOS) setTriggerFilter(tmpl.trigger.filter.tipoOS);
    if (tmpl.trigger.filter?.prioridade) setTriggerFilter('NOVO_EQUIPAMENTO');
    const newSteps = tmpl.steps.map((s, i) => ({
      id: genId(),
      order: i + 1,
      action: s.action as StepAction,
      title: s.title,
      description: '',
      config: {
        tipoOS: 'tipoOS' in s && typeof s.tipoOS === 'string' ? s.tipoOS : undefined,
        prioridade:
          'prioridade' in s && typeof s.prioridade === 'string' ? s.prioridade : undefined,
      },
      status: i === 0 ? ('active' as const) : ('pending' as const),
    }));
    setSteps(newSteps);
    setSelectedStepId(newSteps[0]?.id || null);
    setShowTemplates(false);
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim() || workflowName.trim().length < 3) {
      notify('Informe um nome com pelo menos 3 caracteres.');
      return;
    }
    if (steps.length === 0) {
      notify('Adicione pelo menos um passo ao workflow.');
      return;
    }
    const definition = buildWorkflowDefinition(steps, triggerType, triggerFilter);
    const body = {
      name: workflowName.trim(),
      description: 'Workflow criado via builder de O.S.',
      enabled: isActive,
      definition,
    };

    setIsSaving(true);
    try {
      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
      const method = workflowId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorText =
          typeof payload?.error === 'string' ? payload.error : 'Falha ao salvar workflow.';
        throw new Error(errorText);
      }
      applyWorkflow(payload as WorkflowRuleApi);
      notify(workflowId ? 'Workflow atualizado com sucesso.' : 'Workflow criado com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar workflow.';
      notify(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    if (!workflowId) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorText =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Falha ao alterar status do workflow.';
        throw new Error(errorText);
      }
      setIsActive(Boolean((payload as WorkflowRuleApi).enabled));
      notify(next ? 'Workflow ativado.' : 'Workflow desativado.');
    } catch (error) {
      setIsActive(!next);
      const message =
        error instanceof Error ? error.message : 'Falha ao alterar status do workflow.';
      notify(message);
    }
  };

  const rollbackVersion = async (version: number) => {
    if (!workflowId) return;
    setRollingBackVersion(version);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorText =
          typeof payload?.error === 'string' ? payload.error : 'Falha ao restaurar versão.';
        throw new Error(errorText);
      }
      applyWorkflow(payload as WorkflowRuleApi);
      setVersionOpen(false);
      notify(`Workflow restaurado para v${version}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao restaurar versão.';
      notify(message);
    } finally {
      setRollingBackVersion(null);
    }
  };

  const updateStepConfig = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const updateStepConfigField = (id: string, field: string, value: unknown) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, [field]: value } } : s)),
    );
  };

  const getActionIcon = (action: StepAction) =>
    actionMeta[action]?.icon || <FilePlus className="w-4 h-4" />;
  const getActionColor = (action: StepAction) => {
    const map = {
      CRIAR_OS: 'blue',
      FECHAR_OS: 'green',
      ATUALIZAR_OS: 'amber',
      NOTIFICAR: 'purple',
    };
    return map[action] || 'gray';
  };

  const triggerMeta = TRIGGER_TYPES.find((t) => t.id === triggerType);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] -m-6">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-content-primary">Workflow Builder</h1>
            <p className="text-sm text-content-secondary mt-0.5">Automações e templates de O.S.</p>
          </div>
          {activeTab === 'automacoes' && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-content-primary bg-bg-subtle hover:bg-bg-hover rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Templates
            </button>
          )}
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b border-[rgba(0,0,0,0.06)]">
          <button
            onClick={() => setActiveTab('automacoes')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'automacoes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-content-secondary hover:text-content-primary',
            )}
          >
            <GitBranch className="w-4 h-4" />
            Automações
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-content-secondary hover:text-content-primary',
            )}
          >
            <LayoutTemplate className="w-4 h-4" />
            Templates de OS
          </button>
        </div>
      </div>

      {/* Templates tab */}
      {activeTab === 'templates' && <OsTemplatesTab dark={_props.dark} onToast={_props.onToast} />}

      {/* Automações tab — all existing content below */}
      {activeTab === 'automacoes' && (
        <>
          {/* Template picker */}
          {showTemplates && (
            <div className="mx-6 mt-3 p-3 bg-bg-surface rounded-xl border border-[rgba(0,0,0,0.06)] shadow-md">
              <p className="text-xs font-medium text-content-secondary mb-2">
                Template pré-definidos:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATE_WORKFLOWS.map((tmpl, i) => (
                  <button
                    key={i}
                    onClick={() => loadTemplate(i)}
                    className="text-left p-3 rounded-lg border border-[rgba(0,0,0,0.06)] hover:border-accent-DEFAULT hover:bg-accent-subtle transition-all"
                  >
                    <p className="text-sm font-medium text-content-primary">{tmpl.name}</p>
                    <p className="text-2xs text-content-tertiary mt-1">
                      {tmpl.steps.length} passos
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="mx-6 mt-4 px-4 py-2.5 bg-bg-surface rounded-xl border border-[rgba(0,0,0,0.06)] flex items-center gap-3 shrink-0 shadow-sm">
            <button
              onClick={saveWorkflow}
              disabled={isSaving || isLoading}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-white text-sm font-medium rounded-lg transition-colors',
                isSaving || isLoading
                  ? 'bg-accent-DEFAULT/60 cursor-not-allowed'
                  : 'bg-accent-DEFAULT hover:bg-accent-hover',
              )}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <div className="flex items-center gap-2 ml-1">
              <span className="text-xs text-content-secondary">Ativo</span>
              <button
                onClick={toggleActive}
                disabled={isLoading}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors duration-200',
                  isActive ? 'bg-emerald-500' : 'bg-gray-300',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                    isActive ? 'left-[18px]' : 'left-[2px]',
                  )}
                />
              </button>
            </div>
            <div className="w-px h-5 bg-bg-hover" />
            <div className="relative">
              <button
                onClick={() => setVersionOpen(!versionOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-bg-subtle rounded-lg transition-colors"
              >
                Versões <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {versionOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setVersionOpen(false)} />
                  <div className="absolute top-full mt-1 left-0 w-48 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-lg shadow-lg z-20 py-1">
                    <div className="px-3 py-1 text-2xs text-content-tertiary uppercase tracking-wider">
                      Atual
                    </div>
                    <div className="px-3 py-1.5 text-sm text-content-primary flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{workflowId ? workflowName : 'Não salvo'}</span>
                    </div>
                    <div className="mt-1 border-t border-[rgba(0,0,0,0.06)] pt-1">
                      <div className="px-3 py-1 text-2xs text-content-tertiary uppercase tracking-wider">
                        Histórico
                      </div>
                      {sortedVersions.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-content-tertiary">
                          Sem versões anteriores.
                        </div>
                      )}
                      {sortedVersions.map((version) => (
                        <button
                          key={version.version}
                          onClick={() => rollbackVersion(version.version)}
                          disabled={rollingBackVersion === version.version}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-sm hover:bg-bg-hover flex items-center gap-2',
                            rollingBackVersion === version.version
                              ? 'text-content-tertiary cursor-not-allowed'
                              : 'text-content-primary',
                          )}
                        >
                          <span className="text-2xs text-content-secondary">
                            v{version.version}
                          </span>
                          <span className="truncate">{version.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="flex-1 max-w-[300px] px-3 py-1.5 text-sm bg-bg-subtle border border-transparent focus:border-accent-DEFAULT focus:bg-bg-surface rounded-lg outline-none transition-all"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-bg-subtle rounded-lg transition-colors border border-[rgba(0,0,0,0.06)]">
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>

          {/* Main area */}
          <div className="flex flex-1 mt-4 mx-6 mb-6 gap-4 min-h-0">
            {/* Flowchart Canvas */}
            <div className="flex-1 bg-bg-surface rounded-lg border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden flex flex-col min-w-0">
              <div className="h-11 px-3 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between bg-bg-surface">
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  <Move className="w-3.5 h-3.5" />
                  <span className="font-medium text-content-primary">Fluxograma de O.S.</span>
                  <span className="text-content-tertiary">/</span>
                  <span>{steps.length} etapas</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[rgba(0,0,0,0.06)] bg-bg-subtle p-1">
                  <button
                    type="button"
                    title="Reduzir zoom"
                    onClick={() => setCanvasZoom((value) => Math.max(80, value - 10))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-bg-surface"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-11 text-center text-xs font-medium text-content-secondary">
                    {canvasZoom}%
                  </span>
                  <button
                    type="button"
                    title="Aumentar zoom"
                    onClick={() => setCanvasZoom((value) => Math.min(120, value + 10))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-bg-surface"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar bg-bg-subtle">
                <div
                  className="p-8"
                  style={{
                    minWidth: `${Math.max(1000, 620 + steps.length * 376) * (canvasZoom / 100)}px`,
                    minHeight: `${560 * (canvasZoom / 100)}px`,
                  }}
                >
                  <div
                    className="relative"
                    style={{
                      width: `${Math.max(1000, 620 + steps.length * 376)}px`,
                      transform: `scale(${canvasZoom / 100})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <div className="flex items-start">
                      <div className="w-[300px] shrink-0">
                        <div className="rounded-lg border-2 border-amber-200 bg-amber-50">
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-2xs font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                                    Trigger
                                  </span>
                                  <span className="text-2xs text-content-tertiary">Início</span>
                                </div>
                                <p className="text-sm font-semibold text-content-primary">
                                  {triggerMeta?.label}
                                </p>
                                <p className="text-2xs text-content-secondary mt-0.5">
                                  {triggerMeta?.desc}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mt-3 items-center">
                              <select
                                value={triggerType}
                                onChange={(e) =>
                                  setTriggerType(normalizeTriggerType(e.target.value))
                                }
                                className="min-w-0 px-2.5 py-1.5 text-xs border border-[rgba(0,0,0,0.08)] rounded-lg bg-white outline-none"
                              >
                                {TRIGGER_TYPES.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                              <span className="text-2xs text-content-tertiary">tipo</span>
                              <select
                                value={triggerFilter}
                                onChange={(e) => setTriggerFilter(e.target.value)}
                                className="min-w-0 px-2.5 py-1.5 text-xs border border-[rgba(0,0,0,0.08)] rounded-lg bg-white outline-none"
                              >
                                {TIPO_OS_LIST.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="w-[76px] shrink-0 pt-[66px]">
                        <div className="flex items-center">
                          <div className="h-px flex-1 bg-[rgba(37,99,235,0.28)]" />
                          <button
                            type="button"
                            title="Inserir etapa"
                            onClick={() => addStep(-1)}
                            className="w-8 h-8 rounded-full bg-bg-surface border border-accent-DEFAULT/40 text-accent-DEFAULT inline-flex items-center justify-center hover:bg-accent-DEFAULT hover:text-white"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <div className="h-px flex-1 bg-[rgba(37,99,235,0.28)]" />
                        </div>
                      </div>

                      {steps.map((step, idx) => {
                        const color = getActionColor(step.action);
                        const branchTitle =
                          step.config.prioridade === 'CRITICA'
                            ? 'Prioridade crítica'
                            : step.action === 'NOTIFICAR'
                              ? 'Notificação'
                              : step.config.techAutoAssign
                                ? 'Auto-atribuição'
                                : 'Regra';
                        const branchText =
                          step.config.prioridade === 'CRITICA'
                            ? 'Escala atendimento'
                            : step.action === 'NOTIFICAR'
                              ? 'Avisa equipe'
                              : step.config.techAutoAssign
                                ? 'Seleciona técnico'
                                : 'Condição lateral';

                        return (
                          <div key={step.id} className="flex items-start">
                            <div className="w-[300px] shrink-0">
                              <div
                                onClick={() => setSelectedStepId(step.id)}
                                className={cn(
                                  'group relative rounded-lg border-2 bg-bg-surface p-4 transition-all duration-150 cursor-pointer',
                                  selectedStepId === step.id
                                    ? 'border-accent-DEFAULT ring-2 ring-accent-DEFAULT/15'
                                    : 'border-[rgba(0,0,0,0.08)] hover:border-[rgba(37,99,235,0.34)]',
                                )}
                              >
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-[rgba(0,0,0,0.08)] bg-bg-surface text-content-tertiary flex items-center justify-center">
                                  <GripVertical className="w-4 h-4 rotate-90" />
                                </div>
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm',
                                      color === 'blue'
                                        ? 'bg-blue-100 text-blue-600'
                                        : color === 'green'
                                          ? 'bg-green-100 text-green-600'
                                          : color === 'amber'
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-purple-100 text-purple-600',
                                    )}
                                  >
                                    {step.order}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1 text-2xs font-bold uppercase px-2 py-0.5 rounded-md',
                                          color === 'blue'
                                            ? 'text-blue-600 bg-blue-100'
                                            : color === 'green'
                                              ? 'text-green-600 bg-green-100'
                                              : color === 'amber'
                                                ? 'text-amber-600 bg-amber-100'
                                                : 'text-purple-600 bg-purple-100',
                                        )}
                                      >
                                        {getActionIcon(step.action)}
                                        {actionMeta[step.action]?.label}
                                      </span>
                                      <span className="text-2xs text-content-tertiary">
                                        {idx + 1}/{steps.length}
                                      </span>
                                    </div>
                                    <input
                                      value={step.title}
                                      onChange={(e) =>
                                        updateStepConfig(step.id, { title: e.target.value })
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-base font-semibold text-content-primary bg-transparent border-none outline-none w-full p-0"
                                    />
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {step.config.tipoOS && (
                                        <span className="inline-flex items-center gap-1 text-2xs text-content-secondary bg-bg-subtle px-2 py-0.5 rounded-md">
                                          <FileText className="w-3 h-3" />
                                          {step.config.tipoOS}
                                        </span>
                                      )}
                                      {step.config.prioridade && (
                                        <span
                                          className={cn(
                                            'inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md',
                                            step.config.prioridade === 'CRITICA'
                                              ? 'text-red-600 bg-red-50'
                                              : step.config.prioridade === 'ALTA'
                                                ? 'text-orange-600 bg-orange-50'
                                                : step.config.prioridade === 'NORMAL'
                                                  ? 'text-blue-600 bg-blue-50'
                                                  : 'text-gray-600 bg-gray-50',
                                          )}
                                        >
                                          {step.config.prioridade}
                                        </span>
                                      )}
                                      {step.config.techAutoAssign && (
                                        <span className="inline-flex items-center gap-1 text-2xs text-content-secondary bg-bg-subtle px-2 py-0.5 rounded-md">
                                          Auto-assign
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    title="Remover etapa"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeStep(step.id);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-red-50 text-content-tertiary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-5 rounded-lg border border-dashed border-[rgba(0,0,0,0.14)] bg-bg-surface/90 px-3 py-2 text-center">
                                <p className="text-2xs font-semibold uppercase text-content-tertiary">
                                  {branchTitle}
                                </p>
                                <p className="text-xs text-content-secondary mt-0.5">
                                  {branchText}
                                </p>
                              </div>
                            </div>

                            <div className="w-[76px] shrink-0 pt-[66px]">
                              <div className="flex items-center">
                                <div className="h-px flex-1 bg-[rgba(37,99,235,0.28)]" />
                                <button
                                  type="button"
                                  title="Inserir etapa"
                                  onClick={() => addStep(idx)}
                                  className="w-8 h-8 rounded-full bg-bg-surface border border-accent-DEFAULT/40 text-accent-DEFAULT inline-flex items-center justify-center hover:bg-accent-DEFAULT hover:text-white"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <div className="h-px flex-1 bg-[rgba(37,99,235,0.28)]" />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="w-[220px] shrink-0 pt-[30px]">
                        <div className="rounded-lg border-2 border-dashed border-[rgba(0,0,0,0.14)] bg-bg-surface/90 p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-medium text-content-secondary">
                              Fim do Fluxo
                            </span>
                          </div>
                          <p className="text-2xs text-content-tertiary mt-1">
                            Trilha encerrada após a última etapa
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel - Properties */}
            <div className="w-[320px] shrink-0 bg-bg-surface rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm flex flex-col">
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-content-secondary" />
                  <span className="text-sm font-semibold text-content-primary">
                    Configuração do Passo
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {!selectedStep ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center mb-3">
                      <ArrowRightFromLine className="w-5 h-5 text-content-tertiary" />
                    </div>
                    <p className="text-sm text-content-secondary font-medium">Selecione um passo</p>
                    <p className="text-xs text-content-tertiary mt-1">
                      Clique em um passo no pipeline para editar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Step number + action type */}
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                          getActionColor(selectedStep.action) === 'blue'
                            ? 'bg-blue-100 text-blue-600'
                            : getActionColor(selectedStep.action) === 'green'
                              ? 'bg-green-100 text-green-600'
                              : getActionColor(selectedStep.action) === 'amber'
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-purple-100 text-purple-600',
                        )}
                      >
                        {selectedStep.order}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-content-primary">
                          {selectedStep.title}
                        </p>
                        <p className="text-2xs text-content-secondary">
                          Passo {selectedStep.order} de {steps.length}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-[rgba(0,0,0,0.06)]" />

                    {/* Action Type Select */}
                    <div>
                      <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                        Tipo de Ação
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {(
                          ['CRIAR_OS', 'FECHAR_OS', 'ATUALIZAR_OS', 'NOTIFICAR'] as StepAction[]
                        ).map((act) => {
                          const meta = actionMeta[act];
                          const isSelected = selectedStep.action === act;
                          const colors = {
                            blue: 'border-blue-200 bg-blue-50 text-blue-700',
                            green: 'border-green-200 bg-green-50 text-green-700',
                            amber: 'border-amber-200 bg-amber-50 text-amber-700',
                            purple: 'border-purple-200 bg-purple-50 text-purple-700',
                          };
                          return (
                            <button
                              key={act}
                              onClick={() => updateStepConfig(selectedStep.id, { action: act })}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all',
                                isSelected
                                  ? colors[getActionColor(act) as keyof typeof colors] +
                                      ' ring-1 ring-offset-1 ring-offset-transparent'
                                  : 'border-[rgba(0,0,0,0.08)] text-content-secondary bg-bg-subtle hover:bg-bg-hover',
                              )}
                            >
                              {meta.icon}
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                        Título do Passo
                      </label>
                      <input
                        type="text"
                        value={selectedStep.title}
                        onChange={(e) =>
                          updateStepConfig(selectedStep.id, { title: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none transition-all"
                      />
                    </div>

                    {/* Title Template (for CRIAR_OS) */}
                    {selectedStep.action === 'CRIAR_OS' && (
                      <>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Tipo de O.S.
                          </label>
                          <select
                            value={selectedStep.config.tipoOS || 'CONFIGURACAO'}
                            onChange={(e) =>
                              updateStepConfigField(selectedStep.id, 'tipoOS', e.target.value)
                            }
                            className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none"
                          >
                            {TIPO_OS_LIST.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Prioridade
                          </label>
                          <div className="mt-1.5 flex gap-1.5">
                            {PRIORIDADES.map((p) => (
                              <button
                                key={p}
                                onClick={() =>
                                  updateStepConfigField(selectedStep.id, 'prioridade', p)
                                }
                                className={cn(
                                  'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all',
                                  selectedStep.config.prioridade === p
                                    ? p === 'CRITICA'
                                      ? 'border-red-300 bg-red-50 text-red-700'
                                      : p === 'ALTA'
                                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                                        : p === 'NORMAL'
                                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                                          : 'border-gray-300 bg-gray-50 text-gray-700'
                                    : 'border-[rgba(0,0,0,0.08)] text-content-secondary bg-bg-subtle',
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Atribuição
                          </label>
                          <select
                            value={
                              selectedStep.config.techAutoAssign
                                ? 'auto'
                                : selectedStep.config.tecnico || 'auto'
                            }
                            onChange={(e) => {
                              if (e.target.value === 'auto') {
                                updateStepConfigField(selectedStep.id, 'techAutoAssign', true);
                                updateStepConfigField(selectedStep.id, 'tecnico', undefined);
                              } else {
                                updateStepConfigField(selectedStep.id, 'techAutoAssign', false);
                                updateStepConfigField(selectedStep.id, 'tecnico', e.target.value);
                              }
                            }}
                            className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none"
                          >
                            <option value="auto">Auto-assign (técnico disponível)</option>
                            {TECNICOS.slice(1).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Modelo do Título
                          </label>
                          <input
                            type="text"
                            placeholder="{ordem} - {tipo}"
                            value={selectedStep.config.titleTemplate || ''}
                            onChange={(e) =>
                              updateStepConfigField(
                                selectedStep.id,
                                'titleTemplate',
                                e.target.value,
                              )
                            }
                            className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none font-mono"
                          />
                          <p className="text-2xs text-content-tertiary mt-1">
                            Use {'{ordem}'}, {'{tipo}'}, {'{provedor}'} como variáveis
                          </p>
                        </div>
                      </>
                    )}

                    {/* Fechar OS config */}
                    {selectedStep.action === 'FECHAR_OS' && (
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <p className="text-xs font-medium text-green-700">
                            Este passo fechará automaticamente a O.S. anterior
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Notify config */}
                    {selectedStep.action === 'NOTIFICAR' && (
                      <>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Canal de Notificação
                          </label>
                          <div className="mt-1.5 space-y-1.5">
                            {[
                              { id: 'push', label: 'Push Notification' },
                              { id: 'email', label: 'Email' },
                              { id: 'whatsapp', label: 'WhatsApp' },
                              { id: 'slack', label: 'Slack' },
                            ].map((ch) => (
                              <label
                                key={ch.id}
                                className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-bg-hover"
                              >
                                <input
                                  type="checkbox"
                                  defaultChecked={ch.id === 'push'}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-accent-DEFAULT"
                                />
                                <span className="text-xs text-content-secondary">{ch.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                            Destinatário
                          </label>
                          <select className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none">
                            <option>Técnico responsável</option>
                            <option>Gerente da operação</option>
                            <option>Equipe N2</option>
                            <option>Provedor (cliente)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Description */}
                    <div>
                      <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                        Descrição
                      </label>
                      <textarea
                        value={selectedStep.description}
                        onChange={(e) =>
                          updateStepConfig(selectedStep.id, { description: e.target.value })
                        }
                        rows={3}
                        className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none resize-none"
                        placeholder="Descreva o que este passo faz..."
                      />
                    </div>

                    {/* Duration estimate */}
                    <div>
                      <label className="text-2xs font-medium text-content-secondary uppercase tracking-wider">
                        Tempo Estimado
                      </label>
                      <select className="mt-1 w-full px-3 py-2 text-sm border border-[rgba(0,0,0,0.08)] rounded-lg bg-bg-subtle focus:bg-bg-surface focus:border-accent-DEFAULT outline-none">
                        <option>30 minutos</option>
                        <option>1 hora</option>
                        <option>2 horas</option>
                        <option>4 horas</option>
                        <option>8 horas (1 dia)</option>
                        <option>24 horas</option>
                        <option>Customizado</option>
                      </select>
                    </div>

                    {/* Remove step */}
                    <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                      <button
                        onClick={() => removeStep(selectedStep.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover Passo
                      </button>
                    </div>

                    {/* Trail preview */}
                    {selectedStep.action === 'CRIAR_OS' && (
                      <div className="p-3 rounded-lg bg-accent-subtle/50 border border-accent-DEFAULT/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="w-3.5 h-3.5 text-accent-DEFAULT" />
                          <span className="text-2xs font-semibold text-accent-DEFAULT uppercase tracking-wider">
                            Prévia da Trilha
                          </span>
                        </div>
                        <p className="text-xs text-content-secondary leading-relaxed">
                          Este passo criará uma O.S. de{' '}
                          <strong className="text-content-primary">
                            {selectedStep.config.tipoOS || 'CONFIGURACAO'}
                          </strong>{' '}
                          com prioridade{' '}
                          <strong className="text-content-primary">
                            {selectedStep.config.prioridade || 'NORMAL'}
                          </strong>
                          . A O.S. será vinculada à O.S. anterior, formando uma trilha auditable.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
