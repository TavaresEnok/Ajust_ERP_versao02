import { NextRequest, NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
  resolveSession,
  roleHome,
  type RefreshApiResponse,
  type ResolvedSession,
} from '@/lib/bff/server';
import { SCOPE_HEADER } from '@/lib/bff/scope';

/**
 * Proteção das páginas: valida a sessão no NestJS (renovando os cookies quando preciso),
 * restringe cada perfil ao seu portal e entrega o escopo da sessão ao layout por um header
 * interno. A autorização efetiva de dados continua no NestJS; isto é apenas navegação.
 */
const PORTALS = ['/gerencia', '/analista', '/cliente'];
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function portalOf(pathname: string) {
  return PORTALS.find((portal) => pathname === portal || pathname.startsWith(`${portal}/`));
}

/** Aliases de URLs do frontend antigo, ajustados ao portal do perfil. */
function legacyRedirect(pathname: string, home: string | null) {
  if (pathname === '/dashboard' || pathname === '/portal/dashboard') return home || '/login';
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return null; // tratado pelo app
  if (['/tecnico', '/tecnicos'].includes(pathname)) return '/analista';
  return null;
}

function withRefreshedCookies(
  response: NextResponse,
  refreshed: RefreshApiResponse | null | undefined,
) {
  if (refreshed) applyAuthCookies(response.cookies, refreshed);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  // O escopo só pode vir deste proxy; nunca do cliente.
  requestHeaders.delete(SCOPE_HEADER);
  requestHeaders.delete('x-middleware-subrequest');

  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/csat/');
  const hasSessionCookie =
    request.cookies.has('ajust_live_access_token') ||
    request.cookies.has('ajust_live_refresh_token');
  let session: ResolvedSession | null = null;
  try {
    session = hasSessionCookie ? await resolveSession(request.cookies) : null;
  } catch {
    return new NextResponse(
      'ERP temporariamente indisponível. Sua sessão foi preservada; atualize esta página em instantes.',
      {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'retry-after': '3',
          'cache-control': 'no-store',
        },
      },
    );
  }
  const role = session?.me.tenant.role || null;
  const home = roleHome(role);

  const legacy = legacyRedirect(pathname, home);
  if (legacy && legacy !== pathname) {
    return withRefreshedCookies(
      NextResponse.redirect(new URL(legacy, request.url)),
      session?.refreshed,
    );
  }

  if (isPublic) {
    if (session && home && pathname === '/login') {
      return withRefreshedCookies(
        NextResponse.redirect(new URL(home, request.url)),
        session.refreshed,
      );
    }
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (hasSessionCookie && !session) clearAuthCookies(response.cookies);
    return response;
  }

  if (!session || !home) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    const response = NextResponse.redirect(url);
    if (hasSessionCookie) clearAuthCookies(response.cookies);
    return response;
  }

  const normalized = pathname.replace(/^\/portal(?=\/|$)/, '/cliente');
  const requestedPortal = portalOf(normalized);
  if (pathname === '/' || (requestedPortal && requestedPortal !== home)) {
    return withRefreshedCookies(
      NextResponse.redirect(new URL(home, request.url)),
      session.refreshed,
    );
  }

  requestHeaders.set(
    SCOPE_HEADER,
    JSON.stringify({
      userId: session.me.id,
      tenantId: session.me.tenant.id,
      role: session.me.tenant.role,
      sessionKey: session.sessionId || session.me.id,
      name: session.me.name,
      tenantName: session.me.tenant.tradeName,
      customerId: session.me.customerId,
    }),
  );

  return withRefreshedCookies(
    NextResponse.next({ request: { headers: requestHeaders } }),
    session.refreshed,
  );
}

export const config = {
  matcher: [
    '/((?!api/|drawio/|_next/|favicon.ico|icon|apple-icon|placeholder|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)',
  ],
};
