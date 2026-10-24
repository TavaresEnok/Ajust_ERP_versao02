export const legacyResourceRoutes: Record<string, string> = {
  orders: 'ordens',
  occurrences: 'ocorrencias',
  users: 'tecnicos',
  tenants: 'empresas',
  assets: 'ativos',
  articles: 'ajustpedia',
  credentials: 'credenciais',
  notes: 'notas',
  catalog: 'servicos',
  slaPolicies: 'politicas-sla',
  calendar: 'agenda',
  onCall: 'plantao',
  notificationRules: 'notificacoes',
  apiKeys: 'integracoes/chaves',
  changes: 'mudancas',
  time: 'apontamentos',
  audit: 'auditoria',
  workflows: 'workflows',
  csat: 'relatorios',
};
const details: Record<string, string[]> = {
  ordens: [
    'resumo',
    'historico',
    'anotacoes',
    'anexos',
    'editar',
    'transicao',
    'aprovacoes',
    'trabalho',
    'sla',
  ],
  ocorrencias: ['resumo', 'editar', 'ordens', 'anotacoes', 'historico'],
  provedores: ['geral', 'ordens', 'contatos', 'servicos', 'historico'],
  tecnicos: ['geral', 'ordens', 'agenda', 'sessoes'],
  ativos: ['informacoes', 'snapshots', 'novo-snapshot', 'comparacao', 'vincular-ordem'],
  ajustpedia: ['leitura', 'editar'],
  empresas: ['dados', 'identidade', 'setores', 'usuarios', 'sla', 'auditoria'],
  servicos: ['detalhes', 'editar'],
  'politicas-sla': ['detalhes', 'editar'],
  workflows: [],
  processos: [],
  automacoes: [],
  mudancas: [],
};
const sections = new Set([
  ...Object.keys(details),
  'agenda',
  'sla',
  'saude',
  'plantao',
  'credenciais',
  'notas',
  'relatorios-turno',
  'relatorios',
  'seguranca',
  'notificacoes',
  'integracoes',
  'configuracoes',
  'trilha-os',
  'empresa',
  'ixc',
  'apontamentos',
  'usuarios',
  'auditoria',
  'processos',
  'calendario-sla',
  'configuracoes-ativos',
  'eventos-tempo-real',
]);
const settings: Record<string, string[]> = {
  configuracoes: [
    'geral',
    'perfil',
    'meu-perfil',
    'preferencias',
    'seguranca',
    'sessoes',
    '2fa',
    'empresa',
    'notificacoes',
    'integracoes',
  ],
  seguranca: ['sessoes', 'perfil', '2fa'],
  notificacoes: ['regras', 'canais'],
  integracoes: ['integracoes', 'chaves', 'api-keys', 'webhooks', 'ixc'],
};
export function canonicalWorkspacePath(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'portal') parts[0] = 'cliente';
  if (parts[1] === 'operacoes' && legacyResourceRoutes[parts[2]])
    parts.splice(1, 2, ...legacyResourceRoutes[parts[2]].split('/'));
  if (parts[1] === 'usuarios') parts[1] = 'tecnicos';
  if (parts[1] === 'automacoes') parts[1] = 'workflows';
  if (parts[1] === 'integracoes' && parts[2] === 'api-keys') parts[2] = 'chaves';
  if (parts[1] === 'configuracoes' && ['notificacoes', 'integracoes'].includes(parts[2]))
    parts.splice(1, 1);
  if (parts[1] === 'configuracoes' && parts[2] === 'meu-perfil') parts[2] = 'perfil';
  return parts.length ? '/' + parts.join('/') : '/';
}
export function isWorkspacePath(path: string): boolean {
  if (path === '/') return true;
  const [portal, section, id, tab, ...extra] = path.split('/').filter(Boolean);
  if (!['gerencia', 'analista', 'cliente'].includes(portal) || extra.length) return false;
  if (!section) return true;
  if (!sections.has(section)) return false;
  if (settings[section]) return !tab && (!id || settings[section].includes(id));
  if (details[section]) return !tab || (!!id && details[section].includes(tab));
  return !id && !tab;
}
export const detailTabLabels: Record<string, string> = {
  resumo: 'Resumo',
  historico: 'Histórico',
  anotacoes: 'Anotações',
  anexos: 'Anexos',
  editar: 'Editar',
  transicao: 'Transição',
  aprovacoes: 'Aprovações',
  trabalho: 'Trabalho',
  sla: 'SLA',
  ordens: 'Ordens vinculadas',
  informacoes: 'Informações',
  snapshots: 'Snapshots',
  'novo-snapshot': 'Novo snapshot',
  comparacao: 'Comparar configurações',
  'vincular-ordem': 'Vincular ordem',
  dados: 'Dados da empresa',
  identidade: 'Identidade visual',
  setores: 'Setores',
  usuarios: 'Usuários e permissões',
  auditoria: 'Auditoria',
  geral: 'Visão geral',
  contatos: 'Contatos',
  servicos: 'Serviços',
};
