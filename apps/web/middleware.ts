import { NextRequest, NextResponse } from 'next/server';

type RefreshResult = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  role: string | null;
  tenantId: string | null;
};

type MeResult = {
  tenant: {
    role: string;
  } | null;
};

const ROLE_HOME: Record<string, '/gerencia' | '/analista' | '/cliente'> = {
  super_admin: '/gerencia',
  gerente: '/gerencia',
  analista: '/analista',
  tecnico: '/analista',
  leitura: '/analista',
  cliente: '/cliente',
};

function apiBaseUrl() {
  const raw = process.env.API_INTERNAL_URL || process.env.API_BASE_URL || 'http://localhost:8071';
  return raw.replace(/\/+$/, '');
}

function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

function applyAuthCookies(response: NextResponse, tokens: RefreshResult) {
  response.cookies.set('erp_access_token', tokens.accessToken, authCookieOptions(15 * 60));
  response.cookies.set(
    'erp_refresh_token',
    tokens.refreshToken,
    authCookieOptions(7 * 24 * 60 * 60),
  );
  response.cookies.set('erp_session_id', tokens.sessionId, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_role', tokens.role || '', authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_tenant_id', tokens.tenantId || '', authCookieOptions(7 * 24 * 60 * 60));
}

function clearAuthCookies(response: NextResponse) {
  const expired = { ...authCookieOptions(0), expires: new Date(0), maxAge: 0 };
  response.cookies.set('erp_access_token', '', expired);
  response.cookies.set('erp_refresh_token', '', expired);
  response.cookies.set('erp_session_id', '', expired);
  response.cookies.set('erp_role', '', expired);
  response.cookies.set('erp_tenant_id', '', expired);
}

function isProtectedPath(pathname: string) {
  return ['/gerencia', '/analista', '/cliente'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function roleHome(role: string | null | undefined) {
  if (!role) return null;
  return ROLE_HOME[role] || '/gerencia';
}

function roleCanAccess(pathname: string, role: string | null | undefined) {
  const home = roleHome(role);
  if (!home) return false;
  return pathname === home || pathname.startsWith(`${home}/`);
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function resolveLegacyPath(pathname: string, role: string | null | undefined) {
  const normalized = normalizePathname(pathname);
  const home = roleHome(role) || '/gerencia';

  if (
    normalized === '/dashboard' ||
    normalized === '/portal' ||
    normalized === '/portal/dashboard'
  ) {
    return home;
  }

  if (
    [
      '/tecnico',
      '/tecnicos',
      '/portal/tecnico',
      '/portal/tecnicos',
      '/portal/analista',
      '/portal/analyst',
      '/portal/noc',
    ].includes(normalized)
  ) {
    return '/analista';
  }

  if (['/portal/gerencia', '/portal/manager', '/portal/management'].includes(normalized)) {
    return '/gerencia';
  }

  if (['/portal/cliente', '/portal/customer'].includes(normalized)) {
    return '/cliente';
  }

  if (normalized.startsWith('/portal/')) {
    return home;
  }

  return null;
}

/**
 * Fast-path: decodifica o JWT localmente (sem verificar assinatura, isso é feito pela API)
 * para checar se o token ainda não expirou. Evita uma chamada HTTP ao /auth/me por request.
 * Se o token estiver expirado ou malformado, cai no fluxo de refresh normal.
 */
function jwtIsLikelyValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    if (!payload.exp) return false;
    // Considera expirado 30s antes para evitar race condition de clock
    return payload.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

async function fetchMe(accessToken: string) {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/me`, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as MeResult;
  } catch {
    return null;
  }
}

async function refreshAccess(refreshToken: string) {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as RefreshResult;
  } catch {
    return null;
  }
}

function buildLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', request.nextUrl.pathname);
  return url;
}

/** Remove header usado em bypass histórico de middleware (defesa em profundidade). */
function nextSafe(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('x-middleware-subrequest');
  return NextResponse.next({
    request: { headers },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieRole = request.cookies.get('erp_role')?.value || null;
  const legacyPath = resolveLegacyPath(pathname, cookieRole);

  if (legacyPath && legacyPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = legacyPath;
    return NextResponse.redirect(url);
  }

  const isLogin = pathname === '/login';
  const isProtected = isProtectedPath(pathname);
  if (!isLogin && !isProtected) {
    return nextSafe(request);
  }

  const accessToken = request.cookies.get('erp_access_token')?.value;
  const refreshToken = request.cookies.get('erp_refresh_token')?.value;
  let role = request.cookies.get('erp_role')?.value || null;
  let refreshed: RefreshResult | null = null;
  let authenticated = false;

  if (accessToken) {
    const me = jwtIsLikelyValid(accessToken) ? await fetchMe(accessToken) : null;
    if (me?.tenant?.role) {
      role = me.tenant.role;
      authenticated = true;
    } else if (refreshToken) {
      refreshed = await refreshAccess(refreshToken);
      if (refreshed) {
        role = refreshed.role || role;
        authenticated = true;
      }
    }
  } else if (refreshToken) {
    refreshed = await refreshAccess(refreshToken);
    if (refreshed) {
      role = refreshed.role || role;
      authenticated = true;
    }
  }

  if (!authenticated) {
    role = null;
  }

  if (isLogin) {
    if (!role) {
      const response = nextSafe(request);
      if (!accessToken && !refreshToken) clearAuthCookies(response);
      return response;
    }
    const home = roleHome(role) || '/gerencia';
    const response = NextResponse.redirect(new URL(home, request.url));
    if (refreshed) applyAuthCookies(response, refreshed);
    return response;
  }

  if (!role) {
    const response = NextResponse.redirect(buildLoginRedirect(request));
    clearAuthCookies(response);
    return response;
  }

  const home = roleHome(role) || '/gerencia';
  if (!roleCanAccess(pathname, role)) {
    const response = NextResponse.redirect(new URL(home, request.url));
    if (refreshed) applyAuthCookies(response, refreshed);
    return response;
  }

  const response = nextSafe(request);
  if (refreshed) applyAuthCookies(response, refreshed);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
