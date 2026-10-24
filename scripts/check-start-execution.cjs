const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const { execFileSync } = require('node:child_process');
function fixture(action, id) {
  return execFileSync('docker', ['exec', '-w', '/workspace', 'ajust_erp-api-1',
    'node', 'apps/api/node_modules/tsx/dist/cli.mjs', '--tsconfig', 'apps/api/tsconfig.json',
    'scripts/start-execution-fixture.ts', action, ...(id ? [id] : [])], { encoding: 'utf8' }).trim();
}
async function main() {
  const { id } = JSON.parse(fixture('create'));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), base = 'http://127.0.0.1:8070';
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await expect(async () => {
      await page.getByRole('button', { name: /^Analista · Anderson/ }).click();
      await expect(page.locator('#auth-password')).not.toHaveValue('');
    }).toPass({ timeout: 30000 });
    const login = await context.request.post(base + '/api/public/auth/login', {
      headers: { origin: base }, data: {
        identifier: await page.locator('#auth-identifier').inputValue(),
        password: await page.locator('#auth-password').inputValue(),
      },
    });
    expect(login.status()).toBe(200);
    await page.goto(base + '/analista/ordens/' + id, { waitUntil: 'domcontentloaded' });
    const work = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Seu trabalho nesta O.S.', exact: true }) });
    const start = work.getByRole('button', { name: 'Iniciar execução', exact: true });
    await expect(start).toHaveCount(1);
    await expect(start).toBeEnabled();
    await expect(work.getByRole('textbox', { name: 'Registro do atendimento' })).toHaveCount(0);
    const responsePromise = page.waitForResponse(r => r.url().includes(`/service-orders/${id}/operations`) && r.request().method() === 'POST');
    await start.click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toMatchObject({ action: 'start', expectedVersion: 1 });
    expect(response.request().postDataJSON().reason).toBeUndefined();
    console.log(fixture('verify', id));
    await expect(work.getByRole('status')).toHaveText('Execução iniciada. A O.S. está em andamento.');
    await expect(work.getByText('Em andamento', { exact: true })).toBeVisible();
    await expect(start).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(work.getByText('Em andamento', { exact: true })).toBeVisible();
    await expect(start).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('Clique único sem justificativa → API real → status e histórico persistidos → tela atualizada após recarregar.');
  } finally {
    if (browser) await browser.close();
    console.log(fixture('cleanup', id));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
