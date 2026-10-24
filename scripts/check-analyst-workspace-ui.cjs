const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

async function main() {
  const access = JSON.parse(fs.readFileSync(process.env.ERP_REVIEW_ACCESS_FILE, 'utf8'));
  const base = process.env.ERP_REVIEW_BASE_URL || 'http://127.0.0.1:8070';
  const artifacts = process.env.ERP_REVIEW_ARTIFACTS;
  const browser = await chromium.launch({
    executablePath: process.env.ERP_REVIEW_BROWSER || '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  async function login(role) {
    const account = access.accounts.find((a) => a.role === role);
    if (!account) throw new Error(`Missing review account for ${role}`);
    const sessionFile = artifacts ? path.join(artifacts, `session-${role}.json`) : null;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      ...(sessionFile && fs.existsSync(sessionFile) ? { storageState: sessionFile } : {}),
    });
    if (sessionFile && fs.existsSync(sessionFile)) {
      const current = await context.request.get(base + '/api/erp/auth/me');
      if (current.ok()) return context;
    }
    const response = await context.request.post(base + '/api/public/auth/login', {
      headers: { origin: base },
      data: { identifier: account.email, password: account.password },
    });
    expect(response.status(), `login ${role}`).toBe(200);
    if (sessionFile) {
      await context.storageState({ path: sessionFile });
      fs.chmodSync(sessionFile, 0o600);
    }
    return context;
  }
  async function get(context, route) {
    const r = await context.request.get(base + '/api/erp' + route);
    expect(r.ok(), route).toBe(true);
    return r.json();
  }
  try {
    const context = await login('analista');
    const me = await get(context, '/auth/me');
    const userId = me.user?.id || me.id;
    expect(userId).toBeTruthy();
    expect(me.tenant.role).toBe('analista');
    const all = await get(context, '/service-orders?scope=operation');
    const mine = await get(context, '/service-orders?scope=mine');
    const expectedMine = all.filter((r) => r.ownerUserId === userId || r.assigneeUserId === userId);
    expect(mine.map((r) => r.id).sort()).toEqual(expectedMine.map((r) => r.id).sort());
    const spoof = await get(context, '/service-orders?scope=mine&responsibleUserId=other');
    expect(spoof.map((r) => r.id).sort()).toEqual(mine.map((r) => r.id).sort());
    const denied = {};
    for (const route of [
      '/iam/users',
      '/iam/tenants',
      '/audit/logs',
      '/reports/manager-kpi',
      '/workflows',
    ]) {
      denied[route] = (await context.request.get(base + '/api/erp' + route)).status();
      expect(denied[route], route).toBe(403);
    }
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/api/erp/') && r.status() >= 400)
        errors.push(`UI HTTP ${r.status()}: ${new URL(r.url()).pathname}`);
    });
    await page.goto(base + '/analista', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Meu trabalho', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const active = (r) => !['RESOLVIDA', 'FECHADA', 'CANCELADA'].includes(r.status);
    const metricValues = page.getByTestId('analyst-metrics').locator('.metric-value');
    await expect(metricValues.first()).toHaveText(String(mine.filter(active).length));
    await expect(
      page.locator('aside').getByRole('link', { name: 'Provedores', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('aside').getByRole('link', { name: 'Processos de atendimento', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('aside').getByRole('link', { name: 'Meu painel', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.locator('aside').getByRole('link', { name: 'Registro de trabalho', exact: true }),
    ).toBeHidden();
    await page.locator('aside summary').filter({ hasText: 'Ferramentas técnicas' }).click();
    await expect(
      page.locator('aside').getByRole('link', { name: 'Registro de trabalho', exact: true }),
    ).toBeVisible();
    await page.locator('aside summary').filter({ hasText: 'Ferramentas técnicas' }).click();
    await page.getByLabel('Período do painel do analista').selectOption('all');
    const knownClosed = mine.filter(
      (r) => ['FECHADA', 'RESOLVIDA'].includes(r.status) && (r.resolvedAt || r.closedAt),
    );
    await expect(metricValues.nth(3)).toHaveText(String(knownClosed.length));
    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    const tableIds = await page
      .locator('main tbody a[href*="/ordens/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href').split('/').pop()));
    expect(tableIds.every((id) => mine.some((r) => r.id === id))).toBe(true);
    if (artifacts)
      await page.screenshot({ path: path.join(artifacts, 'analyst-personal.png'), fullPage: true });
    await page.getByRole('button', { name: 'Visão geral da Ajust', exact: true }).click();
    await expect(metricValues.first()).toHaveText(String(all.filter(active).length));
    await expect(
      page.getByRole('heading', { name: 'Ordens de serviço da Ajust', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Meu trabalho', exact: true }).click();
    await expect(metricValues.first()).toHaveText(String(mine.filter(active).length));
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
        message: 'Responsive layout must settle within the mobile viewport',
      })
      .toBe(true);
    if (artifacts)
      await page.screenshot({ path: path.join(artifacts, 'analyst-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Minhas ordens', exact: true })).toBeVisible();
    const personalList = await get(context, '/service-orders?scope=mine&limit=8&offset=0');
    expect(personalList.every((r) => r.ownerUserId === userId || r.assigneeUserId === userId)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Todas da Ajust', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Ordens de serviço', exact: true }),
    ).toBeVisible();
    const customers = await get(context, '/customers');
    await page.goto(base + '/analista/provedores', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'Clientes da Ajust', exact: true }),
    ).toBeVisible();
    if (customers[0]) {
      await page.goto(base + '/analista/provedores/' + customers[0].id, {
        waitUntil: 'networkidle',
      });
      await expect(
        page.getByRole('heading', { name: customers[0].tradeName, exact: true }),
      ).toBeVisible();
    }
    await page.goto(base + '/analista/processos', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'Processos de atendimento', exact: true }),
    ).toBeVisible();
    await expect(page.locator('a[href*="/workflows"]')).toHaveCount(0);
    const instances = await get(context, '/service-processes/operational');
    if (instances[0]) {
      await page.goto(base + '/analista/processos/' + instances[0].id, {
        waitUntil: 'networkidle',
      });
      await expect(page.locator('a[href*="/workflows"]')).toHaveCount(0);
    }
    const manager = await login('gerente');
    const managerPage = await manager.newPage();
    managerPage.on('pageerror', (e) => errors.push(e.message));
    await managerPage.goto(base + '/gerencia', { waitUntil: 'networkidle' });
    await expect(
      managerPage.locator('aside').getByRole('link', { name: 'Workflows', exact: true }),
    ).toBeVisible();
    await expect(managerPage.getByTestId('analyst-metrics')).toHaveCount(0);
    const customer = await login('cliente');
    const customerPage = await customer.newPage();
    customerPage.on('pageerror', (e) => errors.push(e.message));
    await customerPage.goto(base + '/cliente', { waitUntil: 'networkidle' });
    await expect(
      customerPage.locator('aside').getByRole('link', { name: 'Provedores', exact: true }),
    ).toHaveCount(0);
    expect((await customer.request.get(base + '/api/erp/customers')).status()).toBe(403);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        {
          status: 'OK',
          personalOrders: mine.length,
          operationOrders: all.length,
          personalActive: mine.filter(active).length,
          personalKnownCompletions: knownClosed.length,
          providers: customers.length,
          processes: instances.length,
          mobileNoOverflow: true,
          managerAndCustomerRegression: 'passed',
          denied,
          uiErrors: errors.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.stack || e.message);
  process.exitCode = 1;
});
