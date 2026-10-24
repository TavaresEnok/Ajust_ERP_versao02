const { chromium } = require('../apps/web/node_modules/@playwright/test');
async function main() {
  if (!process.env.ERP_UI_LOGIN || !process.env.ERP_UI_PASSWORD)
    throw new Error('Credenciais de conferência devem vir do ambiente.');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    if (process.env.ERP_UI_ONLY_HISTORICAL !== '1') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', (e) => failures.push(e.message));
      page.on('response', (r) => {
        if (r.url().includes('/api/erp/') && r.status() >= 400)
          failures.push(`API ${r.status()} ${new URL(r.url()).pathname}`);
      });
      page.on('console', (m) => {
        if (m.type() === 'error') failures.push(m.text().slice(0, 500));
      });
      page.setDefaultTimeout(30000);
      const login = await context.request.post('http://127.0.0.1:8070/api/public/auth/login', {
        data: { identifier: process.env.ERP_UI_LOGIN, password: process.env.ERP_UI_PASSWORD },
      });
      if (!login.ok()) throw new Error(`Login recusado: ${login.status()}`);
      await page.goto(
        'http://127.0.0.1:8070/gerencia/processos/6317fb3d-ebcf-41fd-aeb0-0ddf176884f9',
      );
      try {
        await page.getByText('1 de 3 · 33%', { exact: true }).waitFor({ timeout: 30000 });
      } catch (error) {
        await page.screenshot({ path: '/tmp/ajust-workflow-error.png', fullPage: true });
        console.log(
          JSON.stringify({
            url: page.url(),
            body: (await page.locator('body').innerText()).slice(0, 7000),
            failures,
          }),
        );
        throw error;
      }
      await page.locator('.react-flow__node').first().waitFor();
      await page.screenshot({ path: '/tmp/ajust-workflow-olt.png', fullPage: true });
      await page.goto('http://127.0.0.1:8070/gerencia/workflows/ATEND_C29DBB5214');
      await page
        .getByRole('button', { name: 'Simular sem criar O.S.', exact: true })
        .waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: 'Simular sem criar O.S.', exact: true }).click();
      await page
        .getByText('Simulação visual · nenhuma gravação operacional', { exact: true })
        .waitFor({ timeout: 30000 });
      await page.screenshot({ path: '/tmp/ajust-workflow-editor.png', fullPage: true });
      await page.getByRole('button', { name: 'Sair da simulação', exact: true }).click();
      await page.getByRole('button', { name: 'Novo fluxo', exact: true }).click();
      await page.getByRole('button', { name: 'Adicionar bloco', exact: true }).click();
      await page
        .getByRole('combobox', { name: 'Selecionar bloco', exact: true })
        .selectOption({ label: 'Nova etapa' });
      // Do not publish: this checks client-side draft editing without writing operational data.
      await page.goto('http://127.0.0.1:8070/gerencia/provedores');
      await page
        .getByRole('columnheader', { name: 'Cliente SGP', exact: true })
        .waitFor({ timeout: 30000 });
      await page.locator('tbody tr').first().waitFor();
      const customerRows = await page.locator('tbody tr').count();
      if (customerRows !== 6) throw new Error(`Cadastros exibidos: ${customerRows}, esperado 6.`);
      await page.screenshot({ path: '/tmp/ajust-provedores-colunas.png', fullPage: true });
      console.log(
        JSON.stringify({
          status: 'UI_OK',
          customerRows,
          oltProgress: '1/3 (33%)',
          simulationOpened: true,
          browserErrors: failures,
        }),
      );
      if (failures.length) throw new Error('A interface registrou erros durante a navegação.');
      await context.close();
    }
    if (process.env.ERP_UI_CHECK_HISTORICAL === '1') {
      const oldContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
      const oldLogin = await oldContext.request.post('http://127.0.0.1:8071/api/auth/login', {
        data: { identifier: process.env.ERP_UI_LOGIN, password: process.env.ERP_UI_PASSWORD },
      });
      if (!oldLogin.ok()) throw new Error(`Login comparação recusado: ${oldLogin.status()}`);
      const oldPage = await oldContext.newPage();
      const oldErrors = [];
      oldPage.on('pageerror', (error) => oldErrors.push(error.message));
      await oldPage.goto('http://127.0.0.1:8071/gerencia');
      await oldPage
        .getByRole('button', { name: 'Provedores', exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await oldPage.getByRole('heading', { name: 'Cadastro de provedores', exact: true }).waitFor();
      const oldTable = oldPage
        .locator('table')
        .filter({ has: oldPage.getByRole('columnheader', { name: 'Razão social', exact: true }) });
      await oldTable.locator('tbody tr').first().waitFor();
      const oldRows = await oldTable.locator('tbody tr').count();
      if (oldRows !== 6) throw new Error(`Provedores na comparação: ${oldRows}, esperado 6.`);
      await oldPage.screenshot({ path: '/tmp/ajust-provedores-comparacao.png', fullPage: true });
      console.log(JSON.stringify({ historicalTableRows: oldRows, browserErrors: oldErrors }));
      if (oldErrors.length) throw new Error('Erros na comparação visual.');
      await oldContext.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
