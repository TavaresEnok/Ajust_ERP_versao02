require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
// Exercises the real UI/API with an isolated, temporary company. All fixtures are removed.
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { PrismaClient } = require('../apps/api/node_modules/@prisma/client');
const bcrypt = require('../apps/api/node_modules/bcryptjs');
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');

const db = new PrismaClient();
const base = process.env.ERP_CHECK_BASE_URL || 'http://127.0.0.1:8070';
const token = randomUUID();
const password = randomUUID() + randomUUID();
const fixtureUsers = [];
let fixtureTenant;
let browser;
const dateAdd = (date, amount) => {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

async function downloadCalendar(page, name) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  assert(download.suggestedFilename().endsWith('.ics'));
  assert.equal(await download.failure(), null);
  const content = await readFile(await download.path(), 'utf8');
  assert(content.startsWith('BEGIN:VCALENDAR\r\n'));
  assert(content.endsWith('END:VCALENDAR\r\n'));
  assert(content.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));
  return content.replace(/\r\n[ \t]/g, '');
}

async function main() {
  try {
    fixtureTenant = await db.tenant.create({
      data: {
        legalName: 'Fixture de verificação da escala',
        tradeName: 'Escala · verificação isolada',
        taxId: 'fixture-' + token,
        slug: 'roster-check-' + token,
        domain: token + '.invalid',
        timezone: 'America/Sao_Paulo',
        techContactName: 'Verificação',
        techContactEmail: 'check@' + token + '.invalid',
        techContactPhone: '00000000000',
      },
    });
    const roles = await db.role.findMany({ where: { code: { in: ['gerente', 'analista'] } } });
    const hash = await bcrypt.hash(password, 10);
    const createUser = async (name, role) => {
      const user = await db.user.create({
        data: {
          name,
          email: randomUUID() + '@' + token + '.invalid',
          passwordHash: hash,
          tenants: {
            create: {
              tenantId: fixtureTenant.id,
              roleId: roles.find((entry) => entry.code === role).id,
            },
          },
        },
      });
      fixtureUsers.push(user.id);
      return user;
    };
    const manager = await createUser('Escala Teste Gestor', 'gerente');
    const dayA = await createUser('Escala Teste Dia A', 'analista');
    const dayB = await createUser('Escala Teste Dia B', 'analista');
    const night = await createUser('Escala Teste Noite', 'analista');

    browser = await chromium.launch({ headless: true });
    const errors = [];
    async function session(user, portal) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
        locale: 'pt-BR',
        timezoneId: 'America/Fortaleza',
      });
      const response = await context.request.post(base + '/api/public/auth/login', {
        headers: { origin: base },
        data: { identifier: user.email, password },
      });
      assert.equal(response.status(), 200, 'Login da fixture');
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + portal + '/plantao');
      await expect(
        page.getByRole('heading', { name: 'Escala de plantão', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver exemplo', exact: true })).toBeVisible();
      return { context, page };
    }
    const { context, page } = await session(manager, '/gerencia');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: fixtureTenant.timezone }).format(
      new Date(),
    );
    const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
    const monday = dateAdd(today, -(weekday === 0 ? 6 : weekday - 1));
    const saturday = dateAdd(monday, 5);
    const sunday = dateAdd(monday, 6);
    const rosterNote =
      'Passagem de turno da fixture.\nRevisar enlace, rota; atenção às evidências. ' +
      'Descrição de operação com acentuação. '.repeat(10);
    const queryPath = `/api/erp/on-call/roster?from=${monday}&to=${sunday}`;
    const response = await context.request.get(base + queryPath);
    assert.equal(response.status(), 200);
    assert.equal((await response.json()).configured, false);

    await page.getByRole('button', { name: 'Equipes padrão', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Válida a partir de').fill(monday);
    await dialog
      .getByRole('group', { name: /Dia · segunda a sexta/ })
      .getByRole('checkbox', { name: /Escala Teste Dia A/ })
      .check();
    await dialog
      .getByRole('group', { name: /Noite · todos os dias/ })
      .getByRole('checkbox', { name: /Escala Teste Noite/ })
      .check();
    await dialog.getByRole('button', { name: 'Salvar equipes fixas', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver exemplo', exact: true })).toBeVisible();
    let roster = await (await context.request.get(base + queryPath)).json();
    assert.deepEqual(roster.days[0].dayUserIds, [dayA.id]);
    assert.deepEqual(roster.days[5].dayUserIds, []);
    assert(roster.days.every((day) => day.nightUserIds[0] === night.id));

    await page
      .getByRole('button', { name: `Programar equipe diurna de ${saturday}`, exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Escala Teste Dia A/ }).check();
    await dialog.getByRole('checkbox', { name: /Escala Teste Dia B/ }).check();
    await dialog.getByLabel(/Orientações para esta data/).fill(rosterNote);
    await dialog.getByRole('button', { name: 'Salvar equipe da data', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page
      .getByRole('button', { name: `Programar equipe diurna de ${saturday}`, exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Retirar Escala Teste Dia A', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salvar equipe da data', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    roster = await (await context.request.get(base + queryPath)).json();
    assert.deepEqual(roster.days[5].dayUserIds, [dayB.id]);
    assert.deepEqual(roster.days[5].nightUserIds, [night.id]);
    await expect(page.locator('tbody tr')).toHaveCount(8);
    assert(
      roster.history.some(
        (entry) =>
          entry.metadata.previous?.userIds?.includes(dayA.id) &&
          entry.metadata.next?.userIds?.length === 1,
      ),
    );
    await page.locator('summary').filter({ hasText: 'Histórico de alterações' }).click();
    await expect(page.getByText('Saiu: Escala Teste Dia A', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filtrar escala' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Equipe noturna' })).toHaveCount(0);
    const scheduledWeekdays = await page
      .locator('tbody tr')
      .evaluateAll((rows) =>
        rows
          .map((row) => row.querySelector('td')?.textContent || '')
          .filter((date) =>
            /segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira/i.test(date),
          ),
      );
    assert.deepEqual(scheduledWeekdays, [], 'A página lista somente datas especiais');

    await expect(page.getByRole('progressbar', { name: 'Cobertura da escala' })).toHaveAttribute(
      'aria-valuenow',
      '13',
    );
    await page.getByRole('button', { name: 'Filtrar datas sem equipe', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(7);
    await expect(
      page.getByRole('button', { name: `Programar equipe diurna de ${saturday}`, exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Mostrar toda a escala do período', exact: true })
      .click();
    await expect(page.locator('tbody tr')).toHaveCount(8);
    await page.getByRole('button', { name: 'Calendário', exact: true }).click();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.locator('section[aria-label^="Semana de"]')).toHaveCount(4);
    await page
      .getByRole('button', { name: `Programar equipe diurna de ${sunday}`, exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ordenar integrantes').selectOption('count');
    await dialog.getByRole('checkbox', { name: /Escala Teste Dia A/ }).check();
    await page.screenshot({ path: '/tmp/escala-plantao-editor.png', fullPage: true });
    await dialog.getByRole('button', { name: 'Salvar equipe da data', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    roster = await (await context.request.get(base + queryPath)).json();
    assert.deepEqual(roster.days[6].dayUserIds, [dayA.id], 'Edição pelo calendário foi persistida');
    await expect(page.getByRole('progressbar', { name: 'Cobertura da escala' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    await page.screenshot({ path: '/tmp/escala-plantao-gerencia-calendario.png', fullPage: true });
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.screenshot({ path: '/tmp/escala-plantao-gerencia-tabela.png', fullPage: true });
    const teamCalendar = await downloadCalendar(page, 'Baixar calendário');
    assert.equal((teamCalendar.match(/BEGIN:VEVENT\r\n/g) || []).length, 2);

    const stale = await context.request.put(base + `/api/erp/on-call/roster/days/${saturday}`, {
      headers: { origin: base },
      data: { userIds: [dayA.id], expectedVersion: 0 },
    });
    assert.equal(stale.status(), 409, 'Proteção contra gravação desatualizada');
    const foreign = await db.userTenant.findFirst({
      where: { tenantId: { not: fixtureTenant.id } },
      select: { userId: true },
    });
    if (foreign) {
      const denied = await context.request.put(base + `/api/erp/on-call/roster/days/${sunday}`, {
        headers: { origin: base },
        data: { userIds: [foreign.userId], expectedVersion: 0 },
      });
      assert.equal(denied.status(), 400, 'Não permite integrante externo à empresa');
    }

    const analystContext = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const analystLogin = await analystContext.request.post(base + '/api/public/auth/login', {
      headers: { origin: base },
      data: { identifier: dayB.email, password },
    });
    assert.equal(analystLogin.status(), 200);
    const analystPage = await analystContext.newPage();
    analystPage.on('pageerror', (error) => errors.push(error.message));
    await analystPage.goto(base + '/analista/plantao');
    await expect(
      analystPage.getByRole('button', { name: 'Ver exemplo', exact: true }),
    ).toBeVisible();
    await expect(
      analystPage.getByRole('button', { name: 'Equipes padrão', exact: true }),
    ).toHaveCount(0);
    await expect(
      analystPage.getByRole('button', { name: /Programar equipe diurna de/ }),
    ).toHaveCount(0);
    await expect(analystPage.getByRole('combobox', { name: 'Filtrar escala' })).toHaveCount(0);
    await analystPage.getByRole('checkbox', { name: 'Apenas meus plantões' }).check();
    await expect(analystPage.locator('tbody tr')).toHaveCount(1);
    await analystPage
      .getByRole('button', { name: `Ver orientações de ${saturday}`, exact: true })
      .click();
    const details = analystPage.getByRole('dialog');
    await expect(details.getByText(rosterNote, { exact: true })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Salvar equipe da data' })).toHaveCount(0);
    await details.getByRole('button', { name: 'Fechar detalhes', exact: true }).click();
    const personalCalendar = await downloadCalendar(analystPage, 'Baixar meus plantões');
    assert.equal((personalCalendar.match(/BEGIN:VEVENT\r\n/g) || []).length, 1);
    assert(personalCalendar.includes(`DTSTART;VALUE=DATE:${saturday.replace(/-/g, '')}`));
    assert(personalCalendar.includes(`DTEND;VALUE=DATE:${sunday.replace(/-/g, '')}`));
    assert(!personalCalendar.includes(`DTSTART;VALUE=DATE:${sunday.replace(/-/g, '')}`));
    assert(personalCalendar.includes('enlace\\, rota\\;'));
    assert(personalCalendar.includes('fixture.\\nRevisar'));
    await analystPage.getByRole('button', { name: 'Calendário', exact: true }).click();
    await expect(analystPage.getByRole('button', { name: /Ver orientações de/ })).toHaveCount(1);
    await analystPage.getByRole('button', { name: 'Tabela', exact: true }).click();
    await analystPage.getByRole('checkbox', { name: 'Apenas meus plantões' }).uncheck();
    await expect(analystPage.locator('tbody tr')).toHaveCount(8);
    await analystPage
      .getByRole('button', { name: 'Filtrar datas sem equipe', exact: true })
      .click();
    await expect(analystPage.locator('tbody tr')).toHaveCount(6);
    await analystPage.getByRole('button', { name: 'Limpar filtro', exact: true }).click();
    await analystPage.screenshot({ path: '/tmp/escala-plantao-analista.png', fullPage: true });
    const forbidden = await analystContext.request.put(base + '/api/erp/on-call/roster/policy', {
      headers: { origin: base },
      data: {},
    });
    assert.equal(forbidden.status(), 403, 'Analista não edita pela API');

    await analystPage.goto(base + '/analista/agenda');
    const coverage = analystPage.locator('section[aria-label="Equipe na data selecionada"]');
    await expect(coverage).toBeVisible();
    await expect(coverage.getByText(night.name, { exact: true })).toBeVisible();
    await expect(coverage.getByRole('link', { name: /Consultar escala de plantão/ })).toBeVisible();
    await analystPage.goto(base + '/analista/plantao');
    await expect(
      analystPage.getByRole('button', { name: 'Ver exemplo', exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: `Programar equipe diurna de ${saturday}`, exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Remover programação e restaurar padrão' }).click();
    await dialog.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    roster = await (await context.request.get(base + queryPath)).json();
    assert.deepEqual(roster.days[5].dayUserIds, []);
    assert.deepEqual(roster.days[5].nightUserIds, [night.id]);

    const holidayDate = dateAdd(monday, 2);
    await page.getByRole('button', { name: 'Adicionar feriado', exact: true }).click();
    await page.getByLabel('Programar feriado local').fill(holidayDate);
    dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Escala Teste Dia A/ }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Marcar como feriado na escala' }).check();
    await dialog.getByLabel('Nome do feriado').fill('Feriado local de teste');
    await dialog.getByRole('button', { name: 'Salvar equipe da data', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(9);
    roster = await (await context.request.get(base + queryPath)).json();
    assert.equal(roster.days[2].holidayName, 'Feriado local de teste');
    assert.equal(roster.days[2].dayPending, true);
    assert.deepEqual(roster.days[2].nightUserIds, [night.id]);
    await page.screenshot({ path: '/tmp/escala-equipe-gerencia.png', fullPage: true });
    await analystPage.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await analystPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'Página não excede a largura no celular',
    );
    await analystPage.getByRole('button', { name: 'Calendário', exact: true }).click();
    assert.equal(
      await analystPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'Calendário cabe no celular',
    );
    await analystPage.screenshot({ path: '/tmp/escala-plantao-celular.png', fullPage: true });
    assert.deepEqual(errors, [], 'Sem erros JavaScript');
    console.log(
      'Escala: UI/API reais aprovadas — equipes, edição por tabela/calendário, filtros, orientações, exportação .ics, histórico, feriados, versões, permissões e cobertura na Agenda.',
    );
  } finally {
    if (browser) await browser.close();
    if (fixtureTenant) {
      await db.auditLog.deleteMany({ where: { tenantId: fixtureTenant.id } });
      await db.tenant.delete({ where: { id: fixtureTenant.id } });
    }
    if (fixtureUsers.length) await db.user.deleteMany({ where: { id: { in: fixtureUsers } } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
