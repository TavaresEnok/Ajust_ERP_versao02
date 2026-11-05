require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

const base = process.env.ERP_REVIEW_BASE_URL || 'http://127.0.0.1:8070';
const marker = `Verificação de agenda ${Date.now()}`;
const active = (row) => ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'].includes(row.status);

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Los_Angeles',
  });
  const page = await context.newPage();
  const errors = [];
  let createdEventId;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/erp/') && response.status() >= 400)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  async function get(path) {
    const response = await context.request.get(base + '/api/erp' + path);
    expect(response.status(), path).toBe(200);
    return response.json();
  }
  async function checkMobile() {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  try {
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
    const me = await get('/auth/me');
    const own = await get('/service-orders?scope=mine&limit=200');
    await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
    const metrics = page.locator('main .metric-value');
    await expect(metrics.nth(0)).toHaveText(String(own.length).padStart(2, '0'));
    await expect(metrics.nth(1)).toHaveText(String(own.filter(active).length).padStart(2, '0'));
    await expect(metrics.nth(2)).toHaveText(
      String(own.filter((r) => ['RESOLVIDA', 'FECHADA'].includes(r.status)).length).padStart(
        2,
        '0',
      ),
    );
    await expect(page.locator('main table input[type=checkbox]')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Visualização Kanban', exact: true }),
    ).toHaveCount(0);
    const pageCount = Math.ceil(own.length / 8);
    for (let index = 1; index < pageCount; index++)
      await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Próxima página', exact: true })).toBeDisabled();
    await expect(page.locator('main tbody tr')).toHaveCount(own.length % 8 || 8);
    await expect(metrics.nth(0)).toHaveText(String(own.length).padStart(2, '0'));
    const closed = own.find((row) => row.status === 'FECHADA');
    if (closed) {
      await page.goto(base + '/analista/ordens/' + closed.id, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: closed.title, exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Editar', exact: true })).toBeVisible();
    }
    await checkMobile();
    console.log(
      'PASS: indicadores completos, paginação real, controles sem ação removidos e O.S. fechada acessível.',
    );

    const customers = await get('/customers');
    const customer = customers.find((row) => row.tradeName === 'MEGANET') || customers[0];
    const detail = await get('/customers/' + customer.id);
    await page.goto(base + '/analista/provedores', { waitUntil: 'networkidle' });
    await expect(page.locator('main tbody tr')).toHaveCount(Math.min(20, customers.length));
    await page.getByLabel('Buscar cliente', { exact: true }).fill(customer.tradeName);
    await page
      .locator('main tbody')
      .getByRole('link', { name: customer.tradeName, exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Ocorrências do provedor', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dados cadastrais', exact: true })).toHaveCount(
      0,
    );
    const open = detail.occurrences.filter((row) => row.status !== 'ENCERRADA');
    await expect(page.locator('main tbody tr')).toHaveCount(Math.min(10, open.length));
    await page.getByLabel('Situação das ocorrências').selectOption('all');
    await expect(page.locator('main tbody tr')).toHaveCount(
      Math.min(10, detail.occurrences.length),
    );
    if (detail.occurrences[0]) {
      const first = detail.occurrences[0];
      await page
        .getByLabel('Buscar atendimentos do provedor')
        .fill(first.serviceOrders[0]?.protocol || first.number);
      await expect(page.locator('main tbody tr')).toHaveCount(1);
      const link = page.locator('main tbody tr').getByRole('link', { name: /Ver ordens/ });
      await expect(link).toHaveAttribute('href', `/analista/ocorrencias/${first.id}/ordens`);
      await link.click();
      await expect(
        page.getByText('Ordens desta ocorrência', { exact: false }).first(),
      ).toBeVisible();
      await page.goto(base + '/analista/provedores/' + customer.id, { waitUntil: 'networkidle' });
    }
    await page.getByRole('button', { name: 'Cadastro e contatos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Dados cadastrais', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Todas as O.S. do provedor', exact: true }).click();
    await expect(
      page.getByText(`Provedor: ${customer.tradeName} · Filtros aplicados`, { exact: true }),
    ).toBeVisible();
    const providerSummary = await get(
      '/service-orders/summary?scope=operation&provider=' + encodeURIComponent(customer.tradeName),
    );
    await expect(page.locator('main .metric-value').first()).toHaveText(
      String(providerSummary.total).padStart(2, '0'),
    );
    await page.getByRole('button', { name: 'Limpar todos', exact: true }).click();
    await expect(page).not.toHaveURL(/provider=/);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(`Provedor: ${customer.tradeName}`, { exact: false })).toHaveCount(
      0,
    );
    await checkMobile();
    console.log(
      'PASS: provedor abre pelos atendimentos, busca encontra O.S., ocorrência mantém contexto e cadastro fica separado.',
    );

    await page.goto(base + '/analista/agenda', { waitUntil: 'networkidle' });
    await expect(page.getByLabel('Visualização da agenda')).toHaveValue('Lista');
    expect(
      await page.getByLabel('Visualização da agenda').locator('option').allTextContents(),
    ).not.toContain('Conflitos');
    await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Responsável', { exact: true })).toHaveValue(me.id);
    await dialog.getByLabel('Título *', { exact: true }).fill(marker);
    await dialog.getByLabel('Início *', { exact: true }).fill('2030-04-16T09:17');
    await dialog.getByLabel('Término (opcional)', { exact: true }).fill('2030-04-16T09:37');
    const createPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/erp/calendar/events' &&
        response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Salvar compromisso', exact: true }).click();
    const created = await createPromise;
    expect(created.status()).toBe(201);
    const record = await created.json();
    createdEventId = record.id;
    expect(record.startAt).toBe('2030-04-16T12:17:00.000Z');
    expect(record.assigneeId).toBe(me.id);
    await expect(dialog).toHaveCount(0);
    await page.locator('main button').filter({ hasText: marker }).first().click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Início *', { exact: true })).toHaveValue('2030-04-16T09:17');
    await dialog.getByLabel('Término (opcional)', { exact: true }).fill('');
    const editPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/erp/calendar/events/' + createdEventId &&
        response.request().method() === 'PATCH',
    );
    await dialog.getByRole('button', { name: 'Salvar compromisso', exact: true }).click();
    const edited = await editPromise;
    expect(edited.status()).toBe(200);
    expect((await edited.json()).endAt).toBeNull();
    await expect(dialog).toHaveCount(0);
    const persisted = await get(
      '/calendar/events?from=2030-04-01T03:00:00Z&to=2030-05-01T03:00:00Z',
    );
    expect(persisted.some((event) => event.id === createdEventId && event.endAt === null)).toBe(
      true,
    );
    await checkMobile();
    await page.locator('main button').filter({ hasText: marker }).first().click();
    page.once('dialog', (confirmation) => confirmation.accept());
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Excluir compromisso', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    createdEventId = null;
    expect(errors).toEqual([]);
    console.log(
      'PASS: agenda sem UUID/conflitos técnicos, criação/edição/exclusão real, horário de Fortaleza preservado em navegador de outro fuso, nenhum erro de API/JavaScript e layout móvel.',
    );
  } finally {
    if (createdEventId)
      await context.request.delete(base + '/api/erp/calendar/events/' + createdEventId, {
        headers: { origin: base },
      });
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
