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
    tradeName?: string;
  };
};

export type TwoFactorChallengeResponse = {
  accessToken: null;
  refreshToken: null;
  sessionId: string;
  twoFactorRequired: true;
  temporaryToken: string;
  user: LoginApiResponse['user'];
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
    maxAge: maxAgeSeconds,
  };
}

export function applyLoginCookies(
  response: NextResponse,
  payload: LoginApiResponse | RefreshApiResponse,
) {
  const role = 'user' in payload ? payload.user.role : payload.role || '';
  const tenantId = 'user' in payload ? payload.user.tenantId : payload.tenantId || '';
  const userId = 'user' in payload ? payload.user.id : '';
  const userName = 'user' in payload ? encodeURIComponent(payload.user.name || '') : '';
  const userEmail = 'user' in payload ? encodeURIComponent(payload.user.email || '') : '';
  const tradeName =
    'user' in payload && payload.user.tradeName ? encodeURIComponent(payload.user.tradeName) : '';

  response.cookies.set('erp_access_token', payload.accessToken, authCookieOptions(15 * 60));
  response.cookies.set(
    'erp_refresh_token',
    payload.refreshToken,
    authCookieOptions(7 * 24 * 60 * 60),
  );
  response.cookies.set('erp_session_id', payload.sessionId, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_role', role, authCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set('erp_tenant_id', tenantId, authCookieOptions(7 * 24 * 60 * 60));

  if (userId) response.cookies.set('erp_user_id', userId, authCookieOptions(7 * 24 * 60 * 60));
  if (userName)
    response.cookies.set('erp_user_name', userName, authCookieOptions(7 * 24 * 60 * 60));
  if (userEmail)
    response.cookies.set('erp_user_email', userEmail, authCookieOptions(7 * 24 * 60 * 60));
  if (tradeName)
    response.cookies.set('erp_trade_name', tradeName, authCookieOptions(7 * 24 * 60 * 60));
}

export function clearAuthCookies(response: NextResponse) {
  const expired = { ...authCookieOptions(0), expires: new Date(0), maxAge: 0 };
  response.cookies.set('erp_access_token', '', expired);
  response.cookies.set('erp_refresh_token', '', expired);
  response.cookies.set('erp_session_id', '', expired);
  response.cookies.set('erp_role', '', expired);
  response.cookies.set('erp_tenant_id', '', expired);
  response.cookies.set('erp_user_id', '', expired);
  response.cookies.set('erp_user_name', '', expired);
  response.cookies.set('erp_user_email', '', expired);
  response.cookies.set('erp_trade_name', '', expired);
}
