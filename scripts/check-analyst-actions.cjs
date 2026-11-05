const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
function fixture(action, token) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-w',
      '/workspace',
      'ajust_erp-api-1',
      'node',
      'apps/api/node_modules/tsx/dist/cli.mjs',
      '--tsconfig',
      'apps/api/tsconfig.json',
      'scripts/analyst-review-fixture.ts',
      action,
      token,
    ],
    { encoding: 'utf8' },
  ).trim();
}
async function main() {
  const token = randomUUID(),
    prepared = JSON.parse(fixture('prepare', token));
  const marker = prepared.marker,
    base = 'http://127.0.0.1:8070';
  let browser,
    page,
    stage = '';
  try {
    browser = await chromium.launch({
      executablePath: '/opt/google/chrome/chrome',
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'America/Fortaleza',
    });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/api/erp/') && r.status() >= 400)
        errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    const step = (name) => {
      stage = name;
      console.log('Verificando: ' + name);
    };
    const responseFor = (path, method = 'POST') => {
      const pending = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/erp' + path && r.request().method() === method,
      );
      pending.catch(() => {});
      return pending;
    };
    async function choose(root, field, label) {
      const selected = root.locator(`input[name="${field}"]`);
      await selected.locator('..').getByRole('button').click();
      await root.getByRole('combobox', { name: /^Buscar opções de / }).fill(label);
      await root.getByRole('option', { name: label, exact: true }).click();
    }
    async function fillOrder(root, suffix = '') {
      await root.locator('input[name="title"]').fill('VERIFICAÇÃO ' + token + suffix);
      await root.locator('select[name="type"]').selectOption('DNS');
      await root.locator('textarea[name="description"]').fill(marker);
      await choose(root, 'origin', 'Chat');
      await choose(root, 'sector', 'NOC');
      await choose(root, 'assigneeUserId', 'Anderson Alves');
    }
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
    step('criar atendimento pela interface');
    await page.goto(base + '/analista/ordens/nova', { waitUntil: 'networkidle' });
    await choose(page, 'customerId', prepared.name);
    await fillOrder(page);
    let next = responseFor('/service-orders/occurrences');
    await page.getByRole('button', { name: 'Abrir atendimento', exact: true }).click();
    let response = await next;
    expect(response.status()).toBe(201);
    const occurrence = await response.json(),
      order = occurrence.serviceOrders[0];
    await page.waitForURL(`**/analista/ocorrencias/${occurrence.id}/ordens`);
    await expect(page.getByRole('heading', { name: /Demanda do provedor/ })).toBeVisible();
    step('adicionar uma segunda O.S. à mesma ocorrência');
    await page.getByRole('button', { name: 'Adicionar O.S.', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await fillOrder(dialog, ' complementar');
    next = responseFor('/service-orders');
    await dialog.getByRole('button', { name: 'Adicionar O.S. à ocorrência', exact: true }).click();
    response = await next;
    expect(response.status()).toBe(201);
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Ordens desta ocorrência · 2 O.S./ }),
    ).toBeVisible();
    step('buscar por provedor e filtrar antes da paginação');
    await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Atendimento rápido', exact: true })).toHaveCount(
      0,
    );
    await page.getByLabel('Buscar ordens', { exact: true }).fill(prepared.name);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    await page
      .getByLabel('Filtrar provedor', { exact: true })
      .selectOption({ label: prepared.name });
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.goto(base + '/analista/ordens/' + order.id, { waitUntil: 'networkidle' });
    const work = page.locator('section').filter({
      has: page.getByRole('heading', {
        name: /^(Seu trabalho nesta O.S.|Atendimento pausado|Atendimento encerrado)$/,
      }),
    });
    async function command(action, label, reason) {
      if (action !== 'start' && action !== 'finish' && action !== 'resume') {
        await work.getByText('Outras ações', { exact: true }).click();
        await work.getByRole('button', { name: label, exact: true }).click();
      }
      if (reason) await work.getByRole('textbox', { name: 'Registro do atendimento' }).fill(reason);
      const result = responseFor(`/service-orders/${order.id}/operations`);
      await work.getByRole('button', { name: label, exact: true }).click();
      expect((await result).status()).toBe(201);
      await expect(work.getByRole('button', { name: /Salvando…|Iniciando…/ })).toHaveCount(0);
    }
    step('iniciar, pausar e retomar');
    await command('start', 'Iniciar execução');
    await command('pause', 'Pausar SLA', 'Aguardando acesso do cliente.');
    await expect(work.getByText('Pausada com justificativa', { exact: true })).toBeVisible();
    await command('resume', 'Retomar atendimento', 'Acesso liberado para continuar.');
    await expect(work.getByText('Em andamento', { exact: true })).toBeVisible();
    step('agendar e remover agendamento');
    await work.getByText('Outras ações', { exact: true }).click();
    await work.getByRole('button', { name: 'Agendar execução', exact: true }).click();
    await work.getByLabel('Execução agendada', { exact: true }).fill('2030-01-05T02:00');
    await work
      .getByRole('textbox', { name: 'Registro do atendimento' })
      .fill('Janela de teste no sábado às duas horas.');
    next = responseFor(`/service-orders/${order.id}/operations`);
    await work.getByRole('button', { name: 'Agendar execução', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(work.getByText(/05\/01\/2030/)).toBeVisible();
    await command('unschedule', 'Remover agendamento', 'Janela de teste removida.');
    step('encaminhar a outro responsável');
    await work.getByText('Outras ações', { exact: true }).click();
    await work.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    const assigneeSelect = work.getByLabel('Novo responsável', { exact: true });
    const other = await assigneeSelect
      .locator('option')
      .evaluateAll(
        (options) => options.find((o) => o.value && o.textContent !== 'Anderson Alves')?.value,
      );
    expect(other).toBeTruthy();
    await assigneeSelect.selectOption(other);
    await work
      .getByRole('textbox', { name: 'Registro do atendimento' })
      .fill('Passagem temporária: validar DNS e registrar resultado.');
    next = responseFor(`/service-orders/${order.id}/operations`);
    await work.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(work.getByText(/Passagem temporária: validar DNS/)).toBeVisible();
    await expect(work.getByText(/O encerramento deve ser feito pelo responsável/)).toBeVisible();
    await expect(work.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toBeDisabled();
    await work.getByRole('button', { name: 'Assumir atendimento', exact: true }).click();
    await work
      .getByRole('textbox', { name: 'Registro do atendimento' })
      .fill('Retomada pelo analista responsável pelo teste.');
    next = responseFor(`/service-orders/${order.id}/operations`);
    await work.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    expect((await next).status()).toBe(201);
    step('editar dados da O.S.');
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.locator('input[name="title"]').fill('VERIFICAÇÃO ' + token + ' editada');
    next = responseFor(`/service-orders/${order.id}`, 'PATCH');
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await next).status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'VERIFICAÇÃO ' + token + ' editada', exact: true }),
    ).toBeVisible();
    step('adicionar e editar anotações');
    await page.getByRole('button', { name: 'Anotações', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Anotação', exact: true })
      .fill('Anotação temporária ' + marker);
    next = responseFor(`/service-orders/${order.id}/annotations`);
    await page.getByRole('button', { name: 'Adicionar anotação', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(page.getByRole('textbox', { name: 'Anotação', exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Editar anotação', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Anotação', exact: true })
      .fill('Anotação corrigida ' + marker);
    await page.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
    await expect(page.getByText('Anotação corrigida ' + marker, { exact: true })).toBeVisible();
    step('anexar e baixar arquivo');
    await page.getByRole('button', { name: 'Anexos', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: `review-${token}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(marker),
    });
    next = responseFor(`/service-orders/${order.id}/attachments`);
    await page.getByRole('button', { name: 'Enviar anexos ao ERP', exact: true }).click();
    expect((await next).status()).toBe(201);
    let download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar', exact: true }).click();
    expect(readFileSync(await (await download).path(), 'utf8')).toBe(marker);
    step('encerrar e reabrir sem duplicar botões');
    await page.getByRole('tab', { name: 'Atendimento', exact: true }).click();
    await expect(work.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toHaveCount(1);
    const outcome = work.getByLabel('Resultado do atendimento');
    if (await outcome.count()) await outcome.selectOption({ index: 1 });
    await command('finish', 'Encerrar O.S.', 'DNS validado e funcionamento confirmado.');
    const closed = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }) });
    await closed
      .getByLabel('Motivo da reabertura')
      .fill('Reabertura temporária para verificar o fluxo.');
    next = responseFor(`/service-orders/${order.id}/operations`);
    await closed.getByRole('button', { name: 'Reabrir esta O.S.', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(work.getByText('Em andamento', { exact: true })).toBeVisible();
    step('exportar PDF');
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
    expect(
      readFileSync(await (await download).path())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    step('relatório de turno com O.S. vinculada');
    await page.goto(base + '/analista/relatorios-turno', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Novo relatório', exact: true }).click();
    await page
      .getByLabel('Texto do relatório')
      .fill(marker + ' Expediente de verificação temporária.');
    await page.getByLabel('ID da O.S.').fill('#' + order.protocol);
    await page.getByRole('button', { name: 'Buscar O.S.', exact: true }).click();
    await page
      .getByRole('button', { name: /\+ vincular/ })
      .filter({ hasText: order.protocol })
      .click();
    next = responseFor('/shift-reports');
    await page.getByRole('button', { name: 'Salvar relatório', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(
      page.getByText(marker + ' Expediente de verificação temporária.', { exact: true }),
    ).toBeVisible();
    step('notas com salvamento automático');
    await page.goto(base + '/analista/notas', { waitUntil: 'networkidle' });
    const noteCreated = responseFor('/knowledge/notes');
    await page.getByRole('button', { name: 'Nova nota', exact: true }).click();
    const note = await (await noteCreated).json();
    await expect(page.getByLabel('Título da nota')).toHaveValue('Nova nota');
    const selectedNote = await context.request.patch(base + '/api/erp/knowledge/notes/' + note.id, {
      headers: { origin: base },
      data: { title: 'VERIFICAÇÃO ' + token, content: marker },
    });
    expect(selectedNote.status()).toBe(200);
    await page.reload({ waitUntil: 'networkidle' });
    await page
      .getByRole('button')
      .filter({ hasText: 'VERIFICAÇÃO ' + token })
      .first()
      .click();
    await page.getByLabel('Conteúdo da nota').fill(marker + ' Alteração pelo editor.');
    await expect(page.getByText('Todas as alterações salvas', { exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'networkidle' });
    await page
      .getByRole('button')
      .filter({ hasText: 'VERIFICAÇÃO ' + token })
      .first()
      .click();
    await expect(page.getByLabel('Conteúdo da nota')).toHaveValue(
      marker + ' Alteração pelo editor.',
    );
    step('criar e editar compromisso na agenda');
    await page.goto(base + '/analista/agenda', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    const appointment = page.getByRole('dialog');
    await expect(appointment.getByLabel('Evento global · gerência')).toHaveCount(0);
    await appointment.locator('input[name="title"]').fill(marker);
    const month = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    await appointment.locator('input[name="startAt"]').fill(month + '-25T03:13');
    await appointment.locator('input[name="endAt"]').fill(month + '-25T03:43');
    next = responseFor('/calendar/events');
    await appointment.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await next).status()).toBe(201);
    await expect(appointment).not.toBeVisible();
    await page.getByRole('button').filter({ hasText: marker }).first().click();
    await appointment.locator('textarea[name="description"]').fill('Compromisso de verificação.');
    const event = await context.request.get(base + '/api/erp/calendar/events');
    const eventRow = (await event.json()).find((e) => e.title === marker);
    expect(eventRow).toBeTruthy();
    next = responseFor(`/calendar/events/${eventRow.id}`, 'PATCH');
    await appointment.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await next).status()).toBe(200);
    await expect(appointment).not.toBeVisible();
    step('evento compartilhado somente para consulta');
    await page
      .getByRole('button')
      .filter({ hasText: marker + ' compartilhado' })
      .first()
      .click();
    await expect(appointment.getByText(/Compromisso compartilhado para consulta/)).toBeVisible();
    await expect(
      appointment.getByRole('button', { name: 'Salvar alterações', exact: true }),
    ).toHaveCount(0);
    await expect(
      appointment.getByRole('button', { name: 'Remover compromisso', exact: true }),
    ).toHaveCount(0);
    await appointment.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.goto(base + '/analista/plantao', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Novo plantão', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('Jornadas principais do analista aprovadas sem erros de API ou exceções.');
  } catch (e) {
    if (page)
      await page
        .screenshot({ path: '/tmp/analyst-review-failure.png', fullPage: true })
        .catch(() => {});
    throw new Error(stage + ': ' + e.message);
  } finally {
    if (browser) await browser.close();
    console.log(fixture('cleanup', token));
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
