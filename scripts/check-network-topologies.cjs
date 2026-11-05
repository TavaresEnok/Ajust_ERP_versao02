const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const token = randomUUID();
const base = 'http://127.0.0.1:8070';
function fixture(mode) {
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
      'scripts/topology-review-fixture.ts',
      mode,
      token,
    ],
    { encoding: 'utf8' },
  ).trim();
}
async function main() {
  let browser;
  try {
    const sample = JSON.parse(fixture('create'));
    browser = await chromium.launch({
      executablePath: '/opt/google/chrome/chrome',
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'America/Fortaleza',
    });
    const page = await context.newPage();
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('https://embed.diagrams.net/'))
        console.log(
          'Draw.io request failed:',
          new URL(request.url()).pathname,
          request.failure()?.errorText,
        );
    });
    page.on('dialog', (d) => d.accept());
    const failures = [];
    page.on('pageerror', (e) => failures.push(e.message));
    await page.goto(base + '/login');
    await expect(async () => {
      await page.getByRole('button', { name: /^Analista · Anderson/ }).click();
      await expect(page.locator('#auth-password')).not.toHaveValue('');
    }).toPass({ timeout: 30000 });
    let login;
    for (let attempt = 0; attempt < 15; attempt++) {
      login = await context.request.post(base + '/api/public/auth/login', {
        headers: { origin: base },
        data: {
          identifier: await page.locator('#auth-identifier').inputValue(),
          password: await page.locator('#auth-password').inputValue(),
        },
      });
      if (![502, 503].includes(login.status())) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (login.status() !== 200)
      throw new Error('Login de verificação: ' + JSON.stringify(await login.json()));
    await page.goto(base + '/analista/ativos', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'Topologia de rede', exact: true }),
    ).toBeVisible();
    const nav = (
      await page.locator('nav[aria-label="Navegação principal"]').innerText()
    ).toLocaleLowerCase('pt-BR');
    expect(nav.indexOf('escala da equipe')).toBeGreaterThan(-1);
    expect(nav.indexOf('escala da equipe')).toBeLessThan(nav.indexOf('conhecimento'));
    await page.getByRole('textbox', { name: 'Buscar provedor' }).fill(sample.name);
    await page.getByRole('link', { name: 'Cadastrar topologia' }).click();
    await expect(page.getByRole('button', { name: 'Importar diagrama existente' })).toBeVisible();
    const xml = `<mxfile><diagram id="rede" name="Rede"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="internet" value="Internet ${token.slice(0, 8)}" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="50" y="50" width="150" height="70" as="geometry"/></mxCell><mxCell id="roteador" value="Roteador de verificação" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="60" y="220" width="170" height="70" as="geometry"/></mxCell><mxCell id="link" edge="1" parent="1" source="internet" target="roteador"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
    await page.locator('input[type=file]').setInputFiles({
      name: 'bookstack-verificacao.drawio',
      mimeType: 'application/xml',
      buffer: Buffer.from(xml),
    });
    const dialog = page.getByRole('dialog', { name: /Editor da topologia/ });
    const save = dialog.getByRole('button', { name: 'Salvar alterações' });
    console.log('Aguardando o editor incorporado do draw.io.');
    await expect(save).toBeEnabled({ timeout: 90000 });
    console.log('Editor draw.io real carregado.');
    const firstSave = page.waitForResponse(
      (r) =>
        r.url().endsWith('/network-topologies/' + sample.customerId) &&
        r.request().method() === 'PUT',
    );
    await save.click();
    expect((await firstSave).status()).toBe(200);
    await expect(
      dialog.getByText('Topologia salva no ERP.', { exact: true }).first(),
    ).toBeAttached();
    await dialog.getByRole('button', { name: 'Fechar editor' }).click();
    await expect(page.getByRole('button', { name: 'Editar topologia' })).toBeVisible();
    const viewer = page.locator('iframe[title^="Topologia —"]');
    await expect(viewer).toBeVisible();
    await expect(page.getByText('Carregando draw.io…')).not.toBeVisible({ timeout: 60000 });
    const saved = await context.request.get(
      base + '/api/erp/network-topologies/' + sample.customerId,
    );
    const stored = await saved.json();
    expect(stored.topology.version).toBe(1);
    expect(stored.topology.diagramXml).toContain('Roteador de verificação');
    expect(stored.topology).not.toHaveProperty('xmlEnc');
    const conflict = await context.request.put(
      base + '/api/erp/network-topologies/' + sample.customerId,
      {
        headers: { origin: base },
        data: { title: 'Tentativa antiga', diagramXml: xml, expectedVersion: 0 },
      },
    );
    expect(conflict.status()).toBe(409);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar .drawio' }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toMatch(/\.drawio$/);
    expect(fs.readFileSync(await file.path(), 'utf8')).toContain('mxGraphModel');
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Histórico da topologia' });
    await expect(history.getByText('Versão 1 · Atual', { exact: true })).toBeVisible();
    await history.getByRole('button', { name: 'Abrir no editor' }).click();
    await expect(save).toBeEnabled({ timeout: 60000 });
    const nextSave = page.waitForResponse(
      (r) =>
        r.url().endsWith('/network-topologies/' + sample.customerId) &&
        r.request().method() === 'PUT',
    );
    await save.click();
    expect((await nextSave).status()).toBe(200);
    await expect(
      dialog.getByText('Topologia salva no ERP.', { exact: true }).first(),
    ).toBeAttached();
    await dialog.getByRole('button', { name: 'Fechar editor' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(/^Versão 2 ·/)).toBeVisible();
    const versions = await context.request.get(
      base + '/api/erp/network-topologies/' + sample.customerId + '/history',
    );
    expect((await versions.json()).map((x) => x.version)).toEqual([2, 1]);
    // A realistic large drawing must cross both the API's regular 100 KB parser
    // limit and the BFF's regular 2 MB limit, using only the topology route allowance.
    const largeXml = xml.replace('<mxfile>', '<mxfile><!--' + 'x'.repeat(2200000) + '-->');
    const largeSave = await context.request.put(
      base + '/api/erp/network-topologies/' + sample.customerId,
      {
        headers: { origin: base },
        data: { title: 'Verificação de diagrama grande', diagramXml: largeXml, expectedVersion: 2 },
      },
    );
    expect(largeSave.status()).toBe(200);
    expect((await largeSave.json()).version).toBe(3);
    await page.goto(base + '/analista/ativos', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    expect(failures).toEqual([]);
    console.log(
      'Provedor → importação draw.io → salvar → visualizar → baixar → histórico → nova versão; conflito e menu/mobile validados.',
    );
  } finally {
    if (browser) await browser.close();
    console.log(fixture('cleanup'));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
