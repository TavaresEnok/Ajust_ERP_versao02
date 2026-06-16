import { ForbiddenException } from '@nestjs/common';
import { AuthContext } from './auth-context';

export const MANAGER_ROLES = ['super_admin', 'gerente'] as const;

export function assertAnyRole(auth: AuthContext | undefined, allowed: string[]) {
  if (!auth?.role || !allowed.includes(auth.role)) {
    throw new ForbiddenException('Insufficient role for this action.');
  }
}

export function assertManagerRole(auth: AuthContext | undefined) {
  assertAnyRole(auth, [...MANAGER_ROLES]);
}
