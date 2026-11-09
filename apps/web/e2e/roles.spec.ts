import { test, expect } from '@playwright/test';

/** Only enabled with credentials for the isolated CI fixture. */
test.describe('Perfis de acesso', () => {
  test.skip(!process.env.E2E_ROLE_PASSWORD, 'Requer os usuários do banco descartável.');
  for (const role of ['gerente', 'analista', 'cliente']) {
    test(`${role} acessa seu portal e mantém o escopo da sessão`, async ({ page }) => {
      await page.goto('/login');
      await page.locator('input[name="identifier"]').fill(`${role}@example.invalid`);
      await page.locator('input[type="password"]').fill(process.env.E2E_ROLE_PASSWORD!);
      await page.getByRole('button', { name: /entrar no erp/i }).click();
      const home = role === 'gerente' ? '/gerencia' : `/${role}`;
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      const me = await page.request.get('/api/erp/auth/me');
      expect(me.status()).toBe(200);
      expect((await me.json()).tenant.role).toBe(role);
      await page.goto(role === 'gerente' ? '/cliente' : '/gerencia');
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      if (role === 'cliente') {
        const allOrders = await page.request.get('/api/erp/service-orders');
        expect(allOrders.status()).toBe(403);
        expect((await page.request.get('/api/erp/customer-portal')).status()).toBe(200);
      }
    });
  }
});
