import { test, expect, type Page } from '@playwright/test';

/** Coleta exceções e respostas 4xx/5xx do BFF durante a navegação. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/') && response.status() >= 400)
      errors.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
  });
  return errors;
}

test.describe('Portal da gerência', () => {
  test('dashboard identifica a sessão', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/gerencia$/);
    await expect(page.getByText(/seu dia começa por aqui/i)).toBeVisible();
    await expect(page.getByText('gerente', { exact: true }).first()).toBeVisible();
  });

  test('perfil de gerente não acessa outro portal', async ({ page }) => {
    await page.goto('/analista/ordens');
    await expect(page).toHaveURL(/\/gerencia$/);
  });

  test('todas as páginas do menu carregam sem erros do BFF', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/gerencia');
    const routes = await page.$$eval('nav[aria-label="Navegação principal"] a[href]', (links) =>
      links.map((link) => link.getAttribute('href') as string),
    );
    expect(routes.length).toBeGreaterThan(15);
    const errors = watchErrors(page);
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/não foi possível carregar/i)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('cria uma ordem de serviço pela interface', async ({ page }) => {
    const errors = watchErrors(page);
    const title = `OS e2e ${Date.now()}`;
    await page.goto('/gerencia/ordens/nova');
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Tipo de serviço/).selectOption('LENTIDAO');
    await page.getByLabel(/^Descrição/).fill('Criada pelo teste e2e do redesign');
    await page.getByRole('button', { name: /criar ordem/i }).click();
    await page.waitForURL(/\/gerencia\/ordens\/[0-9a-f-]{36}$/, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ID inexistente mostra o ID solicitado, sem trocar de registro', async ({ page }) => {
    await page.goto('/gerencia/ativos/registro-inexistente/snapshots');
    await expect(page.getByText(/registro-inexistente/).first()).toBeVisible();
  });
});
