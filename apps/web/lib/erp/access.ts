import type { RoleCode } from './contracts';
const managers: RoleCode[] = ['super_admin', 'gerente'];
const operators: RoleCode[] = [...managers, 'analista'];
const sectionRoles: Record<string, RoleCode[]> = {
  'relatorios-turno': operators,
  provedores: operators,
  tecnicos: [...managers, 'cliente'],
  empresas: managers,
  usuarios: [...managers, 'cliente'],
  empresa: [...managers, 'cliente'],
  auditoria: managers,
  ixc: managers,
  notificacoes: managers,
  integracoes: managers,
  processos: operators,
  automacoes: managers,
  workflows: managers,
  'eventos-tempo-real': managers,
  'calendario-sla': operators,
  'politicas-sla': operators,
  credenciais: operators,
  ajustpedia: [...operators],
  mudancas: operators,
  apontamentos: operators,
  ocorrencias: operators,
  saude: [...managers, 'analista', 'cliente'],
  // Alinhado aos perfis operacionais exigidos pelo CmdbController.
  ativos: [...operators],
  'configuracoes-ativos': [...operators],
};
/** Seções de configurações que dependem do IAM (tenants/roles). */
const companySettingsRoles: RoleCode[] = [...managers, 'cliente'];
export function canAccessCompanySettings(role: RoleCode) {
  return companySettingsRoles.includes(role);
}
export function canAccessSection(role: RoleCode, section?: string, resource?: string) {
  if (!section) return true;
  if (section === 'configuracoes' && (resource === 'geral' || resource === 'empresa'))
    return canAccessCompanySettings(role);
  if (section === 'operacoes') {
    if (resource === 'occurrences' || resource === 'changes' || resource === 'time')
      return operators.includes(role);
    if (resource === 'users') return [...managers, 'cliente'].includes(role);
    if (resource === 'audit') return managers.includes(role);
  }
  return !sectionRoles[section] || sectionRoles[section].includes(role);
}
export function portalForRole(role: RoleCode) {
  return role === 'cliente' ? '/cliente' : role === 'analista' ? '/analista' : '/gerencia';
}
