const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
async function main() {
  const base = 'http://127.0.0.1:8070';
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [];
  try {
    for (const role of ['gerente', 'analista', 'cliente']) {
      console.log(`Verificando perfil: ${role}`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 },
        timezoneId: 'America/Fortaleza',
      });
      context.setDefaultNavigationTimeout(90000);
      context.setDefaultTimeout(30000);
      const page = await context.newPage();
      await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', {
          name:
            role === 'gerente'
              ? /^Gerente/
              : role === 'analista'
                ? /^Analista · Anderson/
                : /^Cliente · Meganet/,
        })
        .click();
      await expect(page.locator('#auth-identifier')).not.toHaveValue('');
      await expect(page.locator('#auth-password')).not.toHaveValue('');
      const identifier = await page.locator('#auth-identifier').inputValue();
      const password = await page.locator('#auth-password').inputValue();
      const login = await context.request.post(base + '/api/public/auth/login', {
        headers: { origin: base },
        data: { identifier, password },
      });
      expect(login.status(), `login ${role}`).toBe(200);
      console.log(`Login validado: ${role}`);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const portal =
        role === 'gerente' ? '/gerencia' : role === 'analista' ? '/analista' : '/cliente';
      await page.goto(base + portal, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 60000 });
      if (role !== 'cliente') {
        await expect(
          page.getByRole('heading', {
            name: role === 'gerente' ? 'Acompanhamento da operação' : 'Meu trabalho',
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: /Execuções agendadas/ })).toHaveText(
          /Execuções agendadas\d+/,
          { timeout: 60000 },
        );
        await page.getByRole('button', { name: /Execuções agendadas/ }).click();
        await expect(
          page.getByRole('heading', { name: 'Execuções agendadas', exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: `/tmp/ajust-focus-${role}.png`, fullPage: true });
        const response = await context.request.get(
          base +
            `/api/erp/service-orders?scope=${role === 'gerente' ? 'operation' : 'mine'}&limit=200`,
        );
        expect(response.ok()).toBe(true);
        const rows = await response.json();
        const order = rows.find((o) => !['FECHADA', 'CANCELADA'].includes(o.status));
        expect(order).toBeTruthy();
        await page.goto(base + portal + '/ordens/' + order.id, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Seu trabalho nesta O.S.', { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await page.getByText('Outras ações', { exact: true }).click();
        await page.getByRole('button', { name: 'Agendar execução', exact: true }).click();
        await expect(page.getByLabel('Execução agendada', { exact: true })).toBeVisible();
        await expect(
          page.getByText('Manutenção com impacto na rede', { exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).first().click();
        await expect(page.getByLabel('Novo responsável', { exact: true })).toBeVisible();
        const flow = await context.request.get(base + '/api/erp/service-processes/operational');
        expect(flow.ok()).toBe(true);
        results.push({
          role,
          orders: rows.length,
          flows: (await flow.json()).length,
          operations: 'visíveis',
        });
        await page.screenshot({ path: `/tmp/ajust-operating-${role}.png`, fullPage: true });
        await page.goto(base + portal + '/ocorrencias/' + order.occurrenceId, {
          waitUntil: 'domcontentloaded',
        });
        await expect(page.getByText('Demanda do provedor', { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await page
          .getByText(/^Acompanhar etapas ·/)
          .first()
          .click();
        await expect(
          page.getByRole('region', { name: 'Acompanhamento do atendimento' }),
        ).toBeVisible({ timeout: 60000 });
      } else {
        const denied = await context.request.get(
          base + '/api/erp/service-orders/operational-alerts',
        );
        expect(denied.status()).toBe(403);
        results.push({ role, internalOperations: 'bloqueadas' });
      }
      expect(errors, role).toEqual([]);
      await context.close();
    }
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
