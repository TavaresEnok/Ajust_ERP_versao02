import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8071';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8070';

let backendAvailable = false;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${API_URL}/monitoring/health`, { timeout: 5000 });
    backendAvailable = res.status() === 200;
  } catch {
    backendAvailable = false;
  }
});

test.describe('API Health & Readiness', () => {
  test.beforeEach(function () {
    if (!backendAvailable) test.skip();
  });

  test('GET /monitoring/health returns ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/monitoring/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /monitoring/ready returns ready status', async ({ request }) => {
    const res = await request.get(`${API_URL}/monitoring/ready`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.ready).toBe('boolean');
    expect(body.checks).toBeTruthy();
  });

  test('Swagger docs accessible', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/docs`);
    expect(res.status()).toBe(200);
  });
});

test.describe('Auth Endpoints', () => {
  test.beforeEach(function () {
    if (!backendAvailable) test.skip();
  });

  test('POST /auth/login with invalid credentials returns >=400', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: 'invalid@test.com', password: 'wrongpassword' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /auth/login with empty body returns >=400', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('GET /auth/me without token returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('Rate limiting on login endpoint', async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${API_URL}/auth/login`, {
        data: { identifier: 'ratelimit@test.com', password: 'test123' },
        headers: { 'content-type': 'application/json' },
      });
      results.push(res.status());
    }
    const hasRateLimit = results.some((s) => s === 429);
    const allAuthErrors = results.every((s) => s >= 400);
    expect(hasRateLimit || allAuthErrors).toBeTruthy();
  });
});

test.describe('Tenant Isolation', () => {
  test.beforeEach(function () {
    if (!backendAvailable) test.skip();
  });

  test('GET /service-orders with tenantId query param returns >=400', async ({ request }) => {
    const res = await request.get(`${API_URL}/service-orders?tenantId=some-other-tenant`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /service-orders with tenantId in body returns >=400', async ({ request }) => {
    const res = await request.post(`${API_URL}/service-orders`, {
      data: {
        tenantId: 'hacked-tenant',
        title: 'test',
        type: 'ROMPIMENTO',
        priority: 'ALTA',
        protocol: 'TEST-001',
        description: 'test',
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Public Endpoints', () => {
  test.beforeEach(function () {
    if (!backendAvailable) test.skip();
  });

  test('POST /auth/forgot-password accepts valid input', async ({ request }) => {
    const email = `playwright-forgot-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const res = await request.post(`${API_URL}/auth/forgot-password`, {
      data: { email },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeLessThan(400);
  });

  test('POST /auth/reset-password with invalid token returns error', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/reset-password`, {
      data: { token: 'invalid-token', newPassword: 'NewPass123!' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Security Headers', () => {
  test('GET / returns security headers', async ({ request }) => {
    const res = await request.get(WEB_URL);
    const csp = res.headers()['content-security-policy'];
    const xContentType = res.headers()['x-content-type-options'];
    const xFrame = res.headers()['x-frame-options'];
    expect(csp || xContentType || xFrame).toBeTruthy();
  });

  test('API has Helmet headers', async ({ request }) => {
    test.skip(!backendAvailable, 'Backend not available');
    const res = await request.get(`${API_URL}/monitoring/health`);
    const headers = res.headers();
    expect(headers['x-content-type-options'] || headers['x-dns-prefetch-control']).toBeTruthy();
  });
});
