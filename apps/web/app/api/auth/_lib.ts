import { NextResponse } from 'next/server';

export type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    role: string;
  };
};

export type RefreshApiResponse = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tenantId: string | null;
  role: string | null;
};

export function apiBaseUrl() {
  const raw = process.env.API_INTERNAL_URL || process.env.API_BASE_URL || 'http://localhost:8071';
  return raw.replace(/\/+$/, '');
}

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds
  };
}

export function applyLoginCookies(response: NextResponse, payload: LoginApiResponse | RefreshApiResponse) {
  const role = 'user' in payload ? payload.user.role : payload.role || '';
  const tenantId = 'user' in payload ? payload.user.tenantId : payload.tenantId || '';
  response.cookies.set('erp_access_token', payload.accessToken, authCookieOptions(15 * 60));
  response.cookies.set('erp_refresh_token', payload.refreshToken, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_session_id', payload.sessionId, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_role', role, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_tenant_id', tenantId, authCookieOptions(7 * 24 * 60 * 60));
}

export function clearAuthCookies(response: NextResponse) {
  const expired = { ...authCookieOptions(0), expires: new Date(0), maxAge: 0 };
  response.cookies.set('erp_access_token', '', expired);
  response.cookies.set('erp_refresh_token', '', expired);
  response.cookies.set('erp_session_id', '', expired);
  response.cookies.set('erp_role', '', expired);
  response.cookies.set('erp_tenant_id', '', expired);
}
