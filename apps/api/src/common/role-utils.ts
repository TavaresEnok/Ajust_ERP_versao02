import { ForbiddenException } from '@nestjs/common';
import { AuthContext } from './auth-context';

export function assertAnyRole(auth: AuthContext | undefined, allowed: string[]) {
  if (!auth?.role || !allowed.includes(auth.role)) {
    throw new ForbiddenException('Insufficient role for this action.');
  }
}
