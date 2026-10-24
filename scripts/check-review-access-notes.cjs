const fs = require('node:fs');
const { chromium } = require('../apps/web/node_modules/@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { expect } = require('../apps/web/node_modules/@playwright/test');

async function main() {
  const access = JSON.parse(fs.readFileSync(process.env.ERP_REVIEW_ACCESS_FILE, 'utf8'));
  const base = 'http://127.0.0.1:8070';
  const prisma = new PrismaClient();
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const createdNotes = [];
  const contexts = [];
  const results = [];
  let admin;
  try {
    for (const account of access.accounts) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      contexts.push(context);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/login', { waitUntil: 'networkidle' });
      await page.locator('#auth-identifier').fill(account.email);
      await page.locator('#auth-password').fill(account.password);
      await page.getByRole('button', { name: 'Entrar no ERP', exact: true }).click();
      await page.waitForURL(base + account.portal, { timeout: 45000 });
      await page.waitForLoadState('networkidle');
      const me = await context.request.get(base + '/api/erp/auth/me');
      if (!me.ok()) throw new Error(account.role + ': authenticated identity failed');
      const identity = await me.json();
      if (identity.tenant.id !== access.tenantId || identity.tenant.role !== account.role)
        throw new Error('Wrong authenticated role/workspace');
      if (account.role === 'gerente') admin = { context, page };
      if (account.role === 'analista') {
        await page.goto(base + '/analista/ordens', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Minhas ordens', exact: true }).waitFor();
        const assigned = await prisma.serviceOrder.count({
          where: { assigneeUserId: account.id, deletedAt: null },
        });
        if (!assigned) throw new Error('Imported analyst has no real assigned orders');
      }
      if (account.role === 'cliente') {
        if (identity.customerId !== access.customerId)
          throw new Error('Missing trusted customer linkage');
        await page.getByRole('heading', { name: 'Painel de ocorrências', exact: true }).waitFor();
        const own = await context.request.get(base + '/api/erp/customer-portal');
        const payload = await own.json();
        if (!own.ok() || !/meganet/i.test(payload.customer.tradeName) || payload.total !== 20)
          throw new Error('Incorrect Meganet cohort');
        const expected = await prisma.serviceOrder.findMany({
          where: {
            tenantId: access.tenantId,
            deletedAt: null,
            isCustomerVisible: true,
            occurrence: { customerId: access.customerId, deletedAt: null },
          },
          select: { id: true },
        });
        if (payload.orders.some((order) => !expected.find((item) => item.id === order.id)))
          throw new Error('Cross-customer list exposure');
        const other = await prisma.serviceOrder.findFirstOrThrow({
          where: {
            tenantId: access.tenantId,
            deletedAt: null,
            occurrence: { customerId: { not: access.customerId } },
          },
          select: { id: true },
        });
        if (
          (
            await context.request.get(base + '/api/erp/customer-portal/orders/' + other.id)
          ).status() !== 404
        )
          throw new Error('Cross-customer detail exposed');
        for (const path of [
          '/service-orders',
          '/customers',
          '/calendar/events/all',
          '/knowledge/credentials',
          '/reports/operational-health',
          '/iam/users',
          '/auth/socket-token',
        ]) {
          if ((await context.request.get(base + '/api/erp' + path)).status() !== 403)
            throw new Error('Legacy endpoint exposed: ' + path);
        }
        const ownDetail = await context.request.get(
          base + '/api/erp/customer-portal/orders/' + payload.orders[0].id,
        );
        const details = await ownDetail.json();
        if (
          !ownDetail.ok() ||
          'sourceMetadata' in details ||
          'internalNotes' in details ||
          'attachments' in details
        )
          throw new Error('Unsafe detail fields');
        const privateIds = await prisma.serviceOrderOccurrence.findMany({
          where: { serviceOrderId: details.id, isCustomerVisible: false },
          select: { id: true },
        });
        if (
          details.occurrences.some((item) =>
            privateIds.find((privateItem) => privateItem.id === item.id),
          )
        )
          throw new Error('Internal comment exposed');
        const activeResponse = page.waitForResponse(
          (r) => r.url().includes('status=active') && r.status() === 200,
        );
        await page.getByRole('button', { name: 'Ativas', exact: true }).click();
        await activeResponse;
        const closedResponse = page.waitForResponse(
          (r) => r.url().includes('status=closed') && r.status() === 200,
        );
        await page.getByRole('button', { name: 'Fechadas', exact: true }).click();
        await closedResponse;
        await page.getByRole('link', { name: 'Ver detalhes', exact: true }).first().waitFor();
        await page.screenshot({ path: 'docs/analise-sgp/portal-cliente-meganet-premium.png' });
        await page.getByRole('link', { name: 'Ver detalhes', exact: true }).first().click();
        await page.getByRole('heading', { name: 'Histórico compartilhado', exact: true }).waitFor();
        await page.goto(base + '/cliente/agenda', { waitUntil: 'networkidle' });
        await page
          .getByRole('heading', { name: 'Agenda dos meus atendimentos', exact: true })
          .waitFor();
        await page.goto(base + '/cliente/configuracoes/meu-perfil', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Sessões e segurança', exact: true }).waitFor();
        await page.goto(base + '/cliente/notas', { waitUntil: 'networkidle' });
        const foreignNote = await prisma.note.findFirst({
          where: { tenantId: access.tenantId, authorUserId: { not: account.id } },
          select: { id: true },
        });
        if (
          foreignNote &&
          (
            await context.request.patch(base + '/api/erp/knowledge/notes/' + foreignNote.id, {
              data: { title: 'Must not change' },
              headers: { origin: base },
            })
          ).status() !== 403
        )
          throw new Error('Foreign personal note writable');
        if (errors.length) throw new Error(errors.join('; '));
      }
      results.push({
        role: account.role,
        login: 'OK',
        portal: account.portal,
        pageErrors: errors.length,
      });
    }
    const { context, page } = admin;
    await page.goto(base + '/gerencia/notas', { waitUntil: 'networkidle' });
    const make = async (title) => {
      const response = await context.request.post(base + '/api/erp/knowledge/notes', {
        data: {
          title,
          content:
            'Anotação temporária da verificação de interface; será removida ao fim do teste.',
        },
        headers: { origin: base },
      });
      if (!response.ok()) throw new Error('Could not create verification note');
      const note = await response.json();
      createdNotes.push(note.id);
      return note;
    };
    const first = await make('Validação temporária A');
    const second = await make('Validação temporária B');
    await page.reload({ waitUntil: 'networkidle' });
    const list = page.getByRole('complementary', { name: 'Lista de notas' });
    await list.getByRole('button', { name: /Validação temporária A/ }).click();
    await page
      .getByRole('textbox', { name: 'Conteúdo da nota', exact: true })
      .fill('Edição A, preservada ao trocar rapidamente de nota.');
    await list.getByRole('button', { name: /Validação temporária B/ }).click();
    await page
      .getByRole('textbox', { name: 'Conteúdo da nota', exact: true })
      .fill('Edição B, independente da nota A.');
    await expect
      .poll(async () => (await prisma.note.findUnique({ where: { id: first.id } })).content)
      .toBe('Edição A, preservada ao trocar rapidamente de nota.');
    await expect
      .poll(async () => (await prisma.note.findUnique({ where: { id: second.id } })).content)
      .toBe('Edição B, independente da nota A.');
    await expect(
      page.getByRole('status').filter({ hasText: 'Todas as alterações salvas' }),
    ).toBeVisible();
    const endpoint = '**/api/erp/knowledge/notes/' + second.id;
    await page.route(endpoint, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Falha temporária simulada no teste' }),
          })
        : route.continue(),
    );
    await page
      .getByRole('textbox', { name: 'Conteúdo da nota', exact: true })
      .fill('Edição preservada durante falha simulada.');
    await page.getByRole('alert').filter({ hasText: 'Falha temporária simulada' }).waitFor();
    await expect(page.getByRole('textbox', { name: 'Conteúdo da nota', exact: true })).toHaveValue(
      'Edição preservada durante falha simulada.',
    );
    await page.unroute(endpoint);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect
      .poll(async () => (await prisma.note.findUnique({ where: { id: second.id } })).content)
      .toBe('Edição preservada durante falha simulada.');
    await page.getByRole('button', { name: 'Fixar nota', exact: true }).click();
    await page.getByRole('button', { name: 'Desafixar nota', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fixadas', exact: true }).click();
    await expect(list.getByRole('button', { name: /Validação temporária B/ })).toBeVisible();
    await page.screenshot({ path: 'docs/analise-sgp/minhas-notas-editor-premium.png' });
    await page.getByRole('button', { name: 'Excluir nota', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    if (!(await prisma.note.findUnique({ where: { id: second.id } })))
      throw new Error('Cancel deleted note');
    await page.getByRole('button', { name: 'Excluir nota', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
    await expect.poll(async () => prisma.note.findUnique({ where: { id: second.id } })).toBeNull();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    await list.getByRole('button', { name: /Validação temporária A/ }).click();
    await expect(
      page.getByRole('textbox', { name: 'Conteúdo da nota', exact: true }),
    ).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2))
      throw new Error('Mobile horizontal overflow');
    if ((await prisma.tenant.count()) !== 1) throw new Error('Unexpected tenant created');
    console.log(
      JSON.stringify({
        status: 'OK',
        profiles: results,
        sameAjustWorkspace: true,
        meganetOrders: 20,
        crossCustomerBlocked: true,
        internalCommentsHidden: true,
        notes: {
          autosave: true,
          rapidSwitch: true,
          errorAndRetry: true,
          pin: true,
          deleteConfirmation: true,
          mobile: true,
        },
      }),
    );
  } finally {
    for (const id of createdNotes) {
      if (admin)
        await admin.context.request.delete(base + '/api/erp/knowledge/notes/' + id, {
          headers: { origin: base },
        });
    }
    await browser.close();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
