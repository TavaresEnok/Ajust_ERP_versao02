import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, clearAuthCookies } from '../_lib';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('erp_access_token')?.value;
  const sessionId = request.cookies.get('erp_session_id')?.value;

  try {
    if (accessToken) {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
        cache: 'no-store',
      });
    }
  } catch {
    // Cookie cleanup still happens even when backend logout fails.
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
