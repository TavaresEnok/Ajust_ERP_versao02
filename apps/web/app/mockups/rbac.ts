/**
 * RBAC helper — permissões por papel no frontend.
 * Baseado nos papéis: super_admin, gerente, analista, tecnico, cliente, leitura
 */

export type RoleCode = 'super_admin' | 'gerente' | 'analista' | 'tecnico' | 'cliente' | 'leitura';

/* ─── Permissões de Ocorrência ─── */
export function canCreateOccurrence(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

export function canEditOccurrence(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

export function canAnnotateOccurrence(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

/* ─── Permissões de Ordem de Serviço ─── */
export function canCreateOrder(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

export function canEditOrder(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

export function canCloseOrder(role: string): boolean {
    // tecnico só pode marcar Resolvida, não Fechada
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

export function canResolveOrder(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

export function canApproveOrder(role: string): boolean {
    return ['super_admin', 'gerente'].includes(role);
}

export function canCancelOrder(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

export function canReopenOrder(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

/* ─── Permissões de Upload ─── */
export function canUploadAttachment(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

/* ─── Permissões de Relatório / Export ─── */
export function canViewReports(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'leitura'].includes(role);
}

export function canExportCsv(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'leitura'].includes(role);
}

/* ─── Permissões de IAM / Gestão ─── */
export function canManageUsers(role: string): boolean {
    return ['super_admin', 'gerente'].includes(role);
}

export function canManageTenants(role: string): boolean {
    return ['super_admin'].includes(role);
}

export function canViewGlobalReports(role: string): boolean {
    // gerente precisa de permissão explícita (não modelada aqui, usa flag no backend)
    return ['super_admin'].includes(role);
}

/* ─── Permissões de Knowledge ─── */
export function canAccessKnowledge(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

export function canEditKnowledge(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

export function canRevealCredential(role: string): boolean {
    return ['super_admin', 'gerente', 'analista'].includes(role);
}

/* ─── Permissões de Configuração ─── */
export function canEditProfile(role: string): boolean {
    return true; // todos podem editar seu próprio perfil
}

export function canChangePassword(role: string): boolean {
    return true;
}

/* ─── Permissões Gerais ─── */
export function isOperationalRole(role: string): boolean {
    return ['super_admin', 'gerente', 'analista', 'tecnico'].includes(role);
}

export function isManagerRole(role: string): boolean {
    return ['super_admin', 'gerente'].includes(role);
}

export function isClientRole(role: string): boolean {
    return role === 'cliente';
}

export function isReadOnlyRole(role: string): boolean {
    return role === 'leitura' || role === 'cliente';
}
