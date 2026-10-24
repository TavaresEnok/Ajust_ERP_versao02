const fs = require('node:fs');
const { chromium } = require('../apps/web/node_modules/@playwright/test');

async function main() {
  const auth = JSON.parse(fs.readFileSync(process.env.ERP_AUDIT_AUTH_FILE, 'utf8'));
  const base = 'http://127.0.0.1:8070';
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies(
      Object.entries({
        ajust_live_access_token: auth.accessToken,
        ajust_live_session_id: auth.sessionId,
        ajust_live_role: auth.role,
        ajust_live_tenant_id: auth.tenantId,
      }).map(([name, value]) => ({ name, value, url: base, httpOnly: true, sameSite: 'Lax' })),
    );
    const get = async (suffix = '') => {
      const r = await context.request.get(base + '/api/erp/reports/service-types' + suffix);
      if (!r.ok()) throw new Error('Analytics HTTP ' + r.status());
      return r.json();
    };
    const all = await get();
    if (all.summary.totalOrders !== all.rows.reduce((sum, row) => sum + row.total, 0))
      throw new Error('Totals differ');
    if (JSON.stringify(all).includes('sourceMetadata'))
      throw new Error('Raw source metadata exposed');
    const sgp = await get('?source=SGP');
    if (!(sgp.summary.totalOrders > 0 && sgp.summary.totalOrders <= all.summary.totalOrders))
      throw new Error('Source filter failed');
    const provider = sgp.providerOptions.find((name) => /meganet/i.test(name));
    if (!provider) throw new Error('Expected imported provider missing');
    const scoped = await get('?source=SGP&provider=' + encodeURIComponent(provider));
    if (scoped.providers.length !== 1 || scoped.providers[0].name !== provider)
      throw new Error('Provider filter failed');
    const malformed = await context.request.get(
      base + '/api/erp/reports/service-types?periodStart=2026-10-21&periodEnd=2026-10-01',
    );
    if (malformed.status() !== 400) throw new Error('Inverted range was accepted');
    const externalTenant = await context.request.get(
      base + '/api/erp/reports/service-types?tenantId=00000000-0000-4000-8000-000000000000',
    );
    // The BFF intentionally strips client-supplied tenantId. The API itself rejects it.
    if (externalTenant.status() !== 200) throw new Error('BFF tenant normalization failed');
    if (JSON.stringify(await externalTenant.json()) !== JSON.stringify(all))
      throw new Error('Client tenantId changed the authenticated data scope');
    const directTenant = await context.request.get(
      'http://127.0.0.1:8092/reports/service-types?tenantId=00000000-0000-4000-8000-000000000000',
      { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    );
    if (directTenant.status() !== 403) throw new Error('API cross-tenant scope not rejected');
    const anonymous = await browser.newContext();
    if ((await anonymous.request.get(base + '/api/erp/reports/service-types')).status() !== 401)
      throw new Error('Anonymous access accepted');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/gerencia/servicos', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Análise de tipos de serviço', exact: true }).waitFor();
    if ((await page.locator('tbody tr').count()) !== all.rows.length)
      throw new Error('Types table incomplete');
    const sourceResponse = page.waitForResponse(
      (r) => r.url().includes('/reports/service-types?source=SGP') && r.status() === 200,
    );
    await page.getByRole('combobox', { name: 'Origem das O.S. por tipo' }).selectOption('SGP');
    await sourceResponse;
    await page.getByRole('status').waitFor({ state: 'hidden' });
    await page.screenshot({ path: 'docs/analise-sgp/tipos-servico-analise.png' });
    const providerResponse = page.waitForResponse(
      (r) => r.url().includes('provider=') && r.status() === 200,
    );
    await page
      .getByRole('combobox', { name: 'Provedor dos tipos de serviço' })
      .selectOption(provider);
    await providerResponse;
    await page.getByRole('status').waitFor({ state: 'hidden' });
    await page
      .getByRole('combobox', { name: 'Período dos tipos de serviço' })
      .selectOption('custom');
    await page.getByLabel('Início dos tipos de serviço').fill('2026-10-21');
    await page.getByLabel('Fim dos tipos de serviço').fill('2026-10-01');
    await page
      .getByRole('alert')
      .filter({ hasText: 'A data inicial deve ser anterior ou igual à data final.' })
      .waitFor();
    await page.getByRole('combobox', { name: 'Período dos tipos de serviço' }).selectOption('all');
    await page.getByRole('button', { name: 'Catálogo e modelos', exact: true }).click();
    await page.getByRole('heading', { name: 'Tipos de serviço', exact: true }).waitFor();
    await page.goto(base + '/gerencia/provedores', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Análise das O.S.', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Análise de atendimento por provedor', exact: true })
      .waitFor();
    await page.getByRole('status').waitFor({ state: 'hidden' });
    if ((await page.locator('tbody tr').count()) !== all.providers.length)
      throw new Error('Provider analysis incomplete');
    const providerSourceResponse = page.waitForResponse(
      (r) => r.url().includes('/reports/service-types?source=SGP') && r.status() === 200,
    );
    await page
      .getByRole('combobox', { name: 'Origem da análise de provedores' })
      .selectOption('SGP');
    await providerSourceResponse;
    await page.getByRole('status').waitFor({ state: 'hidden' });
    if ((await page.locator('tbody tr').count()) !== sgp.providers.length)
      throw new Error('Provider source filter failed');
    await page.screenshot({ path: 'docs/analise-sgp/provedores-analise.png' });
    await page.goto(base + '/gerencia', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'O.S. por provedor', exact: true }).waitFor();
    await page.screenshot({ path: 'docs/analise-sgp/dashboard-provedores.png' });
    if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
    console.log(
      JSON.stringify({
        status: 'OK',
        allOrders: all.summary.totalOrders,
        allTypes: all.rows.length,
        sourceOrders: sgp.summary.totalOrders,
        sourceTypes: sgp.rows.length,
        providerFilteredOrders: scoped.summary.totalOrders,
        periodAndCatalog: true,
        crossTenantAndAnonymousBlocked: true,
        pageErrors: 0,
      }),
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
