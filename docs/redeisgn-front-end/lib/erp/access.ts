import type { RoleCode } from "./contracts";
const managers: RoleCode[] = ["super_admin", "gerente"];
const operators: RoleCode[] = [...managers, "analista", "tecnico"];
const sectionRoles: Record<string, RoleCode[]> = {
  provedores: managers, tecnicos: [...managers, "cliente"], empresas: managers, usuarios: [...managers, "cliente"], empresa: [...managers, "cliente"], auditoria: managers,
  ixc: managers, notificacoes: managers, integracoes: managers, processos: managers, automacoes: managers, workflows: managers, "eventos-tempo-real": managers, "calendario-sla": operators, "politicas-sla": operators,
  credenciais: operators, ajustpedia: [...operators, "leitura"], mudancas: operators, apontamentos: operators, ocorrencias: operators, saude: [...managers, "analista", "cliente", "leitura"],
};
export function canAccessSection(role: RoleCode, section?: string, resource?: string) {
  if (!section) return true;
  if (section === "operacoes") { if (resource === "occurrences" || resource === "changes" || resource === "time") return operators.includes(role); if (resource === "users") return [...managers, "cliente"].includes(role); if (resource === "audit") return managers.includes(role); }
  return !sectionRoles[section] || sectionRoles[section].includes(role);
}
export function portalForRole(role: RoleCode) { return role === "cliente" || role === "leitura" ? "/cliente" : role === "analista" || role === "tecnico" ? "/analista" : "/gerencia"; }
