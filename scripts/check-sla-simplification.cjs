const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

const base = process.env.ERP_REVIEW_BASE_URL || 'http://127.0.0.1:8070';
const active = (row) => !['RESOLVIDA', 'FECHADA', 'CANCELADA'].includes(row.status);
const day = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(date);

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  const errors = [];
  async function login(label) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/api/erp/') && response.status() >= 400)
        errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto(base + '/login');
    await expect(async () => {
      await page.getByRole('button', { name: label }).click();
      await expect(page.locator('#auth-password')).not.toHaveValue('');
    }).toPass({ timeout: 30000 });
    const response = await context.request.post(base + '/api/public/auth/login', {
      headers: { origin: base },
      data: {
        identifier: await page.locator('#auth-identifier').inputValue(),
        password: await page.locator('#auth-password').inputValue(),
      },
    });
    expect(response.status()).toBe(200);
    return { context, page };
  }
  async function rows(context, query) {
    const response = await context.request.get(base + '/api/erp/service-orders?' + query);
    expect(response.status()).toBe(200);
    return response.json();
  }
  try {
    const analyst = await login(/^Analista · Anderson/);
    const own = await rows(analyst.context, 'scope=mine&limit=200');
    const now = new Date();
    const expected = {
      overdue: own.filter(
        (r) => active(r) && r.slaEligible && !r.pausedAt && new Date(r.deadlineAt) < now,
      ),
      today: own.filter(
        (r) =>
          active(r) && r.slaEligible && !r.pausedAt && day(new Date(r.deadlineAt)) === day(now),
      ),
      soon: own.filter(
        (r) =>
          active(r) &&
          r.slaEligible &&
          !r.pausedAt &&
          new Date(r.deadlineAt) >= now &&
          new Date(r.deadlineAt) <= new Date(now.getTime() + 7200000),
      ),
      paused: own.filter((r) => active(r) && r.pausedAt),
      without: own.filter((r) => active(r) && !r.slaEligible),
    };
    for (const filter of Object.keys(expected)) {
      const all = await rows(
        analyst.context,
        `scope=mine&deadline=${filter}&limit=200&orderBy=deadlineAt&orderDir=asc`,
      );
      expect(all.map((r) => r.id).sort()).toEqual(expected[filter].map((r) => r.id).sort());
      const first = await rows(
        analyst.context,
        `scope=mine&deadline=${filter}&limit=8&orderBy=deadlineAt&orderDir=asc`,
      );
      const second = await rows(
        analyst.context,
        `scope=mine&deadline=${filter}&limit=8&offset=8&orderBy=deadlineAt&orderDir=asc`,
      );
      expect(first.map((r) => r.id)).toEqual(all.slice(0, 8).map((r) => r.id));
      expect(second.map((r) => r.id)).toEqual(all.slice(8, 16).map((r) => r.id));
    }
    await analyst.page.goto(base + '/analista/sla', { waitUntil: 'networkidle' });
    await expect(analyst.page).toHaveURL(/\/analista\/ordens\?deadline=overdue$/);
    await expect(
      analyst.page.getByRole('button', { name: 'Atrasadas', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await analyst.page.locator('main tbody tr').count()).toBe(
      Math.min(8, expected.overdue.length),
    );
    await expect(analyst.page.locator('aside a[href="/analista/sla"]')).toHaveCount(0);
    await expect(analyst.page.getByRole('link', { name: /Calendário.*simulação/ })).toHaveCount(0);
    for (const [filter, label] of Object.entries({
      today: 'Vencem hoje',
      soon: 'Vencem em até 2h',
      paused: 'Pausadas',
      without: 'Sem prazo de SLA',
    })) {
      await analyst.page.getByRole('button', { name: label, exact: true }).click();
      await expect(analyst.page).toHaveURL(new RegExp(`deadline=${filter}`));
      await expect
        .poll(() => analyst.page.locator('main tbody tr').count())
        .toBe(Math.min(8, expected[filter].length));
    }
    await analyst.page.reload({ waitUntil: 'networkidle' });
    await expect(
      analyst.page.getByRole('button', { name: 'Sem prazo de SLA', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await analyst.page.goto(base + '/analista', { waitUntil: 'networkidle' });
    await expect(analyst.page.locator('a[href="/analista/sla"]')).toHaveCount(0);
    await analyst.page.getByRole('link', { name: 'Ver O.S. atrasadas →', exact: true }).click();
    await expect(analyst.page).toHaveURL(/deadline=overdue/);
    console.log(
      'PASS: filtros reais por prazo e autor antes da paginação, atalho antigo redirecionado, menu simplificado, filtro mantido após recarregar.',
    );

    const manager = await login('Gerente');
    const operation = await rows(manager.context, 'scope=operation&limit=200');
    const operational = operation.filter(active);
    await manager.page.goto(base + '/gerencia/sla', { waitUntil: 'networkidle' });
    await expect(
      manager.page.getByRole('heading', { name: 'Prazos da equipe', exact: true }),
    ).toBeVisible();
    await expect(
      manager.page.getByRole('columnheader', { name: 'Analista responsável', exact: true }),
    ).toBeVisible();
    await expect(
      manager.page.getByRole('columnheader', { name: 'Consumo do SLA', exact: true }),
    ).toHaveCount(0);
    await expect(
      manager.page.getByText('Violações registradas pelo motor', { exact: true }),
    ).toHaveCount(0);
    await expect(manager.page.locator('main .metric-value').first()).toHaveText(
      String(operational.length),
    );
    await manager.page.getByRole('button', { name: 'Filtrar Atrasadas', exact: true }).click();
    await expect(manager.page.getByLabel('Filtrar situação do prazo')).toHaveValue('Atrasada');
    await manager.page
      .getByLabel('Buscar ordem, provedor ou analista')
      .fill('registro-impossivel-nenhum');
    await expect(
      manager.page.getByText('Nenhuma O.S. encontrada para os filtros selecionados.', {
        exact: true,
      }),
    ).toBeVisible();
    await manager.page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await expect(manager.page.locator('main tbody tr')).toHaveCount(
      Math.min(20, operational.length),
    );
    for (const page of [analyst.page, manager.page]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    expect(errors).toEqual([]);
    console.log(
      'PASS: monitor da gerência com dados e responsáveis reais, cards filtráveis, vazio explícito, layout móvel e sem erros de JavaScript/API.',
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
