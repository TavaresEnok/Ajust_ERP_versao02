const fs = require('node:fs');
const { chromium } = require('../apps/web/node_modules/@playwright/test');
const base = process.env.ERP_REVIEW_BASE_URL || 'http://168.194.13.18:8070';
const output = process.env.ERP_REVIEW_OUTPUT || '/tmp/ajust-manager-review';
const active = (row) => !['FECHADA', 'RESOLVIDA', 'CANCELADA'].includes(row.status);
const completed = (row) => ['FECHADA', 'RESOLVIDA'].includes(row.status);
const time = (value) => (value ? new Date(value).getTime() : NaN);
const pattern = (path) =>
  path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/\/(ATEND_|AJUST_)[^/?]+/g, '/:flow');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Fortaleza',
  });
  const page = await context.newPage();
  const errors = [],
    pages = [];
  let current = '/login';
  page.on('pageerror', (error) => errors.push({ route: current, message: error.message }));
  page.on('response', (response) => {
    if (response.url().includes('/api/erp/') && response.status() >= 400)
      errors.push({
        route: current,
        status: response.status(),
        endpoint: new URL(response.url()).pathname,
      });
  });
  async function get(path) {
    const response = await context.request.get(base + '/api/erp' + path);
    if (!response.ok()) throw new Error(`GET ${path}: ${response.status()}`);
    return response.json();
  }
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Gerente/ }).click();
    const login = await context.request.post(base + '/api/public/auth/login', {
      headers: { origin: base },
      data: {
        identifier: await page.locator('#auth-identifier').inputValue(),
        password: await page.locator('#auth-password').inputValue(),
      },
    });
    if (!login.ok()) throw new Error(`Login: ${login.status()}`);
    current = '/gerencia';
    await page.goto(base + '/gerencia', { waitUntil: 'networkidle' });
    const navigation = await page
      .locator('nav[aria-label="Navegação principal"] a')
      .evaluateAll((links) =>
        links.map((a) => ({ path: a.getAttribute('href'), name: a.textContent.trim() })),
      );
    const mainRoutes = [
      ...new Set(
        navigation.map((item) => item.path).filter((path) => path?.startsWith('/gerencia')),
      ),
    ];
    const all = [];
    let complete = false;
    for (let offset = 0; offset < 20000; offset += 200) {
      const batch = await get(`/service-orders?scope=operation&limit=200&offset=${offset}`);
      all.push(...batch);
      if (batch.length < 200) {
        complete = true;
        break;
      }
    }
    const now = Date.now();
    const comparison = [];
    for (const days of [7, 30, 90]) {
      const result = await get('/reports/manager-kpi?daysBack=' + days);
      const cutoff = now - days * 86400000;
      const cohort = all.filter((row) => time(row.createdAt) >= cutoff);
      const closed = cohort.filter(completed);
      const measured = closed.filter(
        (row) =>
          time(row.resolvedAt || row.closedAt) >= time(row.createdAt) &&
          time(row.resolvedAt || row.closedAt) <= now,
      );
      const eligible = measured.filter(
        (row) => row.slaEligible !== false && Number.isFinite(time(row.deadlineAt)),
      );
      const expected = {
        totalOpen: cohort.filter(active).length,
        totalClosed: closed.length,
        slaBreaches: cohort.filter(
          (row) =>
            active(row) && !row.pausedAt && row.slaEligible !== false && time(row.deadlineAt) < now,
        ).length,
        measuredClosed: measured.length,
        tmrHours: measured.length
          ? Math.round(
              (measured.reduce(
                (sum, row) => sum + time(row.resolvedAt || row.closedAt) - time(row.createdAt),
                0,
              ) /
                measured.length /
                3600000) *
                10,
            ) / 10
          : null,
        slaEvaluated: eligible.length,
        slaPercentage: eligible.length
          ? Math.round(
              (eligible.filter(
                (row) => time(row.resolvedAt || row.closedAt) <= time(row.deadlineAt),
              ).length /
                eligible.length) *
                1000,
            ) / 10
          : null,
      };
      comparison.push({
        days,
        reported: result.overview,
        expected,
        matches: Object.entries(expected).every(([key, value]) => result.overview[key] === value),
        activeCreatedBeforeWindow: all.filter((row) => active(row) && time(row.createdAt) < cutoff)
          .length,
        deliveredInWindow: all.filter(
          (row) =>
            completed(row) &&
            time(row.resolvedAt || row.closedAt) >= cutoff &&
            time(row.resolvedAt || row.closedAt) <= now,
        ).length,
      });
    }
    const agenda = await get('/dashboards/agenda-overview');
    const health = await get('/reports/health-summary');
    const summary = await get('/service-orders/summary?scope=operation');
    const byService = await get('/reports/service-types?daysBack=30');
    const sourceMix = {
      demonstrations: all.filter((row) => row.sourceMetadata?.demonstration === true).length,
      operational: all.filter((row) => row.sourceMetadata?.demonstration !== true).length,
      activeDemonstrations: all.filter(
        (row) => active(row) && row.sourceMetadata?.demonstration === true,
      ).length,
      activeOperational: all.filter(
        (row) => active(row) && row.sourceMetadata?.demonstration !== true,
      ).length,
      serviceType30Days: byService.summary,
    };
    const result = {
      base,
      sourceMix,
      reviewedAt: new Date().toISOString(),
      navigation,
      completeOrderRead: complete,
      totalOrders: all.length,
      activeOrders: all.filter(active).length,
      resolvedOrders: all.filter((row) => row.status === 'RESOLVIDA').length,
      priorityRows: all.filter((row) => ['ALTA', 'CRITICA'].includes(row.priority)).length,
      completedPriorityRows: all.filter(
        (row) => !active(row) && ['ALTA', 'CRITICA'].includes(row.priority),
      ).length,
      firstFourStatuses: all.slice(0, 4).map((row) => row.status),
      comparison,
      summary,
      agenda: {
        count: agenda.items.length,
        past: agenda.items.filter((row) => time(row.end || row.start) < now).length,
        sources: [...new Set(agenda.items.map((row) => row.source))],
      },
      healthHasScore: health.score !== undefined,
      pages,
      errors,
    };
    if (process.env.ERP_REVIEW_API_ONLY === '1') {
      fs.writeFileSync(output + '/review.json', JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ total: all.length, sourceMix, comparison }));
      return;
    }
    const queue = process.env.ERP_REVIEW_ROUTES
        ? process.env.ERP_REVIEW_ROUTES.split(',')
        : [...mainRoutes],
      seen = new Set();
    const queued = new Set(mainRoutes.map((route) => pattern(route.split('?')[0])));
    async function inspect(route, root) {
      current = route;
      const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
      const main = page.locator('main');
      await main.waitFor();
      const children = await main
        .getByRole('link')
        .evaluateAll((links) =>
          links
            .map((a) => ({ path: a.getAttribute('href'), name: a.textContent.trim() }))
            .filter((item) => item.path?.startsWith('/gerencia')),
        );
      const entry = {
        route,
        root,
        status: response?.status(),
        headings: await main.locator('h1, h2').allTextContents(),
        tabs: await main.getByRole('tab').allTextContents(),
        metrics: await main.locator('.metric-value').allTextContents(),
        links: children,
        mobileOverflow: false,
      };
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, {
          timeout: 2000,
        })
        .catch(() => undefined);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      entry.mobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (entry.mobileOverflow)
        entry.overflowSize = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
      if (entry.mobileOverflow)
        await page.screenshot({ path: `${output}/overflow-${pages.length}.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (route === '/gerencia') {
        await page.screenshot({ path: output + '/dashboard.png', fullPage: true });
        entry.priorityTabCount = await main
          .getByRole('button', { name: /Prioritárias/ })
          .textContent();
      }
      pages.push(entry);
      console.log(
        JSON.stringify({
          route,
          status: entry.status,
          title: entry.headings[0],
          mobileOverflow: entry.mobileOverflow,
          errors: errors.filter((item) => item.route === route).length,
        }),
      );
      return children;
    }
    for (const route of queue) {
      seen.add(pattern(route.split('?')[0]));
      const children = await inspect(route, mainRoutes.includes(route));
      for (const child of process.env.ERP_REVIEW_ROUTES ? [] : children) {
        const path = child.path.split('?')[0];
        const key = pattern(path);
        if (
          !seen.has(key) &&
          !queued.has(key) &&
          !path.endsWith('/nova') &&
          !path.endsWith('/novo')
        ) {
          queue.push(path);
          queued.add(key);
        }
      }
      if (pages.length >= 100) break;
      fs.writeFileSync(output + '/review.json', JSON.stringify(result, null, 2));
    }
    fs.writeFileSync(output + '/review.json', JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify({
        pages: pages.length,
        menuEntries: mainRoutes.length,
        kpiComparison: comparison.map((item) => ({ days: item.days, matches: item.matches })),
        errors: errors.length,
        output,
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
