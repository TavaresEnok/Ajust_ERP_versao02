import 'server-only';

/**
 * Núcleo do BFF: sessão via cookies HttpOnly, refresh com deduplicação e chamadas ao NestJS.
 * Tokens nunca chegam ao navegador; o tenant efetivo sempre vem do JWT.
 */

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: string;
  tradeName?: string;
};

export type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: ApiUser;
};

export type TwoFactorChallengeResponse = {
  accessToken: null;
  refreshToken: null;
  sessionId: string;
  twoFactorRequired: true;
  temporaryToken: string;
  user: ApiUser;
};

export type RefreshApiResponse = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tenantId: string | null;
  role: string | null;
};

export type ApiMeResponse = {
  id: string;
  name: string;
  email: string;
  twoFactorEnabled?: boolean;
  tenant: { id: string; tradeName: string; role: string } | null;
};

export type CookieReader = { get(name: string): { value: string } | undefined };

export type CookieWriter = {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
};

export const ACCESS_COOKIE = 'erp_access_token';
export const REFRESH_COOKIE = 'erp_refresh_token';
export const SESSION_COOKIE = 'erp_session_id';
export const ROLE_COOKIE = 'erp_role';
export const TENANT_COOKIE = 'erp_tenant_id';
const AUTH_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, ROLE_COOKIE, TENANT_COOKIE];

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export const ROLE_HOME: Record<string, '/gerencia' | '/analista' | '/cliente'> = {
  super_admin: '/gerencia',
  gerente: '/gerencia',
  analista: '/analista',
  tecnico: '/analista',
  leitura: '/cliente',
  cliente: '/cliente',
};

export function roleHome(role: string | null | undefined) {
  return role ? ROLE_HOME[role] || null : null;
}

export function apiBaseUrl() {
  const raw = process.env.API_INTERNAL_URL || process.env.API_BASE_URL || 'http://localhost:8071';
  return raw.replace(/\/+$/, '');
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function applyAuthCookies(
  cookies: CookieWriter,
  payload: LoginApiResponse | RefreshApiResponse,
) {
  const role = 'user' in payload ? payload.user.role : payload.role || '';
  const tenantId = 'user' in payload ? payload.user.tenantId : payload.tenantId || '';
  cookies.set(ACCESS_COOKIE, payload.accessToken, cookieOptions(ACCESS_MAX_AGE));
  cookies.set(REFRESH_COOKIE, payload.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  cookies.set(SESSION_COOKIE, payload.sessionId, cookieOptions(REFRESH_MAX_AGE));
  cookies.set(ROLE_COOKIE, role, cookieOptions(REFRESH_MAX_AGE));
  cookies.set(TENANT_COOKIE, tenantId, cookieOptions(REFRESH_MAX_AGE));
}

export function clearAuthCookies(cookies: CookieWriter) {
  for (const name of AUTH_COOKIES) {
    cookies.set(name, '', { ...cookieOptions(0), expires: new Date(0) });
  }
}

/** Decodifica o exp do JWT sem validar assinatura (a API valida); evita /auth/me com token vencido. */
export function jwtIsLikelyValid(token: string | undefined): token is string {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      exp?: number;
    };
    return !!data.exp && data.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

export async function fetchMe(accessToken: string): Promise<ApiMeResponse | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiMeResponse;
  } catch {
    return null;
  }
}

/**
 * O NestJS rotaciona o refresh token a cada uso: duas renovações concorrentes com o mesmo token
 * derrubariam a sessão. Requisições paralelas compartilham a mesma promessa por alguns segundos.
 */
const inflightRefresh = new Map<string, Promise<RefreshApiResponse | null>>();

export function refreshSession(refreshToken: string): Promise<RefreshApiResponse | null> {
  const pending = inflightRefresh.get(refreshToken);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!response.ok) return null;
      return (await response.json()) as RefreshApiResponse;
    } catch {
      return null;
    }
  })();
  inflightRefresh.set(refreshToken, promise);
  setTimeout(() => inflightRefresh.delete(refreshToken), 15_000);
  return promise;
}

export type ResolvedSession = {
  accessToken: string;
  me: ApiMeResponse & { tenant: NonNullable<ApiMeResponse['tenant']> };
  sessionId: string;
  refreshed: RefreshApiResponse | null;
};

export async function resolveSession(cookies: CookieReader): Promise<ResolvedSession | null> {
  let accessToken = cookies.get(ACCESS_COOKIE)?.value || '';
  const refreshToken = cookies.get(REFRESH_COOKIE)?.value || '';
  let sessionId = cookies.get(SESSION_COOKIE)?.value || '';
  let refreshed: RefreshApiResponse | null = null;
  let me: ApiMeResponse | null = null;

  if (jwtIsLikelyValid(accessToken)) me = await fetchMe(accessToken);

  if (!me && refreshToken) {
    refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      sessionId = refreshed.sessionId;
      me = await fetchMe(accessToken);
    }
  }

  if (!me?.tenant?.id || !accessToken) return null;
  return { accessToken, me: me as ResolvedSession['me'], sessionId, refreshed };
}

/** Repassa ao navegador a mensagem do NestJS sem vazar stack ou detalhes internos. */
export function upstreamErrorMessage(text: string, fallback: string) {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { message?: unknown; error?: unknown; issues?: unknown };
    // Erros de validação (Zod) trazem os campos rejeitados em `issues`.
    if (Array.isArray(data.issues) && data.issues.length) {
      const details = data.issues
        .slice(0, 5)
        .map((issue: { path?: unknown; message?: unknown }) =>
          [issue.path, issue.message].filter((part) => typeof part === 'string' && part).join(': '),
        )
        .filter(Boolean)
        .join('; ');
      if (details) return `Dados inválidos — ${details}`.slice(0, 500);
    }
    const message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    if (typeof message === 'string' && message.length <= 500) return message;
    if (typeof data.error === 'string' && data.error.length <= 500) return data.error;
  } catch {
    if (text.length <= 300 && !text.includes('<')) return text;
  }
  return fallback;
}
