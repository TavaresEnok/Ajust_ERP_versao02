const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
async function main() {
  const access = JSON.parse(fs.readFileSync(process.env.ERP_REVIEW_ACCESS_FILE, 'utf8'));
  const prisma = new PrismaClient();
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const roles = await prisma.role.findMany({ select: { code: true }, orderBy: { code: 'asc' } });
    expect(roles.map((role) => role.code)).toEqual([
      'analista',
      'cliente',
      'gerente',
      'super_admin',
    ]);
    const beforeUsers = await prisma.user.count();
    const context = await browser.newContext();
    const admin = access.accounts.find((account) => account.role === 'gerente');
    const base = 'http://127.0.0.1:8070';
    const response = await context.request.post(base + '/api/public/auth/login', {
      data: { identifier: admin.email, password: admin.password },
      headers: { origin: base },
    });
    if (!response.ok()) throw new Error('Manager login failed');
    const listed = await (await context.request.get(base + '/api/erp/iam/roles')).json();
    expect(listed.map((role) => role.code).sort()).toEqual(['analista', 'cliente', 'gerente']);
    for (const role of ['tecnico', 'leitura']) {
      const rejected = await context.request.post(base + '/api/erp/iam/users', {
        headers: { origin: base },
        data: {
          name: 'Must not create retired-profile account',
          email: 'must-not-create@retired.invalid',
          password: 'NotARealAccount!2026',
          tenantId: access.tenantId,
          roleCode: role,
        },
      });
      expect(rejected.status()).toBe(400);
    }
    expect(await prisma.user.count()).toBe(beforeUsers);
    const templatesResponse = await context.request.get(
      base + '/api/erp/service-processes/operational/templates',
    );
    if (!templatesResponse.ok()) throw new Error('Historical template projection failed');
    const templates = await templatesResponse.json();
    for (const template of templates)
      for (const definition of [template.definition, template.draft].filter(Boolean)) {
        for (const node of definition.nodes || [])
          expect(
            node.roles.every((role) => ['super_admin', 'gerente', 'analista'].includes(role)),
          ).toBe(true);
      }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/gerencia/tecnicos', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Adicionar integrante', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    if (/Somente leitura|\bTécnico\b/.test(await dialog.innerText()))
      throw new Error('Retired profile offered in user form');
    await page.keyboard.press('Escape');
    const analyst = access.accounts.find((account) => account.portal === '/analista');
    const team = await browser.newContext();
    const signed = await team.request.post(base + '/api/public/auth/login', {
      data: { identifier: analyst.email, password: analyst.password },
      headers: { origin: base },
    });
    if (!signed.ok()) throw new Error('Anderson login failed');
    const identity = await (await team.request.get(base + '/api/erp/auth/me')).json();
    expect(identity.tenant.role).toBe('analista');
    const denied = {};
    for (const route of [
      '/iam/users',
      '/iam/tenants',
      '/audit/logs',
      '/reports/manager-kpi',
      '/workflows',
    ]) {
      denied[route] = (await team.request.get(base + '/api/erp' + route)).status();
      expect(denied[route]).toBe(403);
    }
    const memberships = await prisma.userTenant.findMany({ include: { role: true } });
    expect(
      memberships.every((membership) => !['tecnico', 'leitura'].includes(membership.role.code)),
    ).toBe(true);
    if (errors.length) throw new Error(errors.join('; '));
    console.log(
      JSON.stringify({
        status: 'OK',
        profiles: roles.map((role) => role.code),
        analysts: memberships.filter((member) => member.role.code === 'analista').length,
        retiredAssignmentRejected: true,
        userFormClean: true,
        historicalTemplatesReadable: templates.length,
        andersonRole: identity.tenant.role,
        managerEndpointsDenied: denied,
        usersCreated: 0,
        pageErrors: 0,
      }),
    );
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
