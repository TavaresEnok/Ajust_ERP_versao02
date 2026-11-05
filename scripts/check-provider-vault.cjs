const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox'],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const base = 'http://127.0.0.1:8070';
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass(/dark/);
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
    await page.goto(base + '/analista/credenciais', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Qual provedor você vai atender?' }),
    ).toBeVisible({ timeout: 60000 });
    const listed = await context.request.get(
      base + '/api/erp/knowledge/credentials/providers?limit=200',
    );
    expect(listed.ok()).toBe(true);
    const payload = await listed.json();
    if ((Array.isArray(payload) ? payload : payload.items || []).length === 0) {
      console.log(
        'Tela inicial e consulta autorizada validadas. Cofre vazio: nenhum acesso real para testar detalhes.',
      );
      return;
    }
    await expect(
      page.getByRole('button', { name: 'Visualizar provedores em cartões', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /MEGANET.*→/ })).toBeVisible();
    await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /MEGANET.*→/ })).toBeVisible();
    await page.screenshot({ path: '/tmp/ajust-vault-providers-cards.png' });
    const font = await page
      .getByText('Última alteração', { exact: true })
      .locator('..')
      .locator('p')
      .nth(1)
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(font).toBeLessThanOrEqual(14);
    await page
      .getByRole('button', { name: 'Visualizar provedores em tabela', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Visualizar provedores em tabela', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: '/tmp/ajust-vault-providers-table.png' });
    await page.getByRole('button', { name: /MEGANET.*→/ }).click();
    await page.getByRole('button', { name: 'Ver acesso', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Orientações', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Orientações e particularidades deste acesso' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Atividade deste cadastro', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Cadastro criado', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('tab', { name: 'Acessos', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Consultar dados adicionais', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Original', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Adicionar forma de acesso', exact: true }),
    ).toHaveCount(0);
    const drawer = page.getByRole('dialog').filter({
      has: page.getByRole('button', { name: 'Consultar dados adicionais', exact: true }),
    });
    await expect(drawer).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(bounds.x).toBeGreaterThan(300);
    await expect.poll(async () => Math.abs((await drawer.boundingBox()).y)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: '/tmp/ajust-vault-drawer.png', fullPage: true });
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Confirmar exclusão', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar detalhes', exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Equipamentos e sistemas', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cartões', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cartões', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: '/tmp/ajust-vault-cards.png' });
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '/tmp/ajust-vault-table.png' });
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Acessos · MEGANET', exact: true }),
    ).toBeVisible();
    const records = await context.request.get(
      base + '/api/erp/knowledge/credentials?provider=MEGANET&limit=200',
    );
    expect(records.ok()).toBe(true);
    const inventory = await records.json();
    expect(inventory.items.length).toBeGreaterThanOrEqual(65);
    for (const row of inventory.items) {
      for (const forbidden of [
        'secretEnc',
        'sourceNoteEnc',
        'protectedContentEnc',
        'protectedContent',
        'secret',
        'totpSecretEnc',
        'totpSecret',
      ])
        expect(row).not.toHaveProperty(forbidden);
    }
    expect(
      inventory.items.filter(
        (r) => r.equipmentType === 'SW' && r.equipmentName.startsWith('Switch Datacom —'),
      ),
    ).toHaveLength(4);
    const summaryResponse = await context.request.get(
      base + '/api/erp/knowledge/credentials/summary',
    );
    expect(summaryResponse.ok()).toBe(true);
    expect((await summaryResponse.json()).total).toBeGreaterThanOrEqual(61);
    await page.getByRole('button', { name: 'Gerador de senhas', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Gerador de senhas', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Tamanho da senha', exact: true })).toHaveValue(
      '18',
    );
    await page.getByRole('button', { name: 'Gerar nova combinação', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto(base + '/analista/ajustpedia', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Ajustpedia', exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Categorias da Ajustpedia', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Artigo E2E Atualizado', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'ver sinal no sw ou roteador huawei', exact: true }),
    ).toBeVisible();
    const articlesResponse = await context.request.get(base + '/api/erp/knowledge/articles');
    expect(articlesResponse.ok()).toBe(true);
    const articlesPayload = await articlesResponse.json();
    const articles = Array.isArray(articlesPayload) ? articlesPayload : articlesPayload.items;
    expect(articles.some((article) => article.id === '59411729-3108-4b76-988c-eb6f6cd783a7')).toBe(
      true,
    );
    expect(articles.some((article) => /E2E/.test(article.title))).toBe(false);
    await page.getByRole('button', { name: 'Compacto', exact: true }).click();
    await page.screenshot({ path: '/tmp/ajustpedia-redesign.png' });
    await page.goto(base + '/analista/credenciais', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /MEGANET.*→/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Cartões', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Equipamentos e sistemas', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '/tmp/ajust-vault-mobile.png' });
    console.log('Provedor → equipamento → orientações validado; nenhuma senha revelada.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
