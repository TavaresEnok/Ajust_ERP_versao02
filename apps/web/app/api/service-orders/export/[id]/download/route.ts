import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, applyLoginCookies, clearAuthCookies, RefreshApiResponse } from '../../../../auth/_lib';

type ApiMeResponse = {
  tenant: {
    id: string;
  } | null;
};

function pickFileName(contentDisposition: string | null, fallbackId: string) {
  if (!contentDisposition) return `service-orders-${fallbackId}.csv`;
  const matched = contentDisposition.match(/filename="?([^"]+)"?/i);
  return matched?.[1] || `service-orders-${fallbackId}.csv`;
}

async function fetchMe(accessToken: string) {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return (await response.json()) as ApiMeResponse;
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return (await response.json()) as RefreshApiResponse;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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
      const response = NextResponse.json({ error: 'Sessao expirada para download.' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const response = await fetch(
      `${apiBaseUrl()}/service-orders/export/${id}/download?tenantId=${encodeURIComponent(me.tenant.id)}`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: message || 'Falha ao baixar exportacao.' }, { status: response.status });
    }

    const fileName = pickFileName(response.headers.get('content-disposition'), id);
    const content = await response.text();
    const proxyResponse = new NextResponse(content, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`
      }
    });

    if (refreshPayload) {
      applyLoginCookies(proxyResponse, refreshPayload);
    }
    return proxyResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada no download.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

