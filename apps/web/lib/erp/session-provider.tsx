'use client';
import { useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { createSameOriginTransport, ErpProvider } from './gateway';
import type { SessionScope } from '@/lib/bff/scope';

/**
 * Conecta a interface ao BFF da mesma origem. O escopo vem do servidor (sessão validada no
 * NestJS); sem escopo, apenas o transporte público (login, recuperação, CSAT) fica disponível.
 */
export function ErpSessionProvider({
  scope,
  children,
}: {
  scope: SessionScope | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const transports = useMemo(() => {
    const onUnauthorized = () => {
      if (typeof window === 'undefined' || window.location.pathname === '/login') return;
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    };
    return {
      transport: scope ? createSameOriginTransport('/api/erp', { onUnauthorized }) : null,
      publicTransport: createSameOriginTransport('/api/public'),
    };
  }, [scope, router]);
  const erpScope = useMemo(
    () =>
      scope
        ? {
            userId: scope.userId,
            tenantId: scope.tenantId,
            role: scope.role,
            sessionKey: scope.sessionKey,
            customerId: scope.customerId,
          }
        : null,
    [scope],
  );
  return (
    <ErpProvider
      transport={transports.transport}
      publicTransport={transports.publicTransport}
      scope={erpScope}
    >
      {children}
    </ErpProvider>
  );
}
