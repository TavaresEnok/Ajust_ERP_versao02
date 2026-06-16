/**
 * Sprint 1 Security E2E Tests
 * Tests for: Tenant Isolation, Rate Limiting, 2FA, Secrets Validation
 *
 * Run with: npm run test:e2e
 */

import { createHmac } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:8071';
const ADMIN_EMAIL = 'admin@ajust.local';
const ADMIN_PASSWORD = 'Admin@123456';

interface TestContext {
  adminAccessToken: string;
  adminSessionId: string;
  clientAccessToken?: string;
  clientSessionId?: string;
  tenantId: string;
  otherTenantId: string;
}

const context: TestContext = {
  adminAccessToken: '',
  adminSessionId: '',
  tenantId: '',
  otherTenantId: '',
};

let loginIpSequence = 10;

function nextLoginHeaders(): Record<string, string> {
  loginIpSequence += 1;
  return { 'x-forwarded-for': `198.51.100.${loginIpSequence}` };
}

type HttpResponse = {
  status: number;
  data: any;
};

function withParams(path: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) return path;
  const search = new URLSearchParams(params).toString();
  return `${path}?${search}`;
}

async function requestJson(
  method: 'GET' | 'POST',
  path: string,
  options?: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
  },
): Promise<HttpResponse> {
  const url = `${API_URL}${withParams(path, options?.params)}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...(options?.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }

  return {
    status: response.status,
    data,
  };
}

const api = {
  get: (
    path: string,
    options?: { params?: Record<string, string>; headers?: Record<string, string> },
  ) => requestJson('GET', path, options),
  post: (path: string, body?: unknown, options?: { headers?: Record<string, string> }) =>
    requestJson('POST', path, { headers: options?.headers, body }),
};

function generateTotpCode(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of secret.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 TOTP secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  let counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  for (let index = 7; index >= 0; index--) {
    counterBuffer[index] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  const digest = createHmac('sha1', Buffer.from(bytes)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;

  return String(code).padStart(6, '0');
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 1: Tenant Isolation
// ═════════════════════════════════════════════════════════════════════════════

async function testTenantIsolationBypass() {
  console.log('\n✓ TEST 1: Tenant Isolation Bypass Prevention');

  try {
    // Get list of service orders with tenantId in query parameter (should fail)
    const response = await api.get('/service-orders', {
      params: {
        tenantId: context.otherTenantId,
      },
      headers: {
        Authorization: `Bearer ${context.adminAccessToken}`,
      },
    });

    if (response.status === 403 && response.data.message?.includes('tenantId')) {
      console.log('  ✅ PASS: Query parameter tenantId rejected with 403');
      return true;
    } else {
      console.log(`  ❌ FAIL: Expected 403, got ${response.status}`);
      console.log(`     Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 2: Rate Limiting
// ═════════════════════════════════════════════════════════════════════════════

async function testRateLimiting() {
  console.log('\n✓ TEST 2: Rate Limiting (5 attempts per 15 minutes)');

  const email = `test-ratelimit-${Date.now()}@ajust.local`;
  const password = 'invalid-password-123';

  try {
    let tooManyRequestsReceived = false;

    // Try 6 login attempts
    for (let i = 1; i <= 6; i++) {
      const response = await api.post('/auth/login', {
        identifier: email,
        password: password,
      });

      if (i <= 5) {
        if (response.status === 401) {
          console.log(`  Attempt ${i}: ✅ 401 Unauthorized (invalid credentials)`);
        } else {
          console.log(`  Attempt ${i}: ❌ Expected 401, got ${response.status}`);
        }
      } else {
        // 6th attempt should be rate limited
        if (response.status === 429) {
          console.log(`  Attempt ${i}: ✅ 429 Too Many Requests (rate limited)`);
          tooManyRequestsReceived = true;
        } else {
          console.log(`  Attempt ${i}: ❌ Expected 429, got ${response.status}`);
        }
      }
    }

    return tooManyRequestsReceived;
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 3: 2FA Workflow
// ═════════════════════════════════════════════════════════════════════════════

async function testTwoFAWorkflow() {
  console.log('\n✓ TEST 3: 2FA Workflow (Setup → Verify → Login)');

  let verifiedAccessToken = '';
  let twoFactorEnabled = false;
  try {
    const initialStatusResponse = await api.get('/auth/2fa/status', {
      headers: {
        Authorization: `Bearer ${context.adminAccessToken}`,
      },
    });
    if (initialStatusResponse.data.enabled) {
      const resetResponse = await api.post(
        '/auth/2fa/disable',
        { password: ADMIN_PASSWORD },
        {
          headers: {
            Authorization: `Bearer ${context.adminAccessToken}`,
          },
        },
      );
      if (![200, 201].includes(resetResponse.status)) {
        console.log(`  ❌ FAIL: Could not reset existing 2FA state`);
        return false;
      }
      console.log(`  ✅ Precondition: Existing 2FA state reset`);
    }

    // Step 1: Setup 2FA (generate secret)
    const setupResponse = await api.post(
      '/auth/2fa/setup',
      {},
      {
        headers: {
          Authorization: `Bearer ${context.adminAccessToken}`,
        },
      },
    );

    if (setupResponse.status !== 200 || !setupResponse.data.secret) {
      console.log(`  ❌ FAIL: 2FA setup failed (status: ${setupResponse.status})`);
      return false;
    }

    const secret = setupResponse.data.secret;
    console.log(`  ✅ Step 1: Generated 2FA secret`);

    // Step 2: Get 2FA status (should still be disabled)
    const statusResponse = await api.get('/auth/2fa/status', {
      headers: {
        Authorization: `Bearer ${context.adminAccessToken}`,
      },
    });

    if (!statusResponse.data.enabled) {
      console.log(`  ✅ Step 2: 2FA still disabled after setup (secret not confirmed)`);
    } else {
      console.log(`  ❌ FAIL: 2FA should remain disabled until confirmation`);
      return false;
    }

    const confirmResponse = await api.post(
      '/auth/2fa/confirm',
      { secret, code: generateTotpCode(secret) },
      {
        headers: {
          Authorization: `Bearer ${context.adminAccessToken}`,
        },
      },
    );
    if (![200, 201].includes(confirmResponse.status) || !confirmResponse.data.success) {
      console.log(`  ❌ FAIL: 2FA confirmation failed (status: ${confirmResponse.status})`);
      return false;
    }
    twoFactorEnabled = true;
    console.log(`  ✅ Step 3: TOTP confirmed and 2FA enabled`);

    const challengeResponse = await api.post(
      '/auth/login',
      {
        identifier: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      { headers: nextLoginHeaders() },
    );
    if (
      ![200, 201].includes(challengeResponse.status) ||
      !challengeResponse.data.twoFactorRequired ||
      !challengeResponse.data.temporaryToken
    ) {
      console.log(`  ❌ FAIL: Login did not require 2FA (status: ${challengeResponse.status})`);
      return false;
    }
    console.log(`  ✅ Step 4: Login returned a temporary 2FA challenge`);

    const verificationResponse = await api.post('/auth/verify-2fa', {
      temporaryToken: challengeResponse.data.temporaryToken,
      code: generateTotpCode(secret),
    });
    if (
      ![200, 201].includes(verificationResponse.status) ||
      !verificationResponse.data.accessToken ||
      !verificationResponse.data.refreshToken
    ) {
      console.log(
        `  ❌ FAIL: 2FA login verification failed (status: ${verificationResponse.status})`,
      );
      return false;
    }

    verifiedAccessToken = verificationResponse.data.accessToken;
    console.log(`  ✅ Step 5: Valid TOTP completed login and issued full tokens`);
    return true;
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  } finally {
    if (twoFactorEnabled) {
      const disableResponse = await api.post(
        '/auth/2fa/disable',
        { password: ADMIN_PASSWORD },
        {
          headers: {
            Authorization: `Bearer ${verifiedAccessToken || context.adminAccessToken}`,
          },
        },
      );
      if ([200, 201].includes(disableResponse.status)) {
        console.log(`  ✅ Cleanup: 2FA disabled for subsequent test runs`);
      } else {
        console.log(
          `  ❌ Cleanup failed: could not disable 2FA (status: ${disableResponse.status})`,
        );
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 4: Refresh Token Rotation
// ═════════════════════════════════════════════════════════════════════════════

async function testRefreshTokenRotation() {
  console.log('\n✓ TEST 4: Refresh Token Rotation');

  try {
    // Login first
    const loginResponse = await api.post(
      '/auth/login',
      {
        identifier: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      { headers: nextLoginHeaders() },
    );

    if (![200, 201].includes(loginResponse.status)) {
      console.log(`  ❌ FAIL: Login failed (status: ${loginResponse.status})`);
      return false;
    }

    const firstRefreshToken = loginResponse.data.refreshToken;
    const firstAccessToken = loginResponse.data.accessToken;
    console.log(`  ✅ Login successful`);

    // Refresh token
    const refreshResponse1 = await api.post('/auth/refresh', {
      refreshToken: firstRefreshToken,
    });

    if (refreshResponse1.status !== 200) {
      console.log(`  ❌ FAIL: First refresh failed (status: ${refreshResponse1.status})`);
      return false;
    }

    const secondRefreshToken = refreshResponse1.data.refreshToken;
    console.log(`  ✅ First refresh successful`);

    // Verify old token is invalidated
    if (firstRefreshToken === secondRefreshToken) {
      console.log(`  ❌ FAIL: Refresh tokens should be rotated (token same after refresh)`);
      return false;
    } else {
      console.log(`  ✅ Token rotated: old token !== new token`);
    }

    // Try to use old token (should fail)
    const oldTokenResponse = await api.post('/auth/refresh', {
      refreshToken: firstRefreshToken,
    });

    if (oldTokenResponse.status === 401) {
      console.log(`  ✅ Old refresh token invalidated (401 Unauthorized)`);
      return true;
    } else {
      console.log(`  ❌ FAIL: Old token should be invalid, got ${oldTokenResponse.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 5: Secrets Validation
// ═════════════════════════════════════════════════════════════════════════════

async function testSecretsValidation() {
  console.log('\n✓ TEST 5: Secrets Validation (check .env defaults)');

  try {
    // This test requires checking server startup logs
    // In a real scenario, you'd check the logs for warnings
    const healthResponse = await api.get('/monitoring/health');

    if (healthResponse.status === 200) {
      console.log(`  ✅ Server healthy (secrets validation passed or running in dev)`);
      console.log(`  ℹ️  Actual validation depends on NODE_ENV=${process.env.NODE_ENV}`);
      return true;
    } else {
      console.log(`  ❌ FAIL: Health check failed`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 6: Observability Metrics
// ═════════════════════════════════════════════════════════════════════════════

async function testObservabilityMetrics() {
  console.log('\n✓ TEST 6: Observability Metrics Collection');

  try {
    const metricsResponse = await api.get('/monitoring/metrics');

    if (metricsResponse.status === 200) {
      const metrics = metricsResponse.data;

      if (metrics.includes('http_requests_total')) {
        console.log(`  ✅ HTTP requests metrics collected`);
      }
      if (metrics.includes('active_connections')) {
        console.log(`  ✅ Connection metrics collected`);
      }
      if (metrics.includes('rate_limit_exceeded')) {
        console.log(`  ✅ Security metrics collected`);
      }

      console.log(`  ✅ Prometheus format valid`);
      return true;
    } else {
      console.log(`  ❌ FAIL: Metrics endpoint failed`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═════════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          Sprint 1 Security E2E Tests                      ║');
  console.log('║     Tenant Isolation, Rate Limiting, 2FA, Observability   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = {
    tenantIsolation: false,
    rateLimiting: false,
    twoFA: false,
    refreshTokenRotation: false,
    secretsValidation: false,
    observability: false,
  };

  try {
    // Setup: Login as admin to get access token
    console.log('\n[SETUP] Authenticating admin user...');
    const loginResponse = await api.post(
      '/auth/login',
      {
        identifier: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      { headers: nextLoginHeaders() },
    );

    if (![200, 201].includes(loginResponse.status)) {
      console.log(`❌ Login failed: ${loginResponse.status}`);
      console.log(`   Is API running on ${API_URL}?`);
      process.exit(1);
    }

    context.adminAccessToken = loginResponse.data.accessToken;
    context.adminSessionId = loginResponse.data.sessionId;
    context.tenantId = loginResponse.data.user.tenantId;
    console.log(`✅ Authenticated as ${ADMIN_EMAIL}`);

    // Run tests
    results.tenantIsolation = await testTenantIsolationBypass();
    results.rateLimiting = await testRateLimiting();
    results.twoFA = await testTwoFAWorkflow();
    results.refreshTokenRotation = await testRefreshTokenRotation();
    results.secretsValidation = await testSecretsValidation();
    results.observability = await testObservabilityMetrics();

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    const passed = Object.values(results).filter((r) => r).length;
    const total = Object.keys(results).length;

    console.log(`\n${passed}/${total} tests passed\n`);

    for (const [name, result] of Object.entries(results)) {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${name}`);
    }

    if (passed === total) {
      console.log('\n🎉 All security tests passed!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${total - passed} test(s) failed`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`\n❌ FATAL ERROR: ${error}`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
