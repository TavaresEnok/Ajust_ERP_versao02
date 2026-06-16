/**
 * Tipos, constantes e helpers compartilhados do Workflow Builder.
 *
 * Extraídos de `workflow-builder-view.tsx` (Sprint 2 do plano de melhorias) para
 * reduzir o tamanho do componente e facilitar testes isolados.
 */

export type StepAction = 'CRIAR_OS' | 'FECHAR_OS' | 'ATUALIZAR_OS' | 'NOTIFICAR';
export type StepStatus = 'pending' | 'active' | 'completed';
export type TriggerType = 'os_created' | 'os_closed' | 'status_changed' | 'manual';

export interface WorkflowStep {
  id: string;
  order: number;
  action: StepAction;
  title: string;
  description: string;
  config: StepConfig;
  status: StepStatus;
}

export interface StepConfig {
  tipoOS?: string;
  prioridade?: string;
  titleTemplate?: string;
  tecnico?: string;
  techAutoAssign?: boolean;
  notifyChannel?: string[];
  notifyTarget?: string;
  duration?: number;
  dependsOn?: string;
}

export interface WorkflowNodeApi {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  subtype: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdgeApi {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowVersionApi {
  version: number;
  createdAt: string;
  createdBy?: string | null;
  name: string;
  description?: string;
  definition: {
    nodes: WorkflowNodeApi[];
    edges: WorkflowEdgeApi[];
    governance?: Record<string, unknown>;
  };
}

export interface WorkflowDefinitionApi {
  nodes: WorkflowNodeApi[];
  edges: WorkflowEdgeApi[];
  governance?: Record<string, unknown>;
  versions?: WorkflowVersionApi[];
}

export interface WorkflowRuleApi {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  definition: WorkflowDefinitionApi | null;
}

export const TIPO_OS_LIST = [
  'NOVO_EQUIPAMENTO',
  'CONFIGURACAO',
  'INSTALACAO',
  'MONITORAMENTO',
  'BACKUP',
  'ACESSO',
  'AUDITORIA',
  'MANUTENCAO',
  'IMPLANTACAO',
] as const;

export const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as const;

export const TECNICOS = [
  'Auto-assign',
  'Carlos Silva',
  'Fernanda Costa',
  'Roberto Almeida',
  'João Pereira',
  'Ana Beatriz',
] as const;

export const TRIGGER_TYPES: ReadonlyArray<{ id: TriggerType; label: string; desc: string }> = [
  { id: 'os_created', label: 'OS Criada', desc: 'Quando uma OS for aberta no sistema' },
  { id: 'os_closed', label: 'OS Fechada', desc: 'Quando uma OS for encerrada' },
  { id: 'status_changed', label: 'Status Alterado', desc: 'Alteração de status da OS' },
  { id: 'manual', label: 'Manual', desc: 'Acionado manualmente pelo usuário' },
];

export const TRIGGER_UI_TO_SUBTYPE: Record<TriggerType, string> = {
  os_created: 'os_criada',
  os_closed: 'os_fechada',
  status_changed: 'os_atualizada',
  manual: 'manual',
};

export const TRIGGER_SUBTYPE_TO_UI: Record<string, TriggerType> = {
  os_criada: 'os_created',
  start_os_criada: 'os_created',
  os_fechada: 'os_closed',
  os_atualizada: 'status_changed',
  start_implantacao: 'os_created',
  os_critica: 'status_changed',
  sla_breach: 'status_changed',
  manual: 'manual',
};

export const SERVICE_TYPE_TO_API: Record<string, string> = {
  NOVO_EQUIPAMENTO: 'INSTALACAO',
  CONFIGURACAO: 'CONFIGURACAO_ONU',
  INSTALACAO: 'INSTALACAO',
  MONITORAMENTO: 'AUDITORIA',
  BACKUP: 'AUDITORIA',
  ACESSO: 'TROCA_SENHA',
  AUDITORIA: 'AUDITORIA',
  MANUTENCAO: 'ROMPIMENTO',
  IMPLANTACAO: 'INSTALACAO',
};

export const API_SERVICE_TO_UI: Record<string, string> = {
  ROMPIMENTO: 'MANUTENCAO',
  LENTIDAO: 'MONITORAMENTO',
  CONFIGURACAO_ONU: 'CONFIGURACAO',
  TROCA_SENHA: 'ACESSO',
  CANCELAMENTO: 'AUDITORIA',
  AUDITORIA: 'AUDITORIA',
  INSTALACAO: 'INSTALACAO',
  BGP: 'MONITORAMENTO',
};

export function genId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function normalizeTriggerType(value: string): TriggerType {
  if (value === 'os_closed' || value === 'status_changed' || value === 'manual') return value;
  return 'os_created';
}

export function mapActionToSubtype(action: StepAction): string {
  if (action === 'CRIAR_OS') return 'task_service';
  if (action === 'FECHAR_OS') return 'action_close_order';
  if (action === 'ATUALIZAR_OS') return 'action_assign';
  return 'action_notify_slack';
}

export function mapSubtypeToAction(subtype: string): StepAction {
  if (subtype === 'task_service') return 'CRIAR_OS';
  if (subtype === 'action_close_order') return 'FECHAR_OS';
  if (subtype === 'action_assign') return 'ATUALIZAR_OS';
  if (subtype === 'action_notify_slack') return 'NOTIFICAR';
  return 'CRIAR_OS';
}

export function mapServiceTypeToApi(value?: string): string {
  if (!value) return 'AUDITORIA';
  return SERVICE_TYPE_TO_API[value] || 'AUDITORIA';
}

export function mapServiceTypeFromApi(value?: string): string | undefined {
  if (!value) return undefined;
  return API_SERVICE_TO_UI[value] || undefined;
}
