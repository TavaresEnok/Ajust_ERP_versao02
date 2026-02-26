import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, applyLoginCookies, clearAuthCookies, RefreshApiResponse } from './auth/_lib';

type ApiMeResponse = {
  id: string;
  name: string;
  email: string;
  tenant: {
    id: string;
    tradeName: string;
    role: string;
  } | null;
};

type AuthSession = {
  accessToken: string;
  me: ApiMeResponse;
  refreshPayload: RefreshApiResponse | null;
};

async function fetchMe(accessToken: string): Promise<ApiMeResponse | null> {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return (await response.json()) as ApiMeResponse;
}

async function refreshSession(refreshToken: string): Promise<RefreshApiResponse | null> {
  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return (await response.json()) as RefreshApiResponse;
}

export async function resolveAuthSession(request: NextRequest): Promise<AuthSession | NextResponse> {
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

  if (!me || !me.tenant?.id || !accessToken) {
    const response = NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  return { accessToken, me, refreshPayload };
}

export function applyRefreshIfNeeded(response: NextResponse, refreshPayload: RefreshApiResponse | null) {
  if (refreshPayload) {
    applyLoginCookies(response, refreshPayload);
  }
  return response;
}

export function parseJsonBody<T>(value: unknown): T {
  return value as T;
}
