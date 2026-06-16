export type OSStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'AG_CAMPO'
  | 'EM_EXECUCAO'
  | 'AG_TERCEIROS'
  | 'RESOLVIDA'
  | 'FECHADA'
  | 'CANCELADA';
export type Prioridade = 'CRITICA' | 'ALTA' | 'NORMAL' | 'BAIXA';
export type SLAStatus = 'ok' | 'risk' | 'breach';
export type TecnicoStatus = 'disponivel' | 'reuniao' | 'ausente' | 'ferias';
export type ProvedorStatus = 'ativo' | 'inativo' | 'suspenso';
export type EventoTipo = 'REUNIAO' | 'REUNIAO_ONLINE' | 'PLANTAO' | 'FERIADO' | 'LEMBRETE';

export type TipoServico =
  | 'INCIDENTE_CRITICO'
  | 'DEGRADACAO_SERVICO'
  | 'CONSULTORIA_TECNICA'
  | 'IMPLANTACAO'
  | 'TREINAMENTO'
  | 'REVISAO_CONFIGURACAO'
  | 'PLANEJAMENTO'
  | 'INTEGRACAO';

export interface Tecnico {
  id: string;
  nome: string;
  especializacao: string;
  ordensAtivas: number;
  taxaResolucao: number;
  tempoMedio: number;
  status: TecnicoStatus;
  grade: string;
  score: number;
  email?: string;
  telefone?: string;
}

export interface Provedor {
  id: string;
  nome: string;
  cidade: string;
  ordensAtivas: number;
  slaCompliance: number;
  status: ProvedorStatus;
}

export interface OrdemServico {
  protocolo: string;
  provedor: string;
  tecnico: string | null;
  tecnicoId?: string | null;
  tipo: TipoServico;
  prioridade: Prioridade;
  status: OSStatus;
  titulo: string;
  prazoSLA: Date;
  criadaEm: Date;
  concluidaEm?: Date | null;
  slaStatus: SLAStatus;
  descricao?: string;
}

export interface SLAPolicy {
  id: string;
  prioridade: Prioridade;
  tipo: TipoServico | null;
  horas: number;
  override: boolean;
  ativo: boolean;
}

export interface KPI {
  totalAbertas: number;
  slaCompliance: number;
  criticasAtivas: number;
  tempoMedioResolucao: number;
  taxaResolucao: number;
  ordensAtrasadas: number;
  ordensEmRisco: number;
  provedoresAtivos: number;
}

export interface CalendarioEvento {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  data: Date;
  horaInicio?: string;
  horaFim?: string;
  descricao?: string;
}

export interface CMDBItem {
  id: string;
  provedor: string;
  equipamento: string;
  tipo: string;
  ambiente: string;
  ip: string;
  status: string;
}

export interface Credential {
  id: string;
  provider: string;
  equipment: string;
  type: string;
  environment: string;
  username: string;
  secret: string;
}

export type MudancaStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'EM_EXECUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'REJEITADO';
export type MudancaTipo =
  | 'Manutenção'
  | 'Migração'
  | 'Configuração'
  | 'Hardware'
  | 'Software'
  | 'Emergencial';
export type MudancaPrioridade = 'Baixa' | 'Média' | 'Alta' | 'Crítica';
export type MudancaRisco = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';

export interface Mudanca {
  id: string;
  titulo: string;
  tipo: MudancaTipo;
  status: MudancaStatus;
  prioridade: MudancaPrioridade;
  risco: MudancaRisco;
  solicitante: string;
  aprovador: string;
  plannedDate: string;
  windowStart: string;
  windowEnd: string;
  affectedSystems: string[];
  rollback: string;
  description: string;
  impact: string;
  data: Date;
}

export interface TimeEntry {
  id: string;
  tecnico: string;
  os: string;
  inicio: Date;
  fim: Date | null;
  duracao: number;
  descricao: string;
}

export interface Plantao {
  id: string;
  tecnico: string;
  inicio: Date;
  fim: Date;
  tipo: string;
}

export type MenuSection = {
  label: string;
  items: {
    icon: string;
    label: string;
    href: string;
    admin?: boolean;
    badge?: number;
  }[];
};
