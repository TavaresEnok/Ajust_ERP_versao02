const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const base = process.env.ERP_REVIEW_BASE_URL || 'http://127.0.0.1:8070';

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
  page.on('pageerror', (error) => errors.push(error.message));
  async function get(path) {
    const response = await context.request.get(base + '/api/erp' + path);
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function mobile() {
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
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
    await page.goto(base + '/analista/ordens?situation=active&sort=deadline', {
      waitUntil: 'networkidle',
    });
    const summary = await get('/service-orders/summary?scope=mine&situation=active');
    await expect(page.locator('main .metric-value').first()).toHaveText(
      String(summary.total).padStart(2, '0'),
    );
    await expect(page.getByRole('button', { name: 'Pendentes', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (summary.total) {
      await page.locator('main tbody tr').first().getByRole('link').first().click();
      await page.locator('main').getByRole('link', { name: 'Minhas ordens', exact: true }).click();
      await expect(page).toHaveURL(/situation=active/);
      await expect(page.getByLabel('Ordenar ordens', { exact: true })).toHaveValue('deadline');
    }
    await page.getByRole('button', { name: 'Concluídas', exact: true }).click();
    const closed = await get('/service-orders/summary?scope=mine&situation=completed');
    await expect(page.locator('main .metric-value').first()).toHaveText(
      String(closed.total).padStart(2, '0'),
    );
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Concluídas', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await mobile();
    console.log(
      'PASS: pendentes/concluídas consultam todas as páginas; filtros preservados ao abrir, voltar e recarregar.',
    );

    const customers = await get('/customers');
    const customer =
      customers.find((row) => row.contacts?.emails?.length || row.contacts?.telefones?.length) ||
      customers[0];
    expect(customer).toBeTruthy();
    const detail = await get('/customers/' + customer.id);
    await page.goto(base + '/analista/provedores/' + customer.id, { waitUntil: 'networkidle' });
    await expect(page.getByRole('region', { name: 'Resumo do provedor' })).toBeVisible();
    const pending = detail.occurrences
      .flatMap((row) => row.serviceOrders)
      .filter((row) => !['RESOLVIDA', 'FECHADA', 'CANCELADA'].includes(row.status));
    await expect(
      page
        .getByRole('region', { name: 'Resumo do provedor' })
        .getByText('O.S. pendentes', { exact: true })
        .locator('..'),
    ).toContainText(String(pending.length));
    await mobile();
    await page.getByRole('link', { name: 'Acessos e orientações técnicas', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Trocar provedor', exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('provider')).toBe(
      customer.tradeName || customer.legalName,
    );
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Trocar provedor', exact: true })).toBeVisible();
    console.log('PASS: contexto do provedor, contatos e acesso técnico direto sem revelar senhas.');

    // Calendar writes are browser fixtures only; no operational event is changed.
    const event = {
      id: 'cccccccc-3333-4333-8333-333333333333',
      title: 'Janela simulada DNS',
      type: 'REUNIAO',
      startAt: '2030-05-16T12:17:00Z',
      endAt: '2030-05-16T12:37:00Z',
      createdById: me.id,
      assigneeId: me.id,
      assignee: { name: 'Analista de verificação' },
      isGlobal: false,
    };
    const generated = {
      ...event,
      id: 'dddddddd-4444-4444-8444-444444444444',
      title: 'Execução · DNS simulado',
      serviceOrderId: 'aaaaaaaa-1111-4111-8111-111111111111',
    };
    const team = {
      ...event,
      id: 'eeeeeeee-5555-4555-8555-555555555555',
      title: 'Alinhamento de equipe simulado',
      isGlobal: true,
    };
    let rows = [event, generated, team],
      conflict = true,
      writes = 0;
    await page.route(/\/api\/erp\/calendar\/events(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: rows });
      writes++;
      const body = route.request().postDataJSON();
      rows = [...rows, { ...event, ...body, id: 'ffffffff-6666-4666-8666-666666666666' }];
      return route.fulfill({ status: 201, json: rows.at(-1) });
    });
    await page.route('**/api/erp/calendar/events/check-conflict', (route) =>
      route.fulfill({
        json: { hasConflict: conflict, conflictingEvents: conflict ? [event] : [] },
      }),
    );
    await page.goto(base + '/analista/agenda?date=2030-05-16', { waitUntil: 'networkidle' });
    await page.getByLabel('Buscar compromissos').fill('DNS');
    await page.getByLabel('Filtrar compromissos').selectOption('orders');
    await expect(page.locator('main button').filter({ hasText: generated.title })).toHaveCount(2);
    await page.locator('main button').filter({ hasText: generated.title }).first().click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Salvar compromisso' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'Abrir ordem de serviço' }),
    ).toHaveAttribute('href', '/analista/ordens/' + generated.serviceOrderId);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Fechar', exact: true })
      .first()
      .click();
    await page.getByLabel('Filtrar compromissos').selectOption('all');
    await page.getByLabel('Buscar compromissos').fill('');
    await page.getByLabel('Visualização da agenda').selectOption('Dia');
    await expect(page.getByText('3 compromissos em 16/05/2030', { exact: true })).toBeVisible();
    await mobile();
    await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Título *', { exact: true })
      .fill('Compromisso simulado sem escrita real');
    await dialog.getByLabel('Início *', { exact: true }).fill('2030-05-16T09:17');
    await dialog.getByLabel('Término (opcional)', { exact: true }).fill('2030-05-16T09:37');
    await dialog.getByLabel('Dia inteiro', { exact: true }).check();
    await expect(dialog.getByLabel('Início *', { exact: true })).toHaveValue('2030-05-16');
    await dialog.getByLabel('Dia inteiro', { exact: true }).uncheck();
    await expect(dialog.getByLabel('Início *', { exact: true })).toHaveValue('2030-05-16T09:17');
    await expect(dialog.getByLabel('Término (opcional)', { exact: true })).toHaveValue(
      '2030-05-16T09:37',
    );
    await dialog.getByRole('button', { name: 'Salvar compromisso', exact: true }).click();
    await expect(dialog.getByRole('list', { name: 'Compromissos em conflito' })).toContainText(
      event.title,
    );
    expect(writes).toBe(0);
    conflict = false;
    await dialog.getByRole('button', { name: 'Salvar compromisso', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toBe(1);
    expect(rows.at(-1).startAt).toBe('2030-05-16T12:17:00.000Z');
    expect(errors).toEqual([]);
    console.log(
      'PASS: busca e visão por dia; O.S. protegida; horários preservados, conflito explicado e envio único.',
    );
    const management = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'America/Los_Angeles',
    });
    const managerPage = await management.newPage();
    managerPage.on('pageerror', (error) => errors.push(error.message));
    await managerPage.goto(base + '/login');
    await expect(async () => {
      await managerPage.getByRole('button', { name: /^Gerente/ }).click();
      await expect(managerPage.locator('#auth-password')).not.toHaveValue('');
    }).toPass({ timeout: 30000 });
    expect(
      (
        await management.request.post(base + '/api/public/auth/login', {
          headers: { origin: base },
          data: {
            identifier: await managerPage.locator('#auth-identifier').inputValue(),
            password: await managerPage.locator('#auth-password').inputValue(),
          },
        })
      ).status(),
    ).toBe(200);
    let failedRefresh = false,
      managerWrites = 0;
    await managerPage.route(/\/api\/erp\/calendar\/events(?:\/all)?(?:\?.*)?$/, (route) => {
      if (route.request().method() === 'GET')
        return failedRefresh
          ? route.fulfill({ status: 503, json: { message: 'Agenda indisponível no teste' } })
          : route.fulfill({ json: [team, generated] });
      managerWrites++;
      const body = route.request().postDataJSON();
      expect(body.isGlobal).toBe(true);
      expect(body.startAt).toBe('2030-05-16T12:17:00.000Z');
      failedRefresh = true;
      return route.fulfill({ status: 201, json: { ...team, ...body } });
    });
    await managerPage.goto(base + '/gerencia/agenda?date=2030-05-16', { waitUntil: 'networkidle' });
    await expect(managerPage.getByLabel('Escopo da agenda')).toHaveValue('team');
    await managerPage.getByLabel('Visualização da agenda').selectOption('Mês');
    await expect(managerPage.getByLabel('Escopo da agenda')).toHaveValue('team');
    await managerPage.locator('main button').filter({ hasText: team.title }).first().click();
    await expect(
      managerPage.getByRole('dialog').getByLabel('Visível para toda a equipe'),
    ).toBeChecked();
    await expect(
      managerPage.getByRole('dialog').locator('select[name="type"] option[value="PLANTAO"]'),
    ).toHaveCount(1);
    await managerPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await managerPage.locator('main button').filter({ hasText: generated.title }).first().click();
    await expect(
      managerPage.getByRole('dialog').getByRole('button', { name: 'Salvar compromisso' }),
    ).toHaveCount(0);
    await managerPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Fechar', exact: true })
      .first()
      .click();
    await managerPage.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    const managerDialog = managerPage.getByRole('dialog');
    await managerDialog.getByLabel('Título *', { exact: true }).fill('Evento global simulado');
    await managerDialog.getByLabel('Visível para toda a equipe').check();
    await managerDialog.getByLabel('Início *', { exact: true }).fill('2030-05-16T09:17');
    await managerDialog.getByRole('button', { name: 'Salvar compromisso', exact: true }).click();
    await expect(managerDialog).toHaveCount(0);
    expect(managerWrites).toBe(1);
    await expect(managerPage.getByText(/Agenda indisponível no teste/)).toBeVisible();
    expect(errors).toEqual([]);
    await management.close();
    console.log(
      'PASS: gestão mantém o escopo entre visões, edita globais, preserva O.S. e não repete gravação após falha de atualização.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
