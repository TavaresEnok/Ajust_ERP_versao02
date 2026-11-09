import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient, type Prisma } from '@prisma/client';

test.use({ actionTimeout: 15_000, trace: 'retain-on-failure' });
test.describe('Jornada real da gerência', () => {
  test.skip(process.env.E2E_MANAGER_JOURNEY !== '1', 'Exige banco descartável da jornada.');
  test.setTimeout(120_000);
  let db: PrismaClient;
  let tenantId: string;
  let analystId: string;
  let cookies: Awaited<ReturnType<BrowserContext['cookies']>>;

  test.beforeAll(async ({ browser }) => {
    const url = new URL(process.env.DATABASE_URL || 'invalid');
    if (
      process.env.NODE_ENV === 'production' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/ajust_ci'
    )
      throw new Error('Jornada exige PostgreSQL local ajust_ci descartável.');
    db = new PrismaClient();
    const member = await db.userTenant.findFirstOrThrow({
      where: { tenant: { slug: 'ci' }, user: { email: 'analista@example.invalid' } },
    });
    tenantId = member.tenantId;
    analystId = member.userId;
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8070',
    });
    const page = await context.newPage();
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('gerente@example.invalid');
    await page.locator('input[type="password"]').fill(process.env.E2E_ROLE_PASSWORD!);
    await page.getByRole('button', { name: /entrar no erp/i }).click();
    await expect(page).toHaveURL(/\/gerencia$/);
    cookies = await context.cookies();
    await context.close();
  });
  test.afterAll(async () => {
    await db?.$disconnect();
  });
  test.beforeEach(async ({ context }) => {
    await context.addCookies(cookies);
  });

  async function choose(page: Page, label: string, search?: string) {
    await page.getByRole('button', { name: `${label} *`, exact: true }).click();
    if (search)
      await page
        .getByRole('combobox', { name: `Buscar opções de ${label}`, exact: true })
        .fill(search);
    await page
      .getByRole('listbox', { name: label, exact: true })
      .getByRole('option')
      .first()
      .click();
  }
  async function createOrder(page: Page, title: string, catalog?: string) {
    await page.goto('/gerencia/ordens/nova');
    if (catalog)
      await page.getByLabel('Serviço do catálogo (opcional)').selectOption({ label: catalog });
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Tipo de serviço/).selectOption('DNS');
    await page
      .getByLabel(/^Descrição/)
      .fill('Gerência registra demanda e acompanha a entrega do analista.');
    for (const label of ['Provedor', 'Origem', 'Setor']) await choose(page, label);
    await choose(page, 'Analista responsável', 'analista');
    await page.getByRole('button', { name: 'Abrir atendimento', exact: true }).click();
    await page.waitForURL(/\/gerencia\/ocorrencias\/[a-f0-9-]+\/ordens$/);
    return db.serviceOrder.findFirstOrThrow({
      where: { tenantId, title },
      orderBy: { createdAt: 'desc' },
    });
  }
  async function finish(page: Page, evidence: Record<string, string>, label = 'Encerrar O.S.') {
    for (const [field, value] of Object.entries(evidence))
      await page.getByLabel(`Evidência: ${field}`, { exact: true }).fill(value);
    const request = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/operations$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole('button', { name: label, exact: true }).click();
    const response = await request;
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  }
  async function bindService(page: Page, name: string, code: string) {
    await page.goto('/gerencia/servicos?tab=catalog');
    await page.getByRole('button', { name: 'Novo tipo de serviço', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome *', { exact: true }).fill(name);
    await dialog.getByLabel('Categoria', { exact: true }).selectOption('DNS');
    await expect(
      dialog
        .getByLabel('Fluxo de atendimento', { exact: true })
        .locator('option')
        .filter({ hasText: name }),
    ).toHaveCount(1);
    await dialog.getByLabel('Fluxo de atendimento', { exact: true }).selectOption(code);
    await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      (await db.serviceCatalogItem.findFirstOrThrow({ where: { tenantId, name } }))
        .workflowTemplateCode,
    ).toBe(code);
  }

  test('as áreas principais carregam com o perfil de gerente', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/') && r.status() >= 400)
        errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    for (const path of [
      '/gerencia',
      '/gerencia/workflows',
      '/gerencia/automacoes',
      '/gerencia/sla',
      '/gerencia/tecnicos',
      '/gerencia/provedores',
      '/gerencia/processos',
      '/gerencia/servicos',
      '/gerencia/politicas-sla',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`01-${path.split('/').pop()}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });

  test('cria, simula, publica e vincula um novo fluxo ao serviço do catálogo', async ({
    page,
  }, info) => {
    const name = `Diagnóstico gerencial ${Date.now()}`;
    await page.goto('/gerencia/workflows');
    await page.getByRole('button', { name: 'Novo fluxo', exact: true }).click();
    await page.getByLabel('Nome do serviço', { exact: true }).fill(name);
    await page.getByLabel('Nome da etapa', { exact: true }).fill('Diagnosticar demanda');
    const requirements = page.getByLabel('Evidências obrigatórias (uma por linha)', {
      exact: true,
    });
    await requirements.fill('Diagnóstico');
    await requirements.press('End');
    await requirements.press('Enter');
    await requirements.pressSequentially('Impacto');
    await expect(requirements).toHaveValue('Diagnóstico\nImpacto');
    await page.getByRole('button', { name: 'Adicionar próxima etapa', exact: true }).click();
    await page.getByLabel('Nome da etapa', { exact: true }).fill('Aplicar e validar correção');
    await requirements.fill('Correção aplicada\nValidação');
    const before = await db.serviceOrder.count({ where: { tenantId } });
    await page.getByRole('button', { name: 'Simular sem criar O.S.', exact: true }).click();
    await page.getByRole('button', { name: 'Concluído', exact: true }).click();
    await page.getByRole('button', { name: 'Concluído', exact: true }).click();
    await expect(page.getByText('Fluxo chegou ao encerramento.', { exact: true })).toBeVisible();
    expect(await db.serviceOrder.count({ where: { tenantId } })).toBe(before);
    await page.getByRole('button', { name: 'Sair da simulação', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect
      .poll(async () =>
        db.serviceProcessTemplate.count({
          where: { tenantId, definition: { path: ['name'], equals: name }, publishedAt: null },
        }),
      )
      .toBe(1);
    await expect(
      page.getByText('Há um rascunho salvo. Publique para aplicá-lo às novas O.S.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
    await expect
      .poll(async () =>
        db.serviceProcessTemplate.count({
          where: {
            tenantId,
            definition: { path: ['name'], equals: name },
            publishedAt: { not: null },
          },
        }),
      )
      .toBe(1);
    const template = await db.serviceProcessTemplate.findFirstOrThrow({
      where: { tenantId, definition: { path: ['name'], equals: name } },
    });
    await bindService(page, name, template.code);
    await page.screenshot({ path: info.outputPath('02-servico-com-fluxo.png'), fullPage: true });
    const order = await createOrder(page, `Execução ${name}`, name);
    const instance = await db.serviceProcessInstance.findUniqueOrThrow({
      where: { id: order.processInstanceId! },
    });
    expect(instance.templateCode).toBe(template.code);
    // A publicação posterior não pode reescrever o fluxo de uma O.S. já aberta.
    await page.goto('/gerencia/workflows');
    await page.getByLabel('Tipo de atendimento', { exact: true }).selectOption(template.code);
    await page.getByLabel('Nome do serviço', { exact: true }).fill(`${name} revisado`);
    await page.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.serviceProcessTemplate.findUniqueOrThrow({ where: { id: template.id } }))
            .version,
      )
      .toBe(template.version + 1);
    expect(
      (await db.serviceProcessInstance.findUniqueOrThrow({ where: { id: instance.id } }))
        .templateVersion,
    ).toBe(instance.templateVersion);
    await page.goto(`/gerencia/ordens/${order.id}`);
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    expect(
      (
        await finish(
          page,
          { Diagnóstico: 'Resolvedor sem resposta.', Impacto: 'Navegação externa indisponível.' },
          'Concluir etapa',
        )
      ).status,
    ).toBe('EM_ANALISE');
    await finish(page, {
      'Correção aplicada': 'Servidor alternativo configurado.',
      Validação: 'Cliente confirmou navegação normal.',
    });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    expect(
      (await db.serviceProcessInstance.findUniqueOrThrow({ where: { id: instance.id } })).status,
    ).toBe('COMPLETED');
  });

  test('monta e executa duas entregas paralelas sem digitar IDs ou conexões', async ({
    page,
  }, info) => {
    const name = `Entregas gerenciais ${Date.now()}`;
    await page.goto('/gerencia/workflows');
    await page.getByRole('button', { name: 'Novo fluxo', exact: true }).click();
    await page.getByLabel('Nome do serviço', { exact: true }).fill(name);
    await page
      .getByRole('button', { name: 'Adicionar duas entregas paralelas', exact: true })
      .click();
    await page
      .getByLabel('Selecionar bloco', { exact: true })
      .selectOption({ label: 'Aguardar as duas entregas' });
    await expect(
      page.getByRole('checkbox', { name: 'Entrega complementar 1', exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Entrega complementar 2', exact: true }),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Simular sem criar O.S.', exact: true }).click();
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Concluído', exact: true }).first().click();
    await expect(page.getByText('Fluxo chegou ao encerramento.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair da simulação', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
    await expect
      .poll(async () =>
        db.serviceProcessTemplate.count({
          where: {
            tenantId,
            publishedAt: { not: null },
            definition: { path: ['name'], equals: name },
          },
        }),
      )
      .toBe(1);
    const template = await db.serviceProcessTemplate.findFirstOrThrow({
      where: { tenantId, definition: { path: ['name'], equals: name } },
    });
    await page.screenshot({ path: info.outputPath('03-fluxo-paralelo.png'), fullPage: true });
    await bindService(page, name, template.code);
    const root = await createOrder(page, `Execução ${name}`, name);
    await page.goto(`/gerencia/ordens/${root.id}`);
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await finish(page, {
      'Resultado técnico': 'Demanda principal executada; aguardando as entregas complementares.',
    });
    await expect(
      page.getByRole('heading', { name: 'Próximas entregas do atendimento', exact: true }),
    ).toBeVisible();
    const children = await db.serviceOrder.findMany({ where: { parentOrderId: root.id } });
    expect(children).toHaveLength(2);
    expect(
      (await db.occurrence.findUniqueOrThrow({ where: { id: root.occurrenceId! } })).status,
    ).toBe('EM_EXECUCAO');
    for (const child of children) {
      await page.goto(`/gerencia/ordens/${child.id}`);
      await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
      await finish(page, { 'Resultado técnico': `${child.title} realizada e validada.` });
    }
    await expect
      .poll(
        async () =>
          (await db.occurrence.findUniqueOrThrow({ where: { id: root.occurrenceId! } })).status,
      )
      .toBe('ENCERRADA');
  });

  test('cria e altera uma automação sem duplicar, dispara pelo fechamento e consulta as execuções', async ({
    page,
  }, info) => {
    const name = `Pesquisa gerencial ${Date.now()}`;
    await page.goto('/gerencia/automacoes/novo');
    await page
      .getByRole('button', { name: 'Pesquisa de satisfação ao fechar O.S.', exact: true })
      .click();
    await page.getByLabel('Nome *', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Salvar automação', exact: true }).click();
    await page.waitForURL(/\/gerencia\/automacoes\/[a-f0-9-]{36}$/);
    const rule = await db.workflowRule.findFirstOrThrow({ where: { tenantId, name } });
    expect(rule.enabled).toBe(false);
    await page
      .getByLabel('Descrição', { exact: true })
      .fill('Pesquisa após conclusão validada da O.S.');
    await page.getByLabel('Ativar regra no servidor', { exact: true }).check();
    await page.getByRole('button', { name: 'Salvar automação', exact: true }).click();
    await expect
      .poll(
        async () => (await db.workflowRule.findUniqueOrThrow({ where: { id: rule.id } })).enabled,
      )
      .toBe(true);
    expect(await db.workflowRule.count({ where: { tenantId, name } })).toBe(1);
    const order = await createOrder(page, `Disparo ${name}`);
    await page.goto(`/gerencia/ordens/${order.id}`);
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await finish(page, { 'Resultado técnico': 'Atendimento concluído e validado com o provedor.' });
    await expect
      .poll(
        async () =>
          db.workflowExecutionLog.count({
            where: {
              tenantId,
              ruleId: rule.id,
              nodeId: '__done__',
              context: { path: ['order', 'id'], equals: order.id },
            },
          }),
        { timeout: 25_000 },
      )
      .toBe(1);
    expect(await db.satisfactionResponse.count({ where: { orderId: order.id } })).toBe(1);
    await page.goto(`/gerencia/automacoes/${rule.id}`);
    await page.getByRole('tab', { name: 'Execução e logs', exact: true }).click();
    const executions = page.getByRole('region', {
      name: 'Execuções recentes da automação',
      exact: true,
    });
    await expect(
      executions
        .getByRole('row')
        .filter({ hasText: 'Execução concluída' })
        .filter({ hasText: order.protocol }),
    ).toContainText('Concluído');
    await page.screenshot({ path: info.outputPath('04-automacao-executada.png'), fullPage: true });
  });

  test('registros de execução respeitam o perfil e o tenant e omitem os dados internos', async ({
    page,
    browser,
  }) => {
    await page.goto('/gerencia');
    const rule = await db.workflowRule.findFirstOrThrow({ where: { tenantId } });
    const response = await page.request.get(`/api/erp/workflows/${rule.id}/executions`);
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.items.length).toBeLessThanOrEqual(50);
    for (const entry of payload.items) {
      expect(entry).not.toHaveProperty('context');
      expect(entry).not.toHaveProperty('result');
    }
    const foreignTenant = await db.tenant.create({
      data: {
        legalName: 'Outra empresa da jornada',
        tradeName: 'Outra empresa',
        taxId: `teste-${Date.now()}`,
        slug: `outro-${Date.now()}`,
        domain: `outro-${Date.now()}.invalid`,
        techContactName: 'Teste',
        techContactEmail: 'teste@example.invalid',
        techContactPhone: '',
      },
    });
    const foreignRule = await db.workflowRule.create({
      data: {
        tenantId: foreignTenant.id,
        name: 'Regra de outro tenant',
        definition: rule.definition!,
      },
    });
    expect(
      (await page.request.get(`/api/erp/workflows/${foreignRule.id}/executions`)).status(),
    ).toBe(404);
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    try {
      const analystPage = await context.newPage();
      await analystPage.goto('/login');
      await analystPage.locator('input[name="identifier"]').fill('analista@example.invalid');
      await analystPage.locator('input[type="password"]').fill(process.env.E2E_ROLE_PASSWORD!);
      await analystPage.getByRole('button', { name: /entrar no erp/i }).click();
      await expect(analystPage).toHaveURL(/\/analista$/);
      expect(
        (await analystPage.request.get(`/api/erp/workflows/${rule.id}/executions`)).status(),
      ).toBe(403);
    } finally {
      await context.close();
    }
  });

  test('configura prazo por serviço e simula o cálculo', async ({ page }) => {
    await page.goto('/gerencia/politicas-sla');
    await expect(page.getByRole('tab', { name: 'Políticas', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: 'Nova política', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tipo de serviço *', { exact: true }).selectOption('DNS');
    await dialog.getByLabel(/^Prazo de resolução/).fill('4');
    await dialog.getByRole('button', { name: /salvar/i }).click();
    await expect
      .poll(
        async () =>
          (await db.slaPolicy.findFirst({ where: { tenantId, serviceOrderType: 'DNS' } }))?.hours,
      )
      .toBe(4);
    await page.getByRole('tab', { name: 'Simulação', exact: true }).click();
    await page.getByLabel('Prioridade *', { exact: true }).selectOption('NORMAL');
    await page.getByLabel('Tipo de serviço', { exact: true }).selectOption('DNS');
    await page.getByRole('button', { name: 'Calcular no motor SLA', exact: true }).click();
    await expect(page.getByText('4 horas úteis', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Políticas', exact: true }).click();
    await page
      .getByRole('row')
      .filter({ hasText: 'DNS' })
      .getByRole('button', { name: 'Editar', exact: true })
      .click();
    await dialog.getByLabel(/^Prazo de resolução/).fill('6');
    await dialog.getByRole('button', { name: /salvar/i }).click();
    await expect
      .poll(
        async () =>
          (await db.slaPolicy.findFirst({ where: { tenantId, serviceOrderType: 'DNS' } }))?.hours,
      )
      .toBe(6);
  });

  test('calcula o SLA individual e explica a amostra, transferências e ausência de base', async ({
    page,
  }, info) => {
    const source = await db.user.findUniqueOrThrow({ where: { id: analystId } });
    const role = await db.role.findFirstOrThrow({ where: { code: 'analista' } });
    const suffix = Date.now();
    const createAnalyst = (name: string) =>
      db.user.create({
        data: {
          name,
          email: `sla-${name}-${suffix}@example.invalid`,
          passwordHash: source.passwordHash,
          tenants: { create: { tenantId, roleId: role.id } },
        },
      });
    const person = await createAnalyst('Amostra');
    const recipient = await createAnalyst('Transferido');
    const createdAt = new Date('2026-01-01T08:00:00Z');
    const deadlineAt = new Date('2026-01-01T10:00:00Z');
    const onTime = new Date('2026-01-01T09:00:00Z');
    const late = new Date('2026-01-01T11:00:00Z');
    const fixture = (
      key: string,
      changes: Partial<Prisma.ServiceOrderCreateManyInput> = {},
    ): Prisma.ServiceOrderCreateManyInput => ({
      tenantId,
      assigneeUserId: person.id,
      protocol: `SLA-${suffix}-${key}`,
      type: 'DNS',
      priority: 'NORMAL',
      status: 'FECHADA',
      title: `SLA ${key}`,
      description: 'Amostra isolada para validar o indicador individual.',
      createdAt,
      deadlineAt,
      resolvedAt: onTime,
      closedAt: late,
      ...changes,
    });
    const foreignTenant = await db.tenant.create({
      data: {
        legalName: 'Isolamento SLA',
        tradeName: 'Isolamento SLA',
        taxId: `sla-${suffix}`,
        slug: `sla-${suffix}`,
        domain: `sla-${suffix}.invalid`,
        techContactName: 'Teste',
        techContactEmail: 'teste@example.invalid',
        techContactPhone: '',
      },
    });
    await db.serviceOrder.createMany({
      data: [
        fixture('prazo'), // Resolution, rather than administrative closure, meets the deadline.
        fixture('atrasada', { sourceSystem: 'SGP', resolvedAt: late }),
        fixture('limite', { status: 'RESOLVIDA', resolvedAt: null, closedAt: deadlineAt }),
        fixture('nao-elegivel', { slaEligible: false }),
        fixture('cancelada', { status: 'CANCELADA' }),
        fixture('aberta', { status: 'ABERTA', resolvedAt: null, closedAt: null }),
        fixture('reaberta', { status: 'EM_ANALISE' }),
        fixture('sem-data', { resolvedAt: null, closedAt: null }),
        fixture('invalida', { resolvedAt: new Date('2026-01-01T07:00:00Z') }),
        fixture('futura', { resolvedAt: new Date('2999-01-01T09:00:00Z') }),
        fixture('demonstracao', { sourceMetadata: { demonstration: true } }),
        fixture('excluida', { deletedAt: late }),
        fixture('outro-tenant', { tenantId: foreignTenant.id }),
      ],
    });
    const response = await page.request.get('/api/erp/iam/users');
    expect(response.status()).toBe(200);
    const members = await response.json();
    expect(members.find((row: { userId: string }) => row.userId === person.id)).toMatchObject({
      activeOrderCount: 2,
      completedOrderCount: 7,
      slaEvaluatedCount: 3,
      slaMetCount: 2,
      slaPercentage: 66.7,
    });
    expect(members.find((row: { userId: string }) => row.userId === recipient.id)).toMatchObject({
      slaEvaluatedCount: 0,
      slaPercentage: null,
    });
    await page.goto('/gerencia/tecnicos');
    const personRow = page.getByRole('row').filter({ hasText: person.email });
    const recipientRow = page.getByRole('row').filter({ hasText: recipient.email });
    await expect(personRow).toContainText('66,7%');
    await expect(personRow).toContainText('2 de 3 O.S. no prazo');
    await expect(recipientRow).toContainText('Sem base');
    await page.goto(`/gerencia/tecnicos/${person.id}`);
    await expect(page.getByText('66,7%', { exact: true })).toBeVisible();
    await expect(page.getByText('2 de 3 O.S. no prazo', { exact: true })).toBeVisible();
    await expect(page.getByText(/Transferências podem alterar este indicador/)).toBeVisible();
    await page.screenshot({ path: info.outputPath('08-sla-individual.png'), fullPage: true });
    await db.serviceOrder.update({
      where: { tenantId_protocol: { tenantId, protocol: `SLA-${suffix}-atrasada` } },
      data: { assigneeUserId: recipient.id },
    });
    await page.goto('/gerencia/tecnicos');
    await expect(personRow).toContainText('100%');
    await expect(personRow).toContainText('2 de 2 O.S. no prazo');
    await expect(recipientRow).toContainText('0%');
    await expect(recipientRow).toContainText('0 de 1 O.S. no prazo');
    await db.serviceOrder.updateMany({
      where: { tenantId, assigneeUserId: person.id },
      data: { slaEligible: false },
    });
    await page.getByRole('button', { name: 'Atualizar equipe', exact: true }).click();
    await expect(personRow).toContainText('Sem base');
    await expect(personRow).toContainText('Nenhuma O.S. elegível concluída');
  });

  test('acompanha prazo, responsável e provedor a partir de uma O.S. real', async ({
    page,
  }, info) => {
    const title = `Acompanhamento gerencial ${Date.now()}`;
    const order = await createOrder(page, title);
    expect(order.assigneeUserId).toBe(analystId);
    await db.serviceOrder.update({
      where: { id: order.id },
      data: { deadlineAt: new Date(Date.now() - 3600_000) },
    });
    await page.goto('/gerencia/tecnicos');
    const expectedActive = await db.serviceOrder.count({
      where: {
        tenantId,
        assigneeUserId: analystId,
        deletedAt: null,
        status: { notIn: ['FECHADA', 'RESOLVIDA', 'CANCELADA'] },
      },
    });
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'analista@example.invalid' })
        .getByRole('cell')
        .nth(3),
    ).toHaveText(String(expectedActive));
    await page.goto('/gerencia/sla');
    await page.getByRole('button', { name: 'Filtrar Atrasadas', exact: true }).click();
    await page
      .getByRole('searchbox', { name: 'Buscar ordem, provedor ou analista', exact: true })
      .fill(title);
    await expect(page.getByRole('row').filter({ hasText: title })).toContainText('analista');
    await page.getByRole('link', { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`/gerencia/ordens/${order.id}$`));
    await page.goto(`/gerencia/tecnicos/${analystId}`);
    await page.getByRole('button', { name: 'Ordens de serviço', exact: true }).click();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    const occurrence = await db.occurrence.findUniqueOrThrow({
      where: { id: order.occurrenceId! },
    });
    await page.goto(`/gerencia/provedores/${occurrence.customerId}`);
    await expect(page.getByRole('region', { name: 'Resumo do provedor' })).toContainText(
      'O.S. atrasadas',
    );
    await page.screenshot({
      path: info.outputPath('06-provedor-atendimentos.png'),
      fullPage: true,
    });
  });

  test('fluxos e acompanhamento de SLA continuam acessíveis em celular', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['workflows', 'sla', 'tecnicos', 'provedores']) {
      await page.goto(`/gerencia/${route}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        route,
      ).toBe(true);
      await page.screenshot({ path: info.outputPath(`07-celular-${route}.png`), fullPage: true });
    }
  });
});
