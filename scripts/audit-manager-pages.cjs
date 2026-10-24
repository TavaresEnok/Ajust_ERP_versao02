/* Read-only navigation audit. Auth JSON stays outside the repository. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../apps/web/node_modules/@playwright/test');

async function main() {
  if (!process.env.ERP_AUDIT_AUTH_FILE) throw new Error('ERP_AUDIT_AUTH_FILE is required');
  const auth = JSON.parse(fs.readFileSync(process.env.ERP_AUDIT_AUTH_FILE, 'utf8'));
  const base = process.env.ERP_AUDIT_BASE || 'http://127.0.0.1:8070';
  const browser = await chromium.launch({
    executablePath: process.env.ERP_AUDIT_CHROME || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const report = {
    at: new Date().toISOString(),
    role: auth.role,
    mode: 'read-only-existing-session',
    pages: [],
    endpoints: {},
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const cookies = {
      ajust_live_access_token: auth.accessToken,
      ajust_live_session_id: auth.sessionId,
      ajust_live_role: auth.role,
      ajust_live_tenant_id: auth.tenantId,
    };
    await context.addCookies(
      Object.entries(cookies).map(([name, value]) => ({
        name,
        value,
        url: base,
        httpOnly: true,
        sameSite: 'Lax',
      })),
    );
    const me = await context.request.get(base + '/api/erp/auth/me');
    if (!me.ok()) throw new Error(`Audit session HTTP ${me.status()}`);
    const navigation = fs.readFileSync('apps/web/lib/navigation.ts', 'utf8');
    const routes = [
      ...new Set([
        ...[...navigation.matchAll(/path: '([^']+)'/g)].map((match) =>
          match[1].replace(/^\/analista\//, '/gerencia/'),
        ),
        '/gerencia/calendario-sla',
        '/gerencia/configuracoes/empresa',
        '/gerencia/configuracoes/meu-perfil',
      ]),
    ];
    const detailRoutes = new Set();
    const page = await context.newPage();
    let current;
    page.on('pageerror', (error) => current?.errors.push(error.message.slice(0, 240)));
    page.on('response', async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/erp/')) return;
      const endpoint = url.pathname + url.search;
      if (response.status() >= 400)
        current?.failedRequests.push({ endpoint, status: response.status() });
      if (response.ok() && response.headers()['content-type']?.includes('application/json')) {
        try {
          const data = await response.json();
          const rows = Array.isArray(data) ? data : data.items || data.logs;
          if (Array.isArray(rows))
            report.endpoints[endpoint] = { count: rows.length, total: data.total ?? rows.length };
          if (data.summary?.totalOrders !== undefined)
            report.endpoints[endpoint] = {
              orders: data.summary.totalOrders,
              types: data.summary.types,
              withoutSla: data.summary.withoutSla,
            };
        } catch {
          /* A navigation can cancel a response body. */
        }
      }
    });
    for (const route of routes) await audit(route);
    for (const route of detailRoutes) await audit(route);

    async function audit(route) {
      current = {
        route,
        finalPath: '',
        heading: [],
        rows: 0,
        panels: 0,
        emptyStates: 0,
        errors: [],
        failedRequests: [],
      };
      report.pages.push(current);
      try {
        const response = await page.goto(base + route, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        current.http = response?.status();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        current.finalPath = new URL(page.url()).pathname;
        current.heading = await page.locator('main h1').allTextContents();
        current.rows = await page.locator('main tbody tr').count();
        current.panels = await page.locator('main .panel').count();
        current.emptyStates = await page
          .getByText('Nenhum registro encontrado', { exact: true })
          .count();
        current.errorPanels = await page
          .getByText('Não foi possível carregar', { exact: true })
          .count();
        current.unavailable = await page
          .getByText('Vamos encontrar seu caminho?', { exact: true })
          .count();
        for (const prefix of ['ordens', 'ocorrencias', 'provedores', 'tecnicos', 'processos']) {
          if (route !== '/gerencia/' + prefix) continue;
          const links = await page
            .locator(`main a[href^="/gerencia/${prefix}/"]`)
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
          const detail = links.find((link) =>
            /^\/gerencia\/[^/]+\/[a-f0-9-]{36}$/.test(link || ''),
          );
          if (detail) detailRoutes.add(detail);
        }
      } catch (error) {
        current.errors.push(error.message.slice(0, 240));
      }
      console.log(
        JSON.stringify({
          route,
          heading: current.heading,
          rows: current.rows,
          empty: current.emptyStates,
          failures: current.failedRequests,
          errors: current.errors,
        }),
      );
    }
  } finally {
    await browser.close();
    const out = process.env.ERP_AUDIT_OUTPUT || '/tmp/ajust-manager-pages-audit.json';
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('AUDIT_REPORT', out, 'pages', report.pages.length);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
