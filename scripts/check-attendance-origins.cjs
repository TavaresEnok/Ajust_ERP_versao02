const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

const base = 'http://127.0.0.1:8070';
const tenantId = '7c340999-3797-46f7-bbe0-35222bf7dfe6';
const expectedOrigins = ['WhatsApp', 'Ligação', 'Chat', 'Gestor'];

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  try {
    for (const role of ['gerente', 'analista']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      await expect(async () => {
        await page.getByRole('button', {
          name: role === 'gerente' ? /^Gerente/ : /^Analista · Anderson/,
        }).click();
        await expect(page.locator('#auth-password')).not.toHaveValue('');
      }).toPass({ timeout: 30000 });
      const login = await context.request.post(`${base}/api/public/auth/login`, {
        headers: { origin: base },
        data: {
          identifier: await page.locator('#auth-identifier').inputValue(),
          password: await page.locator('#auth-password').inputValue(),
        },
      });
      expect(login.status()).toBe(200);
      const endpoint = `${base}/api/erp/iam/tenants/${tenantId}/order-origins`;
      const response = await context.request.get(endpoint);
      expect(response.status()).toBe(200);
      let origins = await response.json();
      if (role === 'gerente' && process.argv.includes('--configure')) {
        const names = origins.map((origin) => origin.name);
        const missing = expectedOrigins.filter((name) =>
          !names.some((current) => current.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')),
        );
        if (missing.length) {
          const saved = await context.request.patch(endpoint, {
            headers: { origin: base },
            data: { names: [...names, ...missing] },
          });
          expect(saved.status()).toBe(200);
          origins = await saved.json();
          console.log(JSON.stringify({ previous: names, added: missing, current: origins.map((o) => o.name) }));
        }
      }
      for (const name of expectedOrigins) expect(origins.map((o) => o.name)).toContain(name);
      await page.goto(`${base}/${role === 'gerente' ? 'gerencia' : 'analista'}/ordens`, {
        waitUntil: 'domcontentloaded',
      });
      const dialog = page.getByRole('dialog');
      await expect(async () => {
        if (!await dialog.isVisible()) await page.getByRole('button', { name: 'Novo atendimento', exact: true }).first().click();
        await expect(dialog).toBeVisible();
      }).toPass({ timeout: 30000 });
      for (const name of expectedOrigins) {
        await dialog.locator('input[name="origin"]').locator('..').getByRole('button').click();
        await dialog.getByRole('combobox', { name: 'Buscar opções de Origem', exact: true }).fill(name);
        await dialog.getByRole('option', { name, exact: true }).click();
        await expect(dialog.locator('input[name="origin"]')).toHaveValue(name);
      }
      await page.keyboard.press('Escape');
      console.log(`${role}: quatro origens consultadas, pesquisadas e selecionadas no formulário.`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
