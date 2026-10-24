const { chromium } = require('../apps/web/node_modules/@playwright/test');
async function main() {
  if (!process.env.ERP_UI_LOGIN || !process.env.ERP_UI_PASSWORD)
    throw new Error('Credenciais necessárias no ambiente');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const base = 'http://127.0.0.1:8070';
    async function login() {
      const r = await context.request.post(`${base}/api/public/auth/login`, {
        data: { identifier: process.env.ERP_UI_LOGIN, password: process.env.ERP_UI_PASSWORD },
      });
      if (!r.ok()) throw new Error(`Login HTTP ${r.status()}`);
    }
    for (let i = 0; i < 6; i++) await login();
    async function get(path) {
      const r = await context.request.get(`${base}/api/erp${path}`);
      if (!r.ok()) throw new Error(`${path}: HTTP ${r.status()}`);
      return r.json();
    }
    const processes = await get('/service-processes/operational');
    const source = processes.filter((p) => p.state.mode !== 'DEMO');
    if (source.length !== 120) throw new Error(`Processos de origem: ${source.length}`);
    const counts = {};
    for (const p of source)
      counts[p.occurrence.provider] = (counts[p.occurrence.provider] || 0) + 1;
    if (Object.values(counts).some((n) => n !== 20))
      throw new Error('Amostra diferente de 20 por provedor');
    const credentials = await get('/knowledge/credentials?limit=200');
    const encoded = JSON.stringify(credentials);
    if (encoded.includes('secretEnc') || encoded.includes('sourceNoteEnc'))
      throw new Error('Campo criptográfico exposto na listagem');
    if (credentials.total !== 425) throw new Error(`Credenciais: ${credentials.total}`);
    const reveal = await context.request.post(
      `${base}/api/erp/knowledge/credentials/${credentials.items[0].id}/reveal`,
    );
    if (!reveal.ok()) throw new Error('Revelação auditada indisponível');
    const secret = await reveal.json();
    if (typeof secret.sourceNote !== 'string' || !secret.sourceNote.length)
      throw new Error('Anotação protegida não disponível');
    if (secret.sourceNote.startsWith('sgp-note:v1:'))
      throw new Error('Formato interno da anotação exposto');
    const customers = await get('/customers');
    const meganet = customers.find((c) => c.sourceMetadata.sourceCustomerId === 60);
    const customer = await get(`/customers/${meganet.id}`);
    if (customer.occurrences.flatMap((o) => o.serviceOrders).length !== 20)
      throw new Error('Detalhe do provedor sem as vinte O.S.');
    const catalog = await get('/service-catalog?activeOnly=false');
    if (catalog.length !== 52) throw new Error(`Catálogo: ${catalog.length}`);
    const calendar = await get('/calendar/events/all?from=2020-01-01&to=2027-01-01');
    const scheduled = calendar.filter((e) => e.title.startsWith('SGP-'));
    if (scheduled.length !== 119) throw new Error(`Agendamentos: ${scheduled.length}`);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/gerencia/ajustpedia`);
    await page
      .getByRole('button', { name: 'Copiar comando', exact: true })
      .first()
      .waitFor({ timeout: 60000 });
    await page.screenshot({ path: '/tmp/ajustpedia-restaurada.png', fullPage: true });
    await page.goto(`${base}/gerencia/credenciais`);
    await page.getByRole('combobox', { name: 'Filtrar por provedor' }).selectOption('MEGANET');
    await page
      .getByRole('button', { name: 'Revelar anotação original do SGP', exact: true })
      .first()
      .waitFor();
    // Never screenshot credential contents or print authentication responses.
    await page.goto(`${base}/gerencia/servicos`);
    await page.getByRole('heading', { name: 'Tipos de serviço', exact: true }).waitFor();
    await page.goto(`${base}/gerencia/empresas`);
    await page
      .getByText('Tenant é o ambiente da empresa operadora, não cada provedor atendido.', {
        exact: false,
      })
      .waitFor();
    await page.goto(`${base}/gerencia/provedores/${meganet.id}`);
    await page.getByRole('link', { name: 'SGP-10873', exact: true }).waitFor();
    if (await page.getByRole('button', { name: 'Open Next.js Dev Tools', exact: true }).count())
      throw new Error('Indicador de desenvolvimento ainda visível');
    const old = await context.request.post('http://127.0.0.1:8071/api/auth/login', {
      data: { identifier: process.env.ERP_UI_LOGIN, password: process.env.ERP_UI_PASSWORD },
    });
    if (!old.ok()) throw new Error(`Login na comparação: ${old.status()}`);
    await get('/auth/me');
    const cookies = await context.cookies();
    if (
      !cookies.some((c) => c.name === 'ajust_live_access_token') ||
      !cookies.some((c) => c.name === 'erp_access_token')
    )
      throw new Error('Cookies de sessões não estão isolados');
    if (errors.length) throw new Error(`Erros de página: ${errors.length}`);
    console.log(
      JSON.stringify({
        status: 'OK',
        sourceOrders: 120,
        perProvider: counts,
        credentials: credentials.total,
        catalog: catalog.length,
        scheduled: scheduled.length,
        sixSuccessfulLogins: true,
        cookieIsolation: true,
        protectedSourceNote: true,
        pageErrors: 0,
      }),
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
