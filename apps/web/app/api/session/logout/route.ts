import { NextRequest, NextResponse } from 'next/server';
import { isCrossOriginMutation, json } from '@/lib/bff/forward';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  apiBaseUrl,
  clearAuthCookies,
  refreshSession,
} from '@/lib/bff/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (isCrossOriginMutation(request)) return json(403, 'Origem não autorizada.');
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  // O cookie de acesso dura 15 min; depois disso só resta o refresh (7 dias). Sem renovar,
  // o logout limparia só os cookies e a sessão continuaria válida no banco.
  if (!accessToken && refreshToken) {
    try {
      const refreshed = await refreshSession(refreshToken);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        sessionId = refreshed.sessionId;
      }
    } catch {
      // API indisponível: os cookies são limpos mesmo assim.
    }
  }
  if (accessToken) {
    try {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
        cache: 'no-store',
      });
    } catch {
      // A limpeza local dos cookies acontece mesmo se a API estiver indisponível.
    }
  }
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response.cookies);
  return response;
}
