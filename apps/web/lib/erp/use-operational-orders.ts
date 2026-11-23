'use client';
import useSWR from 'swr';
import { useErp, useErpQuery } from './gateway';
import type { ErpRecord } from './contracts';

export interface OperationalSummaryResponse {
  generatedAt: string;
  totals: {
    totalActive: number;
    overdue: number;
    dueSoon: number;
    dueToday: number;
    withinSla: number;
    paused: number;
    withoutSla: number;
    unassigned: number;
    scheduled: number;
    urgent: number;
    opened: number;
    closed: number;
    allInScope: number;
    missingCompletionDate: number;
  };
  byStatus: { status: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  teamLoad: { userId: string | null; name: string; count: number; late: number }[];
  series: { day: string; opened: number; closed: number }[];
}

export interface OperationalQueueResponse {
  generatedAt: string;
  total: number;
  limit: number;
  offset: number;
  items: ErpRecord[];
}

export function useOperationalSummary(
  view: 'mine' | 'operation',
  options: { days?: number | string | null; enabled?: boolean } = {},
) {
  const { days, enabled = true } = options;
  const params = new URLSearchParams({ scope: view });
  if (days !== undefined && days !== null && days !== '' && days !== 'all') {
    params.set('days', String(days));
  }
  return useErpQuery<OperationalSummaryResponse>(
    enabled ? `/service-orders/operational-summary?${params.toString()}` : null,
  );
}

export function useOperationalQueue(
  view: 'mine' | 'operation',
  options: {
    focus?: string;
    search?: string;
    days?: number | string | null;
    limit?: number;
    offset?: number;
    enabled?: boolean;
  } = {},
) {
  const { focus = 'active', search, days, limit = 20, offset = 0, enabled = true } = options;
  const params = new URLSearchParams({
    scope: view,
    focus,
    limit: String(limit),
    offset: String(offset),
  });
  if (search?.trim()) params.set('search', search.trim());
  if (days !== undefined && days !== null && days !== '' && days !== 'all') {
    params.set('days', String(days));
  }
  return useErpQuery<OperationalQueueResponse>(
    enabled ? `/service-orders/operational-queue?${params.toString()}` : null,
  );
}

export interface OperationalOrdersOptions {
  situation?: 'active' | 'completed' | 'all';
  from?: string;
  activitySince?: string;
  enabled?: boolean;
}

const PAGE_SIZE = 200;

export function useOperationalOrders(
  view: 'mine' | 'operation',
  options: OperationalOrdersOptions = {},
) {
  const { transport, scope } = useErp();
  const { situation, from, activitySince, enabled = true } = options;
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
      for (let offset = 0; ; offset += PAGE_SIZE) {
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
