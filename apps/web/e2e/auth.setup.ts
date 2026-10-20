import { test as setup, expect } from '@playwright/test';

export const MANAGER_STATE = 'e2e/.auth/gerente.json';

/** Login real pela interface; a sessão (cookies HttpOnly) é reutilizada pelos demais testes. */
setup('login do gerente pela interface', async ({ page }) => {
  await page.goto('/login?next=/gerencia/ordens');
  await page
    .locator('input[name="identifier"]')
    .fill(process.env.E2E_WEB_EMAIL || 'gerente@ajust.local');
  await page.locator('input[type="password"]').fill(process.env.E2E_WEB_PASSWORD || 'Gerente@123');
  await page.getByRole('button', { name: /entrar no erp/i }).click();
  await page.waitForURL(/\/gerencia\/ordens/, { timeout: 25000 });
  await expect(page.getByRole('heading', { name: /ordens de serviço/i })).toBeVisible();
  await page.context().storageState({ path: MANAGER_STATE });
});
