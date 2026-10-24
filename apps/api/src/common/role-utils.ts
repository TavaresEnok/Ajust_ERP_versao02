import { ForbiddenException } from '@nestjs/common';
import { AuthContext } from './auth-context';

export const MANAGER_ROLES = ['super_admin', 'gerente'] as const;
export const ACTIVE_ROLES = ['super_admin', 'gerente', 'analista', 'cliente'] as const;

export function isActiveRole(role: unknown): role is (typeof ACTIVE_ROLES)[number] {
  return typeof role === 'string' && ACTIVE_ROLES.includes(role as (typeof ACTIVE_ROLES)[number]);
}

export function assertAnyRole(auth: AuthContext | undefined, allowed: string[]) {
  if (!auth?.role || !allowed.includes(auth.role)) {
    throw new ForbiddenException('Insufficient role for this action.');
  }
}

export function assertManagerRole(auth: AuthContext | undefined) {
  assertAnyRole(auth, [...MANAGER_ROLES]);
}
