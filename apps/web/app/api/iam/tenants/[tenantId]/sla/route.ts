import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../auth/_lib';
import { resolveAuthSession, applyRefreshIfNeeded } from '../../../../_proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const result = await resolveAuthSession(request);
  if (result instanceof NextResponse) return result;

  const { tenantId } = await params;
  const res = await fetch(`${apiBaseUrl()}/iam/tenants/${tenantId}/sla`, {
    headers: {
      'Authorization': `Bearer ${result.accessToken}`,
      'content-type': 'application/json'
    },
    cache: 'no-store'
  });

  const data = await res.text();
  const response = NextResponse.json(data ? JSON.parse(data) : [], { status: res.status });
  return applyRefreshIfNeeded(response, result.refreshPayload);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const result = await resolveAuthSession(request);
  if (result instanceof NextResponse) return result;

  const { tenantId } = await params;
  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${apiBaseUrl()}/iam/tenants/${tenantId}/sla`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${result.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const data = await res.text();
  const response = NextResponse.json(data ? JSON.parse(data) : {}, { status: res.status });
  return applyRefreshIfNeeded(response, result.refreshPayload);
}
