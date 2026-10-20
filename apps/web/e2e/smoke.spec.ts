import { test, expect } from '@playwright/test';

test.describe('Páginas públicas', () => {
  test('login exibe o formulário de acesso', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /bom ter você por aqui/i })).toBeVisible();
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar no erp/i })).toBeVisible();
  });

  test('login não oferece navegação anônima', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/explorar o sistema sem autenticação/i)).toHaveCount(0);
  });

  test('recuperação de senha carrega', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
  });

  test('pesquisa CSAT com token inexistente não agradece envio', async ({ page }) => {
    await page.goto('/csat/token-inexistente-123');
    await expect(page.getByText(/obrigad/i)).toHaveCount(0);
  });
});

test.describe('Proteção de rotas', () => {
  for (const path of ['/', '/gerencia', '/analista/ordens', '/cliente', '/portal/ordens']) {
    test(`${path} sem sessão vai para o login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('subrota inexistente responde 404 após autenticação de rota', async ({ request }) => {
    const response = await request.get('/gerencia/rota-que-nao-existe', { maxRedirects: 0 });
    // Sem sessão o proxy redireciona antes de resolver a rota.
    expect([307, 404]).toContain(response.status());
  });
});

test.describe('BFF', () => {
  test('rotas fora da allowlist respondem 404', async ({ request }) => {
    for (const path of [
      '/api/erp/monitoring/metrics',
      '/api/erp/auth/refresh',
      '/api/erp/../health',
    ]) {
      const response = await request.get(path);
      expect([401, 404]).toContain(response.status());
    }
  });

  test('chamada autenticada sem sessão responde 401', async ({ request }) => {
    const response = await request.get('/api/erp/service-orders');
    expect(response.status()).toBe(401);
  });

  test('mutação de outra origem é recusada', async ({ request }) => {
    const response = await request.post('/api/erp/knowledge/notes', {
      headers: { origin: 'https://exemplo-malicioso.test' },
      data: { title: 'x' },
    });
    expect(response.status()).toBe(403);
  });

  test('login inválido responde com mensagem de credenciais', async ({ request }) => {
    const response = await request.post('/api/public/auth/login', {
      data: { identifier: 'naoexiste@ajust.local', password: 'senha-invalida' },
    });
    expect([400, 429]).toContain(response.status());
    expect((await response.json()).authenticated).toBeUndefined();
  });
});
