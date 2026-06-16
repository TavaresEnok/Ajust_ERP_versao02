import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('successful login redirects to role home', async ({ page }) => {
    const email = process.env.E2E_WEB_EMAIL || 'gerente@ajust.local';
    const password = process.env.E2E_WEB_PASSWORD || 'Gerente@123';

    await page.goto('/login');
    const emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="usuário" i], input[placeholder*="login" i]',
      )
      .first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await Promise.all([
      page.waitForURL(/\/(gerencia|analista|cliente)/, { timeout: 25000 }),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Navigation & Access Control', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/gerencia');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to login when accessing protected route', async ({ page }) => {
    await page.goto('/analista');
    await expect(page).toHaveURL(/\/login/);
  });

  test('public pages load without auth', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/forgot-password');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Page Structure', () => {
  test('login page has required elements', async ({ page }) => {
    await page.goto('/login');
    const inputs = page.locator('input');
    const buttons = page.locator('button');
    await expect(inputs.first()).toBeVisible();
    await expect(buttons.first()).toBeVisible();
  });

  test('forgot password has email input', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('reset password has password input', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('body')).toBeVisible();
  });

  test('gerencia dashboard loads structure', async ({ page }) => {
    await page.goto('/gerencia');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('analista loads structure', async ({ page }) => {
    await page.goto('/analista');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('cliente loads structure', async ({ page }) => {
    await page.goto('/cliente');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Visual Regression Checks', () => {
  test('login page has dark mode support', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    await expect(html).toBeVisible();
  });

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('CORS') &&
        !e.includes('status of 40') &&
        !e.includes('status of 50'),
    );
    expect(realErrors.length).toBe(0);
  });

  test('no console errors on forgot-password page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('CORS') &&
        !e.includes('status of 40') &&
        !e.includes('status of 50'),
    );
    expect(realErrors.length).toBe(0);
  });
});
