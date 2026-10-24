'use client';
import useSWR from 'swr';
import { useErp } from './gateway';
import type { ErpRecord } from './contracts';
export function useOperationalOrders(view: 'mine' | 'operation') {
  const { transport, scope } = useErp();
  return useSWR(
    transport && scope
      ? ['erp', scope.sessionKey, scope.tenantId, scope.role, 'operational-orders', view]
      : null,
    async () => {
      const rows: ErpRecord[] = [];
      for (let offset = 0; offset < 10000; offset += 200) {
        const batch = await transport!.request<ErpRecord[]>({
          path: `/service-orders?scope=${view}&limit=200&offset=${offset}`,
        });
        rows.push(...batch);
        if (batch.length < 200) return [...new Map(rows.map((row) => [row.id, row])).values()];
      }
      throw new Error(
        'O recorte excedeu 10.000 O.S. Solicite uma consulta por período para calcular os indicadores.',
      );
    },
    { refreshInterval: 60000 },
  );
}
