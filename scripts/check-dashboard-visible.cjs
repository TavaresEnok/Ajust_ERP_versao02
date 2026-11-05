const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
      page = await context.newPage(),
      base = 'http://127.0.0.1:8070';
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/login');
    await expect(async () => {
      await page.getByRole('button', { name: /^Analista · Anderson/ }).click();
      await expect(page.locator('#auth-password')).not.toHaveValue('');
    }).toPass({ timeout: 30000 });
    const login = await context.request.post(base + '/api/public/auth/login', {
      headers: { origin: base },
      data: {
        identifier: await page.locator('#auth-identifier').inputValue(),
        password: await page.locator('#auth-password').inputValue(),
      },
    });
    expect(login.status()).toBe(200);
    await page.goto(base + '/analista');
    await expect(page.getByTestId('analyst-metrics')).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByRole('heading', { name: 'Minhas O.S. · evolução', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId('analyst-metrics').locator('.metric-value').first(),
    ).not.toHaveText('…');
    await expect(
      page.getByRole('heading', { name: 'O.S. ativas por status', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.recharts-surface')).toHaveCount(3);
    await expect(
      page.getByRole('heading', { name: 'Minha agenda · próximos 7 dias', exact: true }),
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Período do painel do analista' }).selectOption('90');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '/tmp/analyst-dashboard-restored.png', fullPage: true });
    expect(errors).toEqual([]);
    console.log('Dashboard visível, três gráficos, filtros de período e agenda validados.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
