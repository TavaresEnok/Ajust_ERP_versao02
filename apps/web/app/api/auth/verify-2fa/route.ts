import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, applyLoginCookies, LoginApiResponse } from '../_lib';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiResponse = await fetch(`${apiBaseUrl()}/auth/verify-2fa`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': request.headers.get('user-agent') || 'web-app',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await apiResponse.text();
    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: text || 'Falha ao validar o código.' },
        { status: apiResponse.status },
      );
    }

    const login = JSON.parse(text) as LoginApiResponse;
    const response = NextResponse.json({ ok: true, user: login.user });
    applyLoginCookies(response, login);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha inesperada ao validar o código.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
