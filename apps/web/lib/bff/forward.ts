import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { matchAllowedRoute } from './allowlist';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  apiBaseUrl,
  applyAuthCookies,
  clearAuthCookies,
  jwtIsLikelyValid,
  refreshSession,
  upstreamErrorMessage,
  type RefreshApiResponse,
} from './server';

/**
 * Limites de corpo aceitos pelo BFF; o NestJS aplica os seus por rota (anexos: 10 arquivos de
 * 10 MB; logo: 5 MB). Multipart é lido em memória, por isso o teto acompanha o maior caso real.
 */
export const MAX_MULTIPART_BYTES = 101 * 1024 * 1024;
export const MAX_JSON_BYTES = 2 * 1024 * 1024;

const FORWARD_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'if-match',
  'if-none-match',
  'user-agent',
];
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'etag',
  'cache-control',
  'last-modified',
  'x-export-rows',
  'x-export-truncated',
  'x-trace-id',
  'x-request-id',
];

export function json(status: number, message: string) {
  return NextResponse.json(
    { message, statusCode: status },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/** Mutação de outra origem é recusada (defesa em profundidade além do SameSite=Lax). */
export function isCrossOriginMutation(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function accessTokenFor(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (jwtIsLikelyValid(accessToken)) return { accessToken, refreshed: null };
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const refreshed = await refreshSession(refreshToken);
  return refreshed ? { accessToken: refreshed.accessToken, refreshed } : null;
}

/** Campos internos do servidor que nunca devem chegar ao navegador. */
const SERVER_ONLY_KEYS = new Set([
  'storageKey',
  'passwordHash',
  'refreshTokenHash',
  'bootstrapTokenHash',
  'twoFactorSecret',
  'otpHash',
  'tokenHash',
  'keyHash',
  'twoFactorSecretEnc',
  'secretEnc',
  'sourceNoteEnc',
  'webhookSecretEnc',
  'apiTokenEnc',
]);

export function redactServerFields(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactServerFields(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!SERVER_ONLY_KEYS.has(key)) result[key] = redactServerFields(item, depth + 1);
  }
  return result;
}

/** Rotas cujo controller valida um tenant-alvo no corpo (TenantIsolationGuard.bodyTenantIdAllowed). */
const BODY_TENANT_ALLOWED = new Set(['POST /iam/users']);

function stripTenantId(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { tenantId: _ignored, ...rest } = value as Record<string, unknown>;
  return rest;
}

async function buildBody(
  request: NextRequest,
  pattern: string,
): Promise<BodyInit | undefined | NextResponse> {
  if (request.method === 'GET' || request.method === 'DELETE') return undefined;
  const length = Number(request.headers.get('content-length') || 0);
  const type = request.headers.get('content-type') || '';
  const multipart = type.includes('multipart/form-data');
  if (length > (multipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES))
    return json(413, 'Arquivo ou conteúdo acima do limite permitido.');
  if (multipart) {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > MAX_MULTIPART_BYTES)
      return json(413, 'Arquivo ou conteúdo acima do limite permitido.');
    return buffer;
  }
  const text = await request.text();
  if (!text) return undefined;
  if (text.length > MAX_JSON_BYTES) return json(413, 'Conteúdo acima do limite permitido.');
  try {
    // O NestJS rejeita tenantId vindo do cliente: o tenant efetivo é o do JWT.
    const parsed = JSON.parse(text) as unknown;
    return JSON.stringify(
      BODY_TENANT_ALLOWED.has(`${request.method} ${pattern}`) ? parsed : stripTenantId(parsed),
    );
  } catch {
    return json(400, 'Corpo da requisição inválido.');
  }
}

type Hooks = {
  /** Ajusta respostas JSON bem-sucedidas de rotas específicas (chave = padrão da allowlist). */
  transforms?: Record<string, (data: unknown, request: NextRequest) => unknown>;
  /** Rotas que encerram a sessão atual quando concluídas com sucesso. */
  clearsSession?: (pattern: string) => boolean;
};

export async function forwardToApi(request: NextRequest, segments: string[], hooks: Hooks = {}) {
  if (isCrossOriginMutation(request)) return json(403, 'Origem não autorizada.');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..'))
    return json(404, 'Recurso não encontrado.');

  const path = '/' + segments.join('/');
  const match = matchAllowedRoute(request.method, path);
  if (!match.allowed)
    return json(
      match.status,
      match.status === 404 ? 'Recurso não encontrado.' : 'Método não permitido.',
    );

  let auth: Awaited<ReturnType<typeof accessTokenFor>>;
  try {
    auth = await accessTokenFor(request);
  } catch {
    return json(503, 'ERP temporariamente indisponível. Sua sessão foi preservada.');
  }
  if (!auth) {
    const response = json(401, 'Sessão expirada.');
    clearAuthCookies(response.cookies);
    return response;
  }

  const body = await buildBody(request, match.pattern);
  if (body instanceof NextResponse) return body;

  const search = new URLSearchParams(request.nextUrl.searchParams);
  search.delete('tenantId');
  const query = search.size ? `?${search}` : '';
  const upstreamPath = segments.map(encodeURIComponent).join('/');

  const headers = new Headers({ authorization: `Bearer ${auth.accessToken}` });
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (typeof body === 'string') headers.set('content-type', 'application/json');
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/${upstreamPath}${query}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return json(502, 'O ERP está indisponível no momento. Tente novamente em instantes.');
  }

  const response = await toClientResponse(upstream, match.pattern, request, hooks);
  if (upstream.status === 401) {
    clearAuthCookies(response.cookies);
  } else if (upstream.ok && hooks.clearsSession?.(match.pattern)) {
    clearAuthCookies(response.cookies);
  } else if (auth.refreshed) {
    applyAuthCookies(response.cookies, auth.refreshed as RefreshApiResponse);
  }
  return response;
}

async function toClientResponse(
  upstream: Response,
  pattern: string,
  request: NextRequest,
  hooks: Hooks,
): Promise<NextResponse> {
  const type = upstream.headers.get('content-type') || '';

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    // Empresa sem logo é um estado normal, não um erro da interface.
    if (pattern === '/iam/tenants/:id/logo' && request.method === 'GET' && upstream.status < 500)
      return new NextResponse(null, { status: 204 });
    const fallback =
      upstream.status === 401
        ? 'Sessão expirada.'
        : upstream.status === 403
          ? 'Seu perfil não tem permissão para esta operação.'
          : upstream.status === 404
            ? 'Registro não encontrado.'
            : 'O ERP recusou a operação.';
    const message = upstream.status >= 500 ? fallback : upstreamErrorMessage(text, fallback);
    return json(upstream.status, message);
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }

  const transform = hooks.transforms?.[pattern];
  if (type.includes('application/json')) {
    const text = await upstream.text();
    if (!text) return new NextResponse(null, { status: upstream.status });
    const data = redactServerFields(JSON.parse(text) as unknown);
    const response = NextResponse.json(transform ? transform(data, request) : data, {
      status: upstream.status,
    });
    const etag = upstream.headers.get('etag');
    if (etag) response.headers.set('etag', etag);
    response.headers.set('cache-control', 'no-store');
    return response;
  }

  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', 'no-store');
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
