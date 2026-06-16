import { NextRequest, NextResponse } from 'next/server';
import {
  buildServiceOrderApiQuery,
  normalizeDashboardFilters,
} from '../../../../lib/query-builders';
import {
  apiBaseUrl,
  applyLoginCookies,
  clearAuthCookies,
  RefreshApiResponse,
} from '../../auth/_lib';

type ApiMeResponse = {
  tenant: {
    id: string;
  } | null;
};

function searchParamsToRecord(
  params: URLSearchParams,
): Record<string, string | string[] | undefined> {
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of params.entries()) {
    const current = record[key];
    if (current === undefined) {
      record[key] = value;
      continue;
    }
    if (Array.isArray(current)) {
      current.push(value);
      record[key] = current;
      continue;
    }
    record[key] = [current, value];
  }
  return record;
}

function pickFileName(contentDisposition: string | null) {
  if (!contentDisposition) return `service-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  const matched = contentDisposition.match(/filename="?([^"]+)"?/i);
  return matched?.[1] || `service-orders-${new Date().toISOString().slice(0, 10)}.csv`;
}

async function fetchMe(accessToken: string) {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as ApiMeResponse;
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as RefreshApiResponse;
}

export async function GET(request: NextRequest) {
  try {
    const filters = normalizeDashboardFilters(searchParamsToRecord(request.nextUrl.searchParams));
    let accessToken = request.cookies.get('erp_access_token')?.value || '';
    const refreshToken = request.cookies.get('erp_refresh_token')?.value || '';
    let refreshPayload: RefreshApiResponse | null = null;

    let me = accessToken ? await fetchMe(accessToken) : null;
    if (!me && refreshToken) {
      refreshPayload = await refreshSession(refreshToken);
      if (refreshPayload) {
        accessToken = refreshPayload.accessToken;
        me = await fetchMe(accessToken);
      }
    }

    if (!me?.tenant?.id || !accessToken) {
      const response = NextResponse.json(
        { error: 'Sessao expirada para exportacao.' },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const exportQuery = buildServiceOrderApiQuery(me.tenant.id, filters, {
      includePagination: false,
    });
    const exportResponse = await fetch(`${apiBaseUrl()}/service-orders/export/csv?${exportQuery}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!exportResponse.ok) {
      const message = await exportResponse.text();
      return NextResponse.json(
        { error: message || 'Falha ao exportar CSV.' },
        { status: exportResponse.status },
      );
    }

    const csv = await exportResponse.text();
    const fileName = pickFileName(exportResponse.headers.get('content-disposition'));
    const response = new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
      },
    });

    if (refreshPayload) {
      applyLoginCookies(response, refreshPayload);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada na exportacao.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
