import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.use({ actionTimeout: 15_000, trace: 'retain-on-failure' });

test.describe('Jornada real do analista', () => {
  test.skip(process.env.E2E_ANALYST_JOURNEY !== '1', 'Executar pelo banco descartável da jornada.');
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
      throw new Error('Jornada exige PostgreSQL localhost ajust_ci descartável.');
    db = new PrismaClient();
    const member = await db.userTenant.findFirstOrThrow({
      where: {
        role: { code: 'analista' },
        user: { email: 'analista@example.invalid' },
        tenant: { slug: 'ci' },
      },
      include: { tenant: true },
    });
    tenantId = member.tenantId;
    analystId = member.userId;
    const node = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
      id,
      name,
      kind: 'task',
      orderKey: 'root',
      sector: 'NOC',
      roles: ['super_admin', 'gerente', 'analista'],
      serviceType: 'DNS',
      slaMinutes: 2880,
      requiredFields: ['Resultado técnico'],
      routes: { Concluído: 'fim' },
      closeOn: ['Concluído'],
      waitFor: [],
      position: { x: 100, y: 100 },
      ...extra,
    });
    const end = node('fim', 'Atendimento concluído', {
      kind: 'end',
      routes: {},
      closeOn: [],
      requiredFields: [],
    });
    const definitions = [
      {
        code: 'JORNADA_DNS',
        name: 'Diagnóstico e correção DNS',
        nodes: [
          node('diagnostico', 'Diagnosticar a resolução DNS', {
            requiredFields: ['Diagnóstico e impacto', 'Testes realizados'],
            routes: { 'Precisa de correção': 'correcao', 'Sem falha encontrada': 'fim' },
            closeOn: ['Sem falha encontrada'],
          }),
          node('correcao', 'Corrigir e validar DNS', {
            requiredFields: ['Correção aplicada', 'Validação com o cliente'],
          }),
          end,
        ],
      },
      {
        code: 'JORNADA_PARALELA',
        name: 'Ativação com entregas complementares',
        nodes: [
          node('executar', 'Ativar equipamento', { routes: { Concluído: 'distribuir' } }),
          node('distribuir', 'Abrir entregas complementares', {
            kind: 'fork',
            routes: { monitoramento: 'monitoramento', diagrama: 'diagrama' },
            closeOn: [],
            requiredFields: [],
          }),
          node('monitoramento', 'Validar monitoramento', {
            orderKey: 'monitoramento',
            routes: { Concluído: 'reunir' },
          }),
          node('diagrama', 'Atualizar diagrama', {
            orderKey: 'diagrama',
            routes: { Concluído: 'reunir' },
          }),
          node('reunir', 'Reunir entregas', {
            kind: 'join',
            waitFor: ['monitoramento', 'diagrama'],
            routes: { Pronto: 'fim' },
            closeOn: [],
            requiredFields: [],
          }),
          end,
        ],
      },
    ];
    for (const item of definitions) {
      const definition = {
        engineVersion: 2,
        ...item,
        version: 1,
        description: 'Cenário de verificação do analista',
        sourceTypes: [],
        maxVisits: 5,
        start: item.nodes[0].id,
      };
      await db.serviceProcessTemplate.upsert({
        where: { tenantId_code: { tenantId, code: item.code } },
        create: { tenantId, code: item.code, version: 1, definition, publishedAt: new Date() },
        update: {},
      });
      if (
        !(await db.serviceCatalogItem.findFirst({
          where: { tenantId, workflowTemplateCode: item.code },
        }))
      )
        await db.serviceCatalogItem.create({
          data: { tenantId, name: item.name, category: 'DNS', workflowTemplateCode: item.code },
        });
    }
    if (
      !(await db.workflowRule.findFirst({ where: { tenantId, name: 'CSAT ao fechar na jornada' } }))
    )
      await db.workflowRule.create({
        data: {
          tenantId,
          name: 'CSAT ao fechar na jornada',
          definition: {
            nodes: [
              {
                id: 'inicio',
                type: 'trigger',
                subtype: 'os_fechada',
                config: {},
                position: { x: 0, y: 0 },
              },
              {
                id: 'pesquisa',
                type: 'action',
                subtype: 'action_csat',
                config: {},
                position: { x: 200, y: 0 },
              },
            ],
            edges: [{ id: 'e1', source: 'inicio', target: 'pesquisa' }],
          },
        },
      });
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8070',
    });
    const page = await context.newPage();
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('analista@example.invalid');
    await page.locator('input[type="password"]').fill(process.env.E2E_ROLE_PASSWORD!);
    await page.getByRole('button', { name: /entrar no erp/i }).click();
    await expect(page).toHaveURL(/\/analista$/);
    cookies = await context.cookies();
    await context.close();
  });
  test.afterAll(async () => {
    await db?.$disconnect();
  });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies(cookies);
    await page.goto('/analista');
  });

  async function choose(page: Page, label: string, search?: string) {
    await page.getByLabel(new RegExp(`^${label}(?: [*])?$`)).click();
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
    await page.goto('/analista/ordens/nova');
    if (catalog)
      await page.getByLabel('Serviço do catálogo (opcional)').selectOption({ label: catalog });
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Tipo de serviço/).selectOption('DNS');
    await page
      .getByLabel(/^Descrição/)
      .fill('Cliente relata falha de resolução de nomes. Verificar DNS e confirmar navegação.');
    await choose(page, 'Provedor');
    await choose(page, 'Origem');
    await choose(page, 'Setor');
    await expect(
      page.getByRole('button', { name: 'Analista responsável *', exact: true }),
    ).toContainText('analista');
    await page.getByRole('button', { name: 'Abrir atendimento', exact: true }).click();
    await page.waitForURL(/\/analista\/ocorrencias\/[a-f0-9-]+\/ordens$/);
    const order = await db.serviceOrder.findFirstOrThrow({
      where: { tenantId, title },
      orderBy: { createdAt: 'desc' },
    });
    expect(order.assigneeUserId).toBe(analystId);
    expect(order.processInstanceId).toBeTruthy();
    await page.getByRole('link', { name: /Abrir trabalho/ }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    return order;
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

  test('abre, altera, anota, inicia, pausa, retoma, encerra e reabre sem perder histórico', async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const title = `Jornada simples ${Date.now()}`;
    const order = await createOrder(page, title);
    await page.screenshot({ path: info.outputPath('01-abertura.png'), fullPage: true });
    await expect(
      page.getByText('Executar e registrar o resultado', { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Editar', exact: true }).click();
    await expect(page.getByLabel(/^Prazo/)).toHaveCount(0);
    await page.getByLabel(/^Título/).fill(`${title} revisada`);
    await page
      .getByLabel(/^Descrição/)
      .fill('Escopo revisado: falha ocorre apenas na resolução externa.');
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await expect
      .poll(
        async () => (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).title,
      )
      .toBe(`${title} revisada`);
    await page.getByRole('tab', { name: 'Anotações', exact: true }).click();
    await page
      .getByLabel('Anotação', { exact: true })
      .fill('Cliente confirmou impacto em dois computadores.');
    await page.getByRole('button', { name: 'Adicionar anotação', exact: true }).click();
    await expect(
      page.getByText('Cliente confirmou impacto em dois computadores.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Atendimento', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await expect
      .poll(
        async () => (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).status,
      )
      .toBe('EM_ANALISE');
    await page
      .getByLabel('Evidência: Resultado técnico', { exact: true })
      .fill('DNS ajustado, navegação validada com o cliente.');
    await page.reload();
    await expect(page.getByLabel('Evidência: Resultado técnico', { exact: true })).toHaveValue(
      'DNS ajustado, navegação validada com o cliente.',
    );
    await page.getByText('Outras ações', { exact: true }).click();
    await page.getByRole('button', { name: 'Pausar atendimento', exact: true }).click();
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Aguardando cliente disponibilizar acesso remoto.');
    await page.getByRole('button', { name: 'Pausar atendimento', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Atendimento pausado', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Cliente liberou acesso para validar.');
    await page.getByRole('button', { name: 'Retomar atendimento', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Seu trabalho nesta O.S.', exact: true }),
    ).toBeVisible();
    await finish(page, {
      'Resultado técnico': 'DNS corrigido e consultas internas e externas aprovadas pelo cliente.',
    });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Fluxo de atendimento concluído. Todas as entregas deste fluxo foram encerradas.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await db.occurrence.findUniqueOrThrow({ where: { id: order.occurrenceId! } })).status,
      )
      .toBe('ENCERRADA');
    await page.screenshot({ path: info.outputPath('02-fechamento.png'), fullPage: true });
    await page.getByText('Reabrir O.S.', { exact: true }).click();
    await page
      .getByLabel('Motivo da reabertura')
      .fill('Cliente relatou recorrência após reiniciar o roteador.');
    await page.getByRole('button', { name: 'Reabrir esta O.S.', exact: true }).click();
    await expect
      .poll(
        async () => (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).status,
      )
      .toBe('EM_ANALISE');
    await expect(page.getByLabel('Evidência: Resultado técnico', { exact: true })).toHaveValue('');
    await finish(page, {
      'Resultado técnico': 'Ajuste persistido no roteador e reinicialização validada.',
    });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    const completed = await db.serviceOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { occurrences: true, serviceOrderStatusEvents: true },
    });
    expect(completed.reopenedCount).toBe(1);
    expect(completed.occurrences.some((n) => n.message.includes('recorrência'))).toBe(true);
    expect(completed.serviceOrderStatusEvents.filter((e) => e.toStatus === 'FECHADA')).toHaveLength(
      2,
    );
    await expect
      .poll(async () => db.satisfactionResponse.count({ where: { orderId: order.id } }), {
        timeout: 25_000,
      })
      .toBe(1);
    expect(errors).toEqual([]);
  });

  test('segue o serviço do catálogo, exige evidências e avança etapas sem fechar antes da hora', async ({
    page,
  }, info) => {
    const order = await createOrder(
      page,
      `Jornada DNS ${Date.now()}`,
      'Diagnóstico e correção DNS',
    );
    const flow = await db.serviceProcessInstance.findUniqueOrThrow({
      where: { id: order.processInstanceId! },
    });
    expect(flow.templateCode).toBe('JORNADA_DNS');
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await page
      .getByLabel('Resultado do atendimento', { exact: true })
      .selectOption('Precisa de correção');
    await expect(page.getByRole('button', { name: 'Concluir etapa', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('note').filter({ hasText: 'Próxima etapa do fluxo: Corrigir e validar DNS.' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('03-fluxo-diagnostico.png'), fullPage: true });
    const updated = await finish(
      page,
      {
        'Diagnóstico e impacto': 'Servidor DNS externo sem resposta.',
        'Testes realizados': 'Consultas dig e nslookup com falha no resolvedor externo.',
      },
      'Concluir etapa',
    );
    expect(updated.status).toBe('EM_ANALISE');
    await expect(page.getByLabel('Evidência: Correção aplicada', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Evidência: Diagnóstico e impacto', { exact: true })).toHaveCount(
      0,
    );
    await finish(page, {
      'Correção aplicada': 'Resolvedor alternativo configurado.',
      'Validação com o cliente': 'Cliente aprovou navegação em ambos os computadores.',
    });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await db.serviceProcessInstance.findUniqueOrThrow({ where: { id: flow.id } })).status,
      )
      .toBe('COMPLETED');
    const steps = await db.serviceProcessStep.findMany({
      where: { instanceId: flow.id, nodeId: { in: ['diagnostico', 'correcao'] } },
    });
    expect(steps).toHaveLength(2);
    expect(steps.every((s) => s.status === 'COMPLETED')).toBe(true);
    await expect
      .poll(
        async () =>
          db.workflowExecutionLog.count({
            where: {
              tenantId,
              ruleName: 'CSAT ao fechar na jornada',
              nodeId: '__done__',
              context: { path: ['order', 'id'], equals: order.id },
            },
          }),
        { timeout: 25_000 },
      )
      .toBe(1);
    await page.screenshot({ path: info.outputPath('04-fluxo-concluido.png'), fullPage: true });
  });

  test('gera entregas paralelas e só encerra a ocorrência depois de todas as O.S.', async ({
    page,
  }, info) => {
    const root = await createOrder(
      page,
      `Jornada paralela ${Date.now()}`,
      'Ativação com entregas complementares',
    );
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await finish(page, {
      'Resultado técnico': 'Equipamento ativado, interfaces e conectividade validadas.',
    });
    await expect
      .poll(async () => db.serviceOrder.count({ where: { parentOrderId: root.id } }))
      .toBe(2);
    await expect(
      page.getByRole('heading', { name: 'Próximas entregas do atendimento', exact: true }),
    ).toBeVisible();
    const children = await db.serviceOrder.findMany({
      where: { parentOrderId: root.id },
      orderBy: { title: 'asc' },
    });
    expect(
      (await db.occurrence.findUniqueOrThrow({ where: { id: root.occurrenceId! } })).status,
    ).toBe('EM_EXECUCAO');
    await page.goto(`/analista/ocorrencias/${root.occurrenceId}/ordens`);
    await expect(page.getByRole('status').filter({ hasText: '2 O.S. pendente(s)' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('05-entregas-pendentes.png'), fullPage: true });
    for (const [index, child] of children.entries()) {
      await page.goto(`/analista/ordens/${child.id}`);
      const start = page.getByRole('button', { name: 'Iniciar execução', exact: true });
      await start.click();
      await finish(page, {
        'Resultado técnico': `Entrega complementar ${child.title} realizada e validada.`,
      });
      await expect(
        page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
      ).toBeVisible();
      if (index === 0)
        expect(
          (await db.occurrence.findUniqueOrThrow({ where: { id: root.occurrenceId! } })).status,
        ).toBe('EM_EXECUCAO');
    }
    await expect
      .poll(
        async () =>
          (await db.occurrence.findUniqueOrThrow({ where: { id: root.occurrenceId! } })).status,
      )
      .toBe('ENCERRADA');
    expect(
      (
        await db.serviceProcessInstance.findUniqueOrThrow({
          where: { id: root.processInstanceId! },
        })
      ).status,
    ).toBe('COMPLETED');
  });

  test('encaminha a O.S. com passagem de atendimento e permite ao analista reassumir', async ({
    page,
  }) => {
    const order = await createOrder(page, `Jornada encaminhamento ${Date.now()}`);
    const other = await db.userTenant.findFirstOrThrow({
      where: { tenantId, role: { code: 'gerente' } },
    });
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await page.getByText('Outras ações', { exact: true }).click();
    await page.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    await page.getByLabel('Novo responsável', { exact: true }).selectOption(other.userId);
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Diagnóstico concluído; falta validar o acesso externo com o cliente.');
    await page.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).assigneeUserId,
      )
      .toBe(other.userId);
    await expect(page.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Assumir atendimento', exact: true }).click();
    await expect(page.getByLabel('Novo responsável', { exact: true })).toHaveValue(analystId);
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Cliente retornou; assumo para concluir a validação externa.');
    await page.getByRole('button', { name: 'Encaminhar O.S.', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).assigneeUserId,
      )
      .toBe(analystId);
    await finish(page, {
      'Resultado técnico': 'Acesso externo validado com o cliente após a passagem de atendimento.',
    });
    expect(
      await db.serviceOrderOccurrence.count({
        where: { serviceOrderId: order.id, message: { contains: 'Passagem de atendimento:' } },
      }),
    ).toBe(2);
  });

  test('preserva as evidências quando outro usuário altera a versão da O.S.', async ({ page }) => {
    const order = await createOrder(page, `Jornada concorrência ${Date.now()}`);
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    const field = page.getByLabel('Evidência: Resultado técnico', { exact: true });
    const evidence = 'Diagnóstico e validação preenchidos antes da alteração simultânea.';
    await field.fill(evidence);
    // Outra sessão salva uma alteração após o carregamento da versão nesta aba.
    await db.serviceOrder.update({ where: { id: order.id }, data: { version: { increment: 1 } } });
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/operations$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole('button', { name: 'Encerrar O.S.', exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Seu rascunho foi preservado nesta aba.' }),
    ).toBeVisible();
    await expect(field).toHaveValue(evidence);
    await page
      .getByRole('button', { name: 'Atualizar dados mantendo rascunho', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Atualizar dados mantendo rascunho', exact: true }),
    ).toHaveCount(0);
    await expect(field).toHaveValue(evidence);
    await finish(page, { 'Resultado técnico': evidence });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
  });

  test('agenda e remove o agendamento sem pausar o SLA', async ({ page }) => {
    const order = await createOrder(page, `Jornada agendamento ${Date.now()}`);
    await page.getByText('Outras ações', { exact: true }).click();
    await page.getByRole('button', { name: 'Agendar execução', exact: true }).click();
    const future = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 16);
    await page.getByLabel('Execução agendada', { exact: true }).fill(future);
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Horário combinado com o cliente para disponibilizar acesso.');
    await page.getByRole('button', { name: 'Agendar execução', exact: true }).click();
    await expect
      .poll(async () =>
        (
          await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })
        ).scheduledAt?.toISOString(),
      )
      .toBe(new Date(`${future}:00-03:00`).toISOString());
    const scheduled = await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(scheduled.pausedAt).toBeNull();
    expect(scheduled.deadlineAt).toEqual(order.deadlineAt);
    await page.getByText('Outras ações', { exact: true }).click();
    await page.getByRole('button', { name: 'Remover agendamento', exact: true }).click();
    await page
      .getByLabel('Registro do atendimento', { exact: true })
      .fill('Cliente solicitou execução imediata.');
    await page.getByRole('button', { name: 'Remover agendamento', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).scheduledAt,
      )
      .toBeNull();
  });

  test('segue a saída alternativa do diagnóstico sem executar correção desnecessária', async ({
    page,
  }, info) => {
    const order = await createOrder(
      page,
      `Jornada sem falha ${Date.now()}`,
      'Diagnóstico e correção DNS',
    );
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    await page
      .getByLabel('Resultado do atendimento', { exact: true })
      .selectOption('Sem falha encontrada');
    await finish(page, {
      'Diagnóstico e impacto': 'Serviço operando normalmente; sem impacto atual.',
      'Testes realizados': 'Consultas internas e externas respondem corretamente.',
    });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    expect(
      await db.serviceProcessStep.count({
        where: { instanceId: order.processInstanceId!, nodeId: 'correcao' },
      }),
    ).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('heading', { name: 'Atendimento encerrado', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('06-celular.png'), fullPage: true });
  });

  test('registra solução de alta prioridade atrasada e explica a aprovação pendente', async ({
    page,
  }, info) => {
    const order = await createOrder(page, `Jornada aprovação ${Date.now()}`);
    // Simula somente a passagem do prazo; todas as ações de atendimento continuam pela interface real.
    await db.serviceOrder.update({
      where: { id: order.id },
      data: {
        priority: 'ALTA',
        requiresApproval: true,
        deadlineAt: new Date(Date.now() - 3600_000),
      },
    });
    await page.reload();
    await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
    const updated = await finish(page, {
      'Resultado técnico': 'Correção aplicada e serviço validado após ultrapassar o prazo.',
    });
    expect(updated.status).toBe('RESOLVIDA');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Aguardando aprovação da gestão. O resultado já foi registrado' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Encerrar O.S.', exact: true })).toHaveCount(0);
    expect(
      (await db.occurrence.findUniqueOrThrow({ where: { id: order.occurrenceId! } })).status,
    ).toBe('EM_EXECUCAO');
    await page.screenshot({ path: info.outputPath('07-aprovacao-pendente.png'), fullPage: true });
  });
});
