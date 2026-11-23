'use client';
import useSWR from 'swr';
import { useErp } from './gateway';
import type { ErpRecord } from './contracts';

export interface OperationalOrdersOptions {
  situation?: 'active' | 'completed' | 'all';
  from?: string;
  activitySince?: string;
  enabled?: boolean;
  maxRows?: number;
}

const DEFAULT_MAX_ROWS = 10_000;
const PAGE_SIZE = 200;

export function useOperationalOrders(
  view: 'mine' | 'operation',
  options: OperationalOrdersOptions = {},
) {
  const { transport, scope } = useErp();
  const { situation, from, activitySince, enabled = true, maxRows = DEFAULT_MAX_ROWS } = options;
  const params = new URLSearchParams({ scope: view, limit: String(PAGE_SIZE) });
  if (situation) params.set('situation', situation);
  if (from) params.set('from', from);
  if (activitySince) params.set('activitySince', activitySince);
  const queryBase = params.toString();

  return useSWR(
    enabled && transport && scope
      ? ['erp', scope.sessionKey, scope.tenantId, scope.role, 'operational-orders', queryBase]
      : null,
    async () => {
      const rows: ErpRecord[] = [];
      for (let offset = 0; offset < maxRows; offset += PAGE_SIZE) {
        const batch = await transport!.request<ErpRecord[]>({
          path: `/service-orders?${queryBase}&offset=${offset}`,
        });
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      return [...new Map(rows.map((row) => [row.id, row])).values()];
    },
    { refreshInterval: 60000 },
  );
}
