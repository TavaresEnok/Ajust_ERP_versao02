import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, applyLoginCookies, LoginApiResponse } from '../_lib';

type LoginInput = {
  login?: string;
  username?: string;
  cnpj?: string;
  email?: string;
  identifier?: string;
  password?: string;
  tenantId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginInput;
    const identifier = body.identifier || body.login || body.username || body.email || body.cnpj || '';

    const payload = {
      identifier: String(identifier).trim(),
      password: String(body.password || ''),
      ...(body.tenantId ? { tenantId: String(body.tenantId).trim() } : {})
    };

    if (!payload.identifier || !payload.password) {
      return NextResponse.json({ error: 'E-mail, usuário ou CNPJ e senha são obrigatórios.' }, { status: 400 });
    }

    const loginResponse = await fetch(`${apiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'user-agent': request.headers.get('user-agent') || 'web-app'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    if (!loginResponse.ok) {
      const message = await loginResponse.text();
      return NextResponse.json({ error: message || 'Falha no login.' }, { status: loginResponse.status });
    }

    const login = (await loginResponse.json()) as LoginApiResponse;
    const response = NextResponse.json({
      ok: true,
      user: login.user
    });
    applyLoginCookies(response, login);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada no login.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
