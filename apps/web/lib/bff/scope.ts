import type { ErpScope, RoleCode } from '@/lib/erp/contracts';

/** Header interno, preenchido apenas pelo proxy.ts após validar a sessão no NestJS. */
export const SCOPE_HEADER = 'x-ajust-erp-scope';

export type SessionScope = ErpScope & { name?: string; tenantName?: string };

const ROLES: RoleCode[] = ['super_admin', 'gerente', 'analista', 'cliente'];

export function parseScope(raw: string | null | undefined): SessionScope | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SessionScope>;
    if (
      !data.userId ||
      !data.tenantId ||
      !data.sessionKey ||
      !ROLES.includes(data.role as RoleCode)
    )
      return null;
    return data as SessionScope;
  } catch {
    return null;
  }
}
