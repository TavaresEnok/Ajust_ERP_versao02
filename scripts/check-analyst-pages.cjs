const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'America/Fortaleza',
    });
    const page = await context.newPage(),
      base = 'http://127.0.0.1:8070';
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
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
    await page.goto(base + '/analista', { waitUntil: 'networkidle' });
    const routes = await page
      .locator('nav[aria-label="Navegação principal"] a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    const failures = [];
    let active = '';
    page.on('pageerror', (e) => failures.push({ route: active, error: e.message }));
    page.on('response', (r) => {
      if (r.url().includes('/api/erp/') && r.status() >= 400)
        failures.push({ route: active, status: r.status(), endpoint: new URL(r.url()).pathname });
    });
    for (const route of routes) {
      active = route;
      const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator('main')).toBeVisible();
      expect(response.status()).toBe(200);
      const headings = await page.locator('main h1').allTextContents();
      console.log(
        JSON.stringify({ route, headings, errors: failures.filter((f) => f.route === route) }),
      );
      if (failures.some((f) => f.route === route)) throw new Error('Falha de página/API: ' + route);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(async () =>
          page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        )
        .toBe(true);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    console.log(
      `Páginas do menu do analista: ${routes.length} carregadas sem exceção nem API 4xx/5xx.`,
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
