import { canAccessSection } from './erp/access';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Activity,
  Building2,
  Users,
  BookOpen,
  KeyRound,
  StickyNote,
  BarChart3,
  Settings2,
  ShieldCheck,
  Bell,
  Workflow,
  Timer,
  Server,
  Radio,
  Layers,
  Blocks,
  Headphones,
  FileCheck2,
  Network,
  ListChecks,
  HeartPulse,
  GitPullRequest,
  Clock3,
  type LucideIcon,
} from 'lucide-react';
export type NavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  count?: string;
  description: string;
};
export type NavGroup = { label: string; items: NavItem[]; collapsible?: boolean };
export const navigation: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      {
        title: 'Dashboard',
        path: '/gerencia',
        icon: LayoutDashboard,
        description: 'Acompanhe os indicadores e a evolução da sua operação.',
      },
      {
        title: 'Relatórios de turno',
        path: '/gerencia/relatorios-turno',
        icon: ClipboardList,
        description: 'Passagem de turno, atividades e pendências da equipe.',
      },
      {
        title: 'Ordens de serviço',
        path: '/gerencia/ordens',
        icon: ClipboardList,
        description: 'Organize, acompanhe e gerencie todas as suas ordens de serviço.',
      },
      {
        title: 'Histórico e transições',
        path: '/gerencia/trilha-os',
        icon: Workflow,
        description: 'Consulte o histórico das O.S. e as transições observadas.',
      },
      {
        title: 'Agenda',
        path: '/gerencia/agenda',
        icon: CalendarDays,
        description: 'Seus compromissos e os da sua equipe em um só lugar.',
      },
      {
        title: 'Ocorrências',
        path: '/gerencia/ocorrencias',
        icon: Activity,
        description: 'Monitore incidentes e mantenha sua operação sob controle.',
      },
    ],
  },
  {
    label: 'Operação',
    items: [
      {
        title: 'Provedores',
        path: '/gerencia/provedores',
        icon: Building2,
        description: 'Uma visão completa dos provedores e seus serviços.',
      },
      {
        title: 'Equipe técnica',
        path: '/gerencia/tecnicos',
        icon: Users,
        description: 'Pessoas, disponibilidade e desempenho da sua equipe.',
      },
      {
        title: 'Monitor de SLA',
        path: '/gerencia/sla',
        icon: Timer,
        description: 'Antecipe riscos e mantenha seus compromissos no prazo.',
      },
      {
        title: 'Saúde operacional',
        path: '/gerencia/saude',
        icon: HeartPulse,
        description: 'A saúde da operação, com os indicadores que importam.',
      },
      {
        title: 'Plantão NOC',
        path: '/gerencia/plantao',
        icon: Radio,
        description: 'Escalas e cobertura para uma operação sempre disponível.',
      },
      {
        title: 'Ativos e configurações',
        path: '/gerencia/ativos',
        icon: Server,
        description: 'Inventário de ativos, configurações e histórico de snapshots.',
      },
    ],
  },
  {
    label: 'Operações do ERP',
    items: [
      {
        title: 'Gestão de mudanças',
        path: '/gerencia/mudancas',
        icon: GitPullRequest,
        description: 'RFCs, risco, janelas, aprovação e reversão.',
      },
      {
        title: 'Registro de trabalho',
        path: '/gerencia/apontamentos',
        icon: Clock3,
        description: 'Apontamentos de tempo por ordem de serviço.',
      },
      {
        title: 'Acompanhamento dos atendimentos',
        path: '/gerencia/processos',
        icon: ListChecks,
        description: 'Execuções reais, O.S. vinculadas, responsáveis, pendências e progresso.',
      },
    ],
  },
  {
    label: 'Conhecimento',
    items: [
      {
        title: 'Ajustpedia',
        path: '/analista/ajustpedia',
        icon: BookOpen,
        description: 'O conhecimento da sua equipe, conectado e acessível.',
      },
      {
        title: 'Cofre de credenciais',
        path: '/analista/credenciais',
        icon: KeyRound,
        description: 'Organize os acessos dos provedores com segurança.',
      },
      {
        title: 'Minhas notas',
        path: '/analista/notas',
        icon: StickyNote,
        description: 'Ideias e anotações para simplificar seu dia a dia.',
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        title: 'Relatórios',
        path: '/gerencia/relatorios',
        icon: BarChart3,
        description: 'Transforme os dados da operação em boas decisões.',
      },
      {
        title: 'Empresas e tenants',
        path: '/gerencia/empresas',
        icon: Blocks,
        description: 'Gerencie empresas, setores e ambientes de trabalho.',
      },
      {
        title: 'Tipos de serviço',
        path: '/gerencia/servicos',
        icon: Layers,
        description: 'Volume, resolução e responsáveis por tipo de demanda; catálogo e modelos.',
      },
      {
        title: 'Políticas de SLA',
        path: '/gerencia/politicas-sla',
        icon: FileCheck2,
        description: 'Defina prazos, prioridades e regras de atendimento.',
      },
      {
        title: 'Fluxos de atendimento',
        path: '/gerencia/workflows',
        icon: Workflow,
        description: 'Crie e publique fluxos de atendimento e configure automações por evento.',
      },
    ],
  },
  {
    label: 'Administração',
    items: [
      {
        title: 'Sessões e segurança',
        path: '/gerencia/seguranca',
        icon: ShieldCheck,
        description: 'Visibilidade dos acessos e sessões do ambiente.',
      },
      {
        title: 'Notificações',
        path: '/gerencia/notificacoes',
        icon: Bell,
        description: 'Os alertas certos, para as pessoas certas.',
      },
      {
        title: 'Integrações e API',
        path: '/gerencia/integracoes',
        icon: Network,
        description: 'Conecte suas ferramentas e gerencie chaves de acesso.',
      },
      {
        title: 'Monitor em tempo real',
        path: '/gerencia/eventos-tempo-real',
        icon: Radio,
        description: 'Acompanhe eventos WebSocket autorizados da empresa.',
      },
      {
        title: 'Configurações',
        path: '/gerencia/configuracoes',
        icon: Settings2,
        description: 'Deixe o Ajust ERP com a cara da sua operação.',
      },
    ],
  },
];
export const portalItems: NavItem[] = [
  {
    title: 'Área do analista',
    path: '/analista',
    icon: Headphones,
    description: 'Seu espaço de trabalho, pronto para um dia produtivo.',
  },
  {
    title: 'Portal do cliente',
    path: '/cliente',
    icon: ListChecks,
    description: 'Acompanhe seus chamados e fale com nossa equipe.',
  },
];
navigation
  .find((group) => group.label === 'Administração')!
  .items.push(
    {
      title: 'Usuários e acessos',
      path: '/gerencia/usuarios',
      icon: Users,
      description: 'Usuários, funções, setores e permissões do ERP.',
    },
    {
      title: 'Auditoria operacional',
      path: '/gerencia/auditoria',
      icon: ShieldCheck,
      description: 'Histórico de ações por autor, período e recurso.',
    },
  );
export const advancedItems: NavItem[] = [
  {
    title: 'Empresa, setores e funções',
    path: '/gerencia/empresa',
    icon: Building2,
    description: 'Cadastro, identidade visual, setores e funções do ERP.',
  },
  {
    title: 'Integração IXC',
    path: '/gerencia/ixc',
    icon: Network,
    description: 'Configuração, reconciliação e contratos de webhooks.',
  },
  {
    title: 'Calendário e regras de SLA',
    path: '/gerencia/calendario-sla',
    icon: Timer,
    description: 'Dias úteis, exceções, políticas e simulação de prazos.',
  },
  {
    title: 'Configurações e snapshots',
    path: '/gerencia/configuracoes-ativos',
    icon: Server,
    description: 'Histórico e comparação de configurações reais do ERP.',
  },
];
navigation.push({ label: 'Configuração operacional', items: advancedItems });
export const allNavigation = [...navigation.flatMap((g) => g.items), ...portalItems];
export function getPortalNavigation(path: string, role?: import('./erp/contracts').RoleCode) {
  const portal =
    path.startsWith('/cliente') || path.startsWith('/portal')
      ? '/cliente'
      : path.startsWith('/analista')
        ? '/analista'
        : '/gerencia';
  const customer = role === 'cliente' || (!role && portal === '/cliente');
  const analyst = role === 'analista' || (!role && portal === '/analista');
  if (analyst) {
    const groups = [
      {
        label: 'Meu trabalho',
        sections: ['', 'ordens', 'provedores', 'agenda', 'sla', 'relatorios-turno'],
      },
      { label: 'Conhecimento', sections: ['ajustpedia', 'credenciais', 'notas'] },
      {
        label: 'Ferramentas técnicas',
        sections: ['ativos', 'plantao'],
        collapsible: true,
      },
      { label: 'Minha conta', sections: ['seguranca', 'configuracoes'], collapsible: true },
    ];
    return groups.map(
      ({ label, sections, collapsible }): NavGroup => ({
        label,
        collapsible,
        items: sections.flatMap((section) => {
          const item = navigation
            .flatMap((g) => g.items)
            .find((n) => (n.path.split('/').filter(Boolean)[1] || '') === section);
          if (!item || (role && !canAccessSection(role, section))) return [];
          return [
            {
              ...item,
              title:
                section === ''
                  ? 'Meu painel'
                  : section === 'ordens'
                    ? 'Minhas ordens'
                    : section === 'ativos'
                      ? 'Equipamentos e configurações'
                      : section === 'plantao'
                        ? 'Escala de plantão'
                        : section === 'processos'
                          ? 'Acompanhar atendimentos'
                          : item.title,
              path: item.path.replace(/^\/(gerencia|analista|cliente)/, portal),
              count: undefined,
            },
          ];
        }),
      }),
    );
  }
  const customerSections = new Set([
    'ordens',
    'agenda',
    'notas',
    'relatorios',
    'ativos',
    'servicos',
    'usuarios',
    'configuracoes',
    'seguranca',
    'empresa',
  ]);
  return navigation
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          const parts = item.path.split('/').filter(Boolean);
          if (!parts[1]) return true;
          if (role && !canAccessSection(role, parts[1], parts[2])) return false;
          return !customer || customerSections.has(parts[1]);
        })
        .map((item) => ({
          ...item,
          count: undefined,
          path: item.path.replace(/^\/(gerencia|analista|cliente)/, portal),
        })),
    }))
    .filter((group) => group.items.length);
}
export function getPage(path: string) {
  if (path === '/portal') return portalItems[1];
  const equivalent = path.replace(/^\/(analista|cliente|portal)/, '/gerencia');
  return (
    allNavigation.find((n) => n.path === path) ||
    allNavigation.find(
      (n) => n.path.replace(/^\/(analista|cliente)/, '/gerencia') === equivalent,
    ) ||
    allNavigation.find((n) => {
      const normalized = n.path.replace(/^\/(analista|cliente|portal)/, '/gerencia');
      return normalized !== '/gerencia' && equivalent.startsWith(normalized + '/');
    }) ||
    allNavigation[0]
  );
}
