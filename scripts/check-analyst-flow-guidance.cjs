const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

// Reads the real list. Order mutations below are intercepted in the browser only.
const base = process.env.ERP_REVIEW_BASE_URL || 'http://127.0.0.1:8070';
const orderId = 'aaaaaaaa-1111-4111-8111-111111111111';
const processId = 'bbbbbbbb-2222-4222-8222-222222222222';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
    await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
    const sortedResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/erp/service-orders' && url.searchParams.get('orderBy') === 'priority'
      );
    });
    await page.getByLabel('Ordenar ordens', { exact: true }).selectOption('priority');
    const sorted = await sortedResponse;
    expect(sorted.status()).toBe(200);
    expect(new URL(sorted.url()).searchParams.get('orderDir')).toBe('desc');
    const rank = { BAIXA: 0, NORMAL: 1, ALTA: 2, CRITICA: 3 };
    const rows = await sorted.json();
    expect(rows.map((row) => rank[row.priority])).toEqual(
      rows.map((row) => rank[row.priority]).sort((a, b) => b - a),
    );
    if (await page.getByRole('button', { name: 'Próxima página', exact: true }).isEnabled()) {
      const nextPage = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/api/erp/service-orders' && url.searchParams.get('offset') === '8';
      });
      await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
      expect(new URL((await nextPage).url()).searchParams.get('orderBy')).toBe('priority');
    }
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByLabel('Ordenar ordens', { exact: true })).toHaveValue('priority');
    console.log('PASS: ordenação real por prioridade, persistência e paginação.');

    const order = {
      id: orderId,
      protocol: 'REV-FLUXO',
      title: 'Verificação local do fluxo',
      status: 'EM_ANALISE',
      version: 1,
      priority: 'NORMAL',
      type: 'DNS',
      description: 'Cenário simulado no navegador.',
      processInstanceId: processId,
      provider: 'Provedor de verificação',
      createdAt: new Date().toISOString(),
      occurrences: [],
      attachments: [],
    };
    const task = {
      id: 'diagnostico',
      name: 'Diagnóstico configurado pela gestão',
      kind: 'task',
      orderKey: 'root',
      sector: 'NOC',
      roles: ['analista'],
      requiredFields: ['Diagnóstico e impacto', 'Testes realizados'],
      routes: { Corrigir: 'correcao', Validado: 'fim' },
      closeOn: ['Validado'],
    };
    const process = {
      id: processId,
      status: 'ACTIVE',
      templateVersion: 7,
      definition: {
        name: 'Fluxo de verificação DNS',
        nodes: [
          task,
          { ...task, id: 'correcao', name: 'Correção', routes: { Pronto: 'fim' }, closeOn: [] },
          { id: 'fim', name: 'Fim do fluxo', kind: 'end' },
        ],
      },
      steps: [{ id: 'etapa-1', orderId, nodeId: 'diagnostico', status: 'ACTIVE' }],
    };
    let failProcess = false;
    const commands = [];
    await page.route(`**/api/erp/service-orders/${orderId}`, (route) =>
      route.fulfill({ json: order }),
    );
    await page.route(`**/api/erp/service-processes/operational/${processId}`, (route) =>
      failProcess
        ? route.fulfill({ status: 503, json: { message: 'Fluxo temporariamente indisponível' } })
        : route.fulfill({ json: process }),
    );
    await page.route(`**/api/erp/service-orders/${orderId}/operations`, (route) => {
      const command = route.request().postDataJSON();
      commands.push(command);
      order.version++;
      if (command.outcome === 'Corrigir') process.steps[0].nodeId = 'correcao';
      if (command.outcome === 'Validado') {
        order.status = 'FECHADA';
        process.steps = [];
      }
      return route.fulfill({ json: order });
    });
    const open = () =>
      page.goto(base + '/analista/ordens/' + orderId, { waitUntil: 'networkidle' });
    await open();
    await expect(page.getByRole('tab', { name: 'Atendimento', exact: true })).toBeVisible();
    await expect(
      page.getByText('Fluxo de verificação DNS · versão 7', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Evidência: Diagnóstico e impacto', { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByRole('button', { name: 'Registrar resultado', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Resultado do atendimento').selectOption('Corrigir');
    await expect(
      page.getByRole('note').filter({ hasText: 'Próxima etapa do fluxo: Correção' }),
    ).toBeVisible();
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Diagnóstico e testes registrados.');
    await expect(page.getByRole('button', { name: 'Concluir etapa', exact: true })).toBeDisabled();
    await page
      .getByLabel('Evidência: Diagnóstico e impacto', { exact: true })
      .fill('Falha identificada no DNS.');
    await page
      .getByLabel('Evidência: Testes realizados', { exact: true })
      .fill('Consultas DNS retornaram timeout.');
    await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
    await open();
    await expect(page.getByLabel('Evidência: Diagnóstico e impacto', { exact: true })).toHaveValue(
      'Falha identificada no DNS.',
    );
    await expect(page.getByLabel('Resultado do atendimento')).toHaveValue('Corrigir');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByLabel('Evidência: Testes realizados', { exact: true })).toHaveValue(
      'Consultas DNS retornaram timeout.',
    );
    await page.getByRole('button', { name: 'Concluir etapa', exact: true }).click();
    await expect(page.getByText('Correção', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Registro do atendimento', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Evidência: Diagnóstico e impacto', { exact: true })).toHaveValue(
      '',
    );
    expect(commands[0]).toMatchObject({
      action: 'finish',
      outcome: 'Corrigir',
      expectedVersion: 1,
      evidence: {
        'Diagnóstico e impacto': 'Falha identificada no DNS.',
        'Testes realizados': 'Consultas DNS retornaram timeout.',
      },
    });
    await expect(
      page.getByRole('status').filter({ hasText: 'A O.S. continua no fluxo' }),
    ).toBeVisible();
    console.log('PASS: evidências e versão visíveis; decisão avança para a etapa da mesma O.S.');

    process.steps[0].nodeId = 'diagnostico';
    await open();
    await page.getByLabel('Resultado do atendimento').selectOption('Validado');
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Validação e testes concluídos.');
    await page
      .getByLabel('Evidência: Diagnóstico e impacto', { exact: true })
      .fill('Configuração corrigida.');
    await page
      .getByLabel('Evidência: Testes realizados', { exact: true })
      .fill('Consultas retornam o endereço esperado.');
    await page.getByRole('button', { name: 'Encerrar O.S.', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    expect(commands[1].outcome).toBe('Validado');
    console.log('PASS: encerramento identificado pelo resultado configurado.');

    order.status = 'EM_ANALISE';
    process.steps = [];
    await open();
    await expect(page.getByText(/Nenhuma etapa está liberada/)).toBeVisible();
    await page.getByLabel('Registro do atendimento', { exact: true }).fill('Não deve ser enviado.');
    await expect(
      page.getByRole('button', { name: 'Registrar resultado', exact: true }),
    ).toBeDisabled();
    process.steps = [{ id: 'etapa-1', orderId, nodeId: 'diagnostico', status: 'ACTIVE' }];
    await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
    task.roles = ['gerente'];
    await open();
    await expect(page.getByText(/Esta etapa exige outro perfil/)).toBeVisible();
    await page.getByLabel('Resultado do atendimento').selectOption('Validado');
    await page.getByLabel('Registro do atendimento', { exact: true }).fill('Não deve ser enviado.');
    await expect(page.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toBeDisabled();
    task.roles = ['analista'];
    process.status = 'PAUSED';
    await open();
    await expect(page.getByText(/O fluxo não está liberado/)).toBeVisible();
    await page.getByLabel('Resultado do atendimento').selectOption('Validado');
    await page.getByLabel('Registro do atendimento', { exact: true }).fill('Não deve ser enviado.');
    await expect(page.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
    failProcess = true;
    await open();
    await expect(page.getByText(/Fluxo temporariamente indisponível/)).toBeVisible();
    await page.getByLabel('Registro do atendimento', { exact: true }).fill('Não deve ser enviado.');
    await expect(
      page.getByRole('button', { name: 'Registrar resultado', exact: true }),
    ).toBeDisabled();
    failProcess = false;
    process.status = 'ACTIVE';
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(page.getByText(/Diagnóstico configurado pela gestão/)).toBeVisible();
    await page.getByLabel('Resultado do atendimento').selectOption('Validado');
    await page
      .getByLabel('Evidência: Diagnóstico e impacto', { exact: true })
      .fill('Configuração corrigida.');
    await page
      .getByLabel('Evidência: Testes realizados', { exact: true })
      .fill('Testes de consulta concluídos.');
    await expect(page.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toBeEnabled();
    expect(commands).toHaveLength(2);
    expect(errors).toEqual([]);
    console.log(
      'PASS: dependências, perfil, pausa do fluxo e falha de consulta não permitem conclusão.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
