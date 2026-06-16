import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../app/api/auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../app/api/_proxy';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from './strip-tenant-upstream';

interface BffConfig {
  apiPath: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  parseBody?: boolean;
}

export async function bffProxy(req: NextRequest, config: BffConfig): Promise<NextResponse> {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;

  const method = config.method || req.method;
  const searchParams = omitTenantIdFromSearchParams(req.nextUrl.searchParams);
  const qs = searchParams.toString();

  let body: string | undefined;
  if (config.parseBody && method !== 'GET') {
    try {
      const raw = await req.json();
      body = JSON.stringify(omitTenantIdFromBody(raw));
    } catch {
      body = undefined;
    }
  }

  const res = await fetch(`${apiBaseUrl()}${config.apiPath}${qs ? '?' + qs : ''}`, {
    method,
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: method !== 'GET' ? body : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(
    NextResponse.json(text ? JSON.parse(text) : {}),
    session.refreshPayload,
  );
}
