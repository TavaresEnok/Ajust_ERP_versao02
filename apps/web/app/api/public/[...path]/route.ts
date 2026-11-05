import { NextRequest, NextResponse } from 'next/server';
import { isCrossOriginMutation, json } from '@/lib/bff/forward';
import {
  apiBaseUrl,
  applyAuthCookies,
  roleHome,
  upstreamErrorMessage,
  type LoginApiResponse,
  type TwoFactorChallengeResponse,
} from '@/lib/bff/server';

export const dynamic = 'force-dynamic';

/**
 * BFF público (sem sessão): autenticação e pesquisa CSAT por token.
 * Tokens emitidos pelo NestJS viram cookies HttpOnly; o navegador recebe apenas BffAuthResult.
 */
type Context = { params: Promise<{ path: string[] }> };
type Body = Record<string, unknown>;

const TOKEN = /^[A-Za-z0-9_-]{8,256}$/;

async function callApi(request: NextRequest, path: string, method: 'GET' | 'POST', body?: Body) {
  const headers: Record<string, string> = {
    'user-agent': request.headers.get('user-agent') || 'ajust-web',
  };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  if (body) headers['content-type'] = 'application/json';
  return fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
}

async function readBody(request: NextRequest): Promise<Body> {
  const data = (await request.json().catch(() => ({}))) as unknown;
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Body) : {};
}

async function failure(upstream: Response, fallback: string) {
  const text = await upstream.text().catch(() => '');
  const status = upstream.status >= 500 ? 502 : upstream.status;
  return json(status, upstream.status >= 500 ? fallback : upstreamErrorMessage(text, fallback));
}

/** Destino pós-login: o `next` solicitado apenas se pertencer ao portal do perfil. */
function redirectFor(role: string, next: unknown) {
  const home = roleHome(role) || '/cliente';
  if (
    typeof next === 'string' &&
    next.startsWith(home) &&
    (next === home || next.charAt(home.length) === '/' || next.charAt(home.length) === '?') &&
    !next.includes('//') &&
    !next.split(/[/?]/).includes('..')
  )
    return next;
  return home;
}

function authenticated(login: LoginApiResponse, next: unknown) {
  const response = NextResponse.json({
    authenticated: true,
    redirectTo: login.twoFactorSetupRequired
      ? `${roleHome(login.user.role) || '/cliente'}/seguranca/2fa`
      : redirectFor(login.user.role, next),
  });
  applyAuthCookies(response.cookies, login);
  return response;
}

async function login(request: NextRequest) {
  const body = await readBody(request);
  const identifier = String(body.identifier ?? '').trim();
  const password = String(body.password ?? '');
  if (!identifier || !password) return json(400, 'Informe e-mail ou CNPJ e a senha.');
  const upstream = await callApi(request, '/auth/login', 'POST', {
    identifier,
    password,
    ...(typeof body.email === 'string' ? { email: body.email } : {}),
    ...(typeof body.bootstrapToken === 'string' ? { bootstrapToken: body.bootstrapToken } : {}),
  });
  if (upstream.status === 401) return json(400, 'E-mail, CNPJ ou senha inválidos.');
  if (!upstream.ok) return failure(upstream, 'Não foi possível entrar agora.');
  const result = (await upstream.json()) as LoginApiResponse | TwoFactorChallengeResponse;
  if ('twoFactorRequired' in result && result.twoFactorRequired) {
    return NextResponse.json({ twoFactorRequired: true, temporaryToken: result.temporaryToken });
  }
  return authenticated(result as LoginApiResponse, body.next);
}

async function verifyTwoFactor(request: NextRequest) {
  const body = await readBody(request);
  const upstream = await callApi(request, '/auth/verify-2fa', 'POST', {
    temporaryToken: String(body.temporaryToken ?? ''),
    code: String(body.code ?? ''),
  });
  if (upstream.status === 401) return json(400, 'Código inválido ou expirado. Entre novamente.');
  if (!upstream.ok) return failure(upstream, 'Não foi possível validar o código.');
  return authenticated((await upstream.json()) as LoginApiResponse, body.next);
}

async function passthrough(request: NextRequest, path: string, fields: string[]) {
  const body = await readBody(request);
  const payload = Object.fromEntries(
    fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]),
  );
  const upstream = await callApi(request, path, 'POST', payload);
  if (!upstream.ok) return failure(upstream, 'Não foi possível concluir a solicitação.');
  const text = await upstream.text();
  return NextResponse.json(text ? JSON.parse(text) : { success: true });
}

async function handle(request: NextRequest, context: Context) {
  if (isCrossOriginMutation(request)) return json(403, 'Origem não autorizada.');
  const { path } = await context.params;
  const route = path.join('/');
  const method = request.method;

  try {
    if (method === 'POST') {
      switch (route) {
        case 'auth/login':
          return await login(request);
        case 'auth/verify-2fa':
          return await verifyTwoFactor(request);
        case 'auth/forgot-password':
          return await passthrough(request, '/auth/forgot-password', ['email']);
        case 'auth/reset-password':
          return await passthrough(request, '/auth/reset-password', ['token', 'newPassword']);
        case 'auth/bootstrap/request-otp':
          return await passthrough(request, '/auth/bootstrap/request-otp', ['cnpj', 'email']);
        case 'auth/bootstrap/validate-otp':
          // Devolve o bootstrapToken uma única vez para o login imediato; nunca é persistido.
          return await passthrough(request, '/auth/bootstrap/validate-otp', [
            'cnpj',
            'email',
            'otp',
            'newPassword',
          ]);
      }
    }

    if (path[0] === 'csat' && path[1] === 'survey' && TOKEN.test(path[2] || '')) {
      const token = encodeURIComponent(path[2]);
      if (method === 'GET' && path.length === 3) {
        const upstream = await callApi(request, `/csat/survey/${token}`, 'GET');
        if (!upstream.ok) return failure(upstream, 'Pesquisa indisponível.');
        return NextResponse.json(await upstream.json());
      }
      if (method === 'POST' && path.length === 4 && path[3] === 'answer') {
        return await passthrough(request, `/csat/survey/${token}/answer`, ['score', 'comment']);
      }
    }
  } catch {
    return json(502, 'O ERP está indisponível no momento. Tente novamente em instantes.');
  }

  return json(404, 'Recurso não encontrado.');
}

export const GET = handle;
export const POST = handle;
