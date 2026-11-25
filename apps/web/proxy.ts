import { NextRequest, NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
  hasValidSession,
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
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/privacidade-extensao'];

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

function buildCspHeader(nonce: string, request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(!isDev && isHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  // O escopo só pode vir deste proxy; nunca do cliente.
  requestHeaders.delete(SCOPE_HEADER);
  requestHeaders.delete('x-middleware-subrequest');
  requestHeaders.delete('x-nonce');

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce, request);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // O editor Draw.io roda na mesma origem do ERP: só abre com sessão válida, para não
  // expor o Tomcat/servlets do drawio a quem não está logado. Mantém o CSP próprio dele
  // (next.config.mjs), por isso não recebe o CSP com nonce das páginas.
  const isDrawio = pathname.startsWith('/drawio/');

  const passthrough = () => {
    const headers = new Headers(request.headers);
    headers.delete(SCOPE_HEADER);
    headers.delete('x-middleware-subrequest');
    headers.delete('x-nonce');
    return NextResponse.next({ request: { headers } });
  };
  if (isDrawio) {
    try {
      if (await hasValidSession(request.cookies)) return passthrough();
    } catch {
      // API fora: segue para o fluxo completo, que responde 503
    }
  }

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

  if (isDrawio) {
    if (!session || !home) {
      return new NextResponse('Sessão necessária.', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return withRefreshedCookies(passthrough(), session.refreshed);
  }

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
    response.headers.set('Content-Security-Policy', cspHeader);
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

  if (role === 'analista' && normalized === '/analista/sla') {
    return withRefreshedCookies(
      NextResponse.redirect(new URL('/analista/ordens?deadline=overdue', request.url)),
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return withRefreshedCookies(response, session.refreshed);
}

export const config = {
  matcher: [
    // Só os arquivos públicos conhecidos (ícones e placeholders na raiz) passam direto.
    // Não liberar por extensão: /gerencia/ordens/1.png casaria com a rota [...slug] e
    // renderizaria a página sem o proxy (sem CSP e com os headers internos vindos do cliente).
    '/((?!api/|_next/|favicon\\.ico$|icon|apple-icon|placeholder).*)',
  ],
};
