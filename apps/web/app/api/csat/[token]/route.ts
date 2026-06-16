import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const response = await fetch(`${apiBaseUrl()}/csat/survey/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return NextResponse.json(payload, { status: response.status });
}
