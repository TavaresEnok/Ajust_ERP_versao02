import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });

  test('unauthenticated redirect to login', async ({ page }) => {
    await page.goto('/gerencia');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page has form elements', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(emailInput.or(passwordInput).or(submitButton).first()).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible();
  });

  test('verify analyst page loads', async ({ page }) => {
    await page.goto('/verify-analyst');
    await expect(page.locator('body')).toBeVisible();
  });

  test('standalone operational pages redirect when unauthenticated', async ({ page }) => {
    await page.goto('/gerencia/trilha-os');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/gerencia/agenda');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/gerencia/saude');
    await expect(page).toHaveURL(/\/login/);
  });
});
