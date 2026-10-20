import { NextRequest, NextResponse } from 'next/server';
import { isCrossOriginMutation, json } from '@/lib/bff/forward';
import { ACCESS_COOKIE, SESSION_COOKIE, apiBaseUrl, clearAuthCookies } from '@/lib/bff/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (isCrossOriginMutation(request)) return json(403, 'Origem não autorizada.');
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
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
