import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function ensureSeedData(prisma: PrismaClient) {
  const roles = [
    { code: 'super_admin', name: 'Super Admin', isGlobal: true },
    { code: 'gerente', name: 'Gerente', isGlobal: false },
    { code: 'analista', name: 'Analista', isGlobal: false },
    { code: 'tecnico', name: 'Tecnico', isGlobal: false },
    { code: 'cliente', name: 'Cliente', isGlobal: false },
    { code: 'leitura', name: 'Leitura', isGlobal: false },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, isGlobal: role.isGlobal },
      create: role,
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'ajust-demo' },
    update: {},
    create: {
      legalName: 'Ajust Consultoria LTDA',
      tradeName: 'Ajust Demo',
      taxId: '00000000000100',
      slug: 'ajust-demo',
      domain: 'ajust-demo.local',
      timezone: 'America/Sao_Paulo',
      techContactName: 'NOC Ajust',
      techContactEmail: 'noc@ajust.local',
      techContactPhone: '+55-11-99999-0000',
      status: 'ACTIVE',
    },
  });

  const superAdminRole = await prisma.role.findUnique({ where: { code: 'super_admin' } });
  if (!superAdminRole) {
    throw new Error('super_admin role missing');
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@ajust.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Ajust Super Admin',
      passwordHash,
      status: 'ACTIVE',
      twoFactorEnabled: true,
    },
    create: {
      name: 'Ajust Super Admin',
      email,
      passwordHash,
      status: 'ACTIVE',
      twoFactorEnabled: true,
    },
  });

  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: { roleId: superAdminRole.id },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      roleId: superAdminRole.id,
    },
  });

  return { email, password, tenantId: tenant.id };
}

function expectStatus(actual: number, expected: number[]) {
  assert.ok(
    expected.includes(actual),
    `unexpected status ${actual}, expected one of ${expected.join(', ')}`,
  );
}

async function main() {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
  process.env.JWT_REFRESH_TTL_DAYS = process.env.JWT_REFRESH_TTL_DAYS || '7';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  await app.init();

  const prisma = new PrismaClient();

  try {
    const seed = await ensureSeedData(prisma);

    /* ════════════════ AUTH: login / me / logout / re-login ════════════════ */

    const login1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: seed.email, password: seed.password });

    expectStatus(login1.status, [200, 201]);
    assert.ok(login1.body.accessToken, 'access token missing on login');
    assert.ok(login1.body.refreshToken, 'refresh token missing on login');
    assert.ok(login1.body.sessionId, 'session id missing on login');

    const accessToken1: string = login1.body.accessToken;
    const sessionId1: string = login1.body.sessionId;

    const meBeforeLogout = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken1}`);

    assert.equal(meBeforeLogout.status, 200, 'me before logout should return 200');

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken1}`)
      .send({ sessionId: sessionId1 });

    expectStatus(logout.status, [200, 201]);

    const meAfterLogout = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken1}`);

    assert.equal(meAfterLogout.status, 401, 'access token must be blocked after session logout');

    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: seed.email, password: seed.password });

    expectStatus(login2.status, [200, 201]);

    const accessToken2: string = login2.body.accessToken;

    console.log('[e2e] auth: login/logout/session ✓');

    /* ════════════════ PROFILE: update name / password ════════════════ */

    const updateName = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${accessToken2}`)
      .send({ name: 'Admin E2E Updated' });

    assert.equal(updateName.status, 200, 'update name should return 200');
    assert.equal(updateName.body.name, 'Admin E2E Updated', 'name should be updated');

    // restore original name
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${accessToken2}`)
      .send({ name: 'Ajust Super Admin' });

    // test password change flow
    const newPwd = 'NewAdmin@999';
    const changePwd = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${accessToken2}`)
      .send({ currentPassword: seed.password, newPassword: newPwd });

    assert.equal(changePwd.status, 200, 'password change should return 200');

    // can login with new password
    const login3 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: seed.email, password: newPwd });

    expectStatus(login3.status, [200, 201]);

    // restore original password
    const token3: string = login3.body.accessToken;
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token3}`)
      .send({ currentPassword: newPwd, newPassword: seed.password });

    // re-login with original password for remaining tests
    const login4 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: seed.email, password: seed.password });
    expectStatus(login4.status, [200, 201]);
    const accessToken: string = login4.body.accessToken;

    console.log('[e2e] profile: update name/password ✓');

    /* ════════════════ IXC SETUP ════════════════ */

    const configureIxc = await request(app.getHttpServer())
      .post('/integrations/ixc/configure')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        baseUrl: 'https://ixc.example.test',
        webhookSecret: 'ixc_e2e_secret',
        apiToken: 'ixc_e2e_token',
      });

    expectStatus(configureIxc.status, [200, 201]);

    console.log('[e2e] ixc: configure ✓');

    /* ════════════════ OCCURRENCE: create / list / get / edit / annotate ════════════════ */

    const occCreate = await request(app.getHttpServer())
      .post('/service-orders/occurrences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'ProviderTest',
        type: 'Rompimento',
        sector: 'NOC',
        origin: 'Monitoramento',
        openedByName: 'E2E Test',
        analystResponsible: 'Analista E2E',
        description: 'Ocorrência de teste e2e para validar fluxo',
        firstOrder: {
          type: 'ROMPIMENTO',
          description: 'OS vinculada ao criar ocorrência',
        },
      });

    expectStatus(occCreate.status, [200, 201]);
    assert.ok(occCreate.body.id, 'occurrence id must exist');
    assert.ok(occCreate.body.number, 'occurrence number must exist');
    const occId: string = occCreate.body.id;

    const occList = await request(app.getHttpServer())
      .get(`/service-orders/occurrences?limit=10`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(occList.status, 200, 'list occurrences should return 200');
    assert.ok(Array.isArray(occList.body), 'occurrences must be array');
    assert.ok(occList.body.length >= 1, 'must have at least 1 occurrence');

    const occGet = await request(app.getHttpServer())
      .get(`/service-orders/occurrences/${occId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(occGet.status, 200, 'get occurrence by id should return 200');
    assert.equal(occGet.body.id, occId, 'returned occurrence id must match');

    const occPatch = await request(app.getHttpServer())
      .patch(`/service-orders/occurrences/${occId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Atualizada via e2e' });

    assert.equal(occPatch.status, 200, 'patch occurrence should return 200');

    const occAnnotate = await request(app.getHttpServer())
      .post(`/service-orders/occurrences/${occId}/annotations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Anotação de teste e2e' });

    expectStatus(occAnnotate.status, [200, 201]);
    assert.ok(occAnnotate.body.id, 'annotation id must exist');

    // verify annotation appears in get
    const occWithAnnotation = await request(app.getHttpServer())
      .get(`/service-orders/occurrences/${occId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.ok(
      Array.isArray(occWithAnnotation.body.annotations) &&
        occWithAnnotation.body.annotations.length >= 1,
      'occurrence must have at least 1 annotation',
    );

    console.log('[e2e] occurrence: create/list/get/patch/annotate ✓');

    /* ════════════════ ORDER IN OCCURRENCE ════════════════ */

    const occOrder = await request(app.getHttpServer())
      .post(`/service-orders/occurrences/${occId}/orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'LENTIDAO',
        description: 'OS adicional criada dentro da ocorrência',
      });

    expectStatus(occOrder.status, [200, 201]);
    assert.ok(occOrder.body.id, 'order in occurrence id must exist');

    console.log('[e2e] occurrence-order: create in occurrence ✓');

    /* ════════════════ SERVICE ORDER: create / summary / list / export ════════════════ */

    const delayedDeadline = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const createdOrder = await request(app.getHttpServer())
      .post('/service-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'ROMPIMENTO',
        priority: 'CRITICA',
        title: 'OS e2e atraso',
        description: 'Teste de aprovacao obrigatoria',
        deadlineAt: delayedDeadline,
      });

    expectStatus(createdOrder.status, [200, 201]);
    const orderId: string = createdOrder.body.id;
    assert.ok(orderId, 'created order id missing');

    const summary = await request(app.getHttpServer())
      .get(`/service-orders/summary?status=ABERTA`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(summary.status, 200, 'summary endpoint should return 200');
    assert.ok(typeof summary.body.total === 'number', 'summary.total must be a number');
    assert.ok(summary.body.byPriority, 'summary.byPriority must exist');
    assert.ok(summary.body.byType, 'summary.byType must exist');
    assert.ok(Array.isArray(summary.body.topAssignees), 'summary.topAssignees must be array');

    const filteredList = await request(app.getHttpServer())
      .get(
        `/service-orders?priority=CRITICA&type=ROMPIMENTO&search=atraso&orderBy=deadlineAt&orderDir=asc`,
      )
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(filteredList.status, 200, 'filtered list should return 200');
    assert.ok(Array.isArray(filteredList.body), 'filtered list should return array');

    const csvExport = await request(app.getHttpServer())
      .get(
        `/service-orders/export/csv?priority=CRITICA&type=ROMPIMENTO&search=atraso&orderBy=deadlineAt&orderDir=asc`,
      )
      .set('Authorization', `Bearer ${accessToken}`);

    if (csvExport.status !== 200) console.log('CSV ERROR:', csvExport.body);
    assert.equal(csvExport.status, 200, 'csv export should return 200');
    assert.match(
      csvExport.headers['content-type'] || '',
      /text\/csv/,
      'csv export should return text/csv',
    );
    assert.match(
      csvExport.text || '',
      /protocol,externalProtocol,title,description/,
      'csv export header missing',
    );

    const exportHistory = await request(app.getHttpServer())
      .get(`/service-orders/export/history?limit=5`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(exportHistory.status, 200, 'export history should return 200');
    assert.ok(Array.isArray(exportHistory.body), 'export history should return array');
    assert.ok(exportHistory.body.length >= 1, 'export history should contain at least one item');
    assert.equal(
      exportHistory.body[0].fileAvailable,
      true,
      'export history must mark file available',
    );

    const exportId: string = exportHistory.body[0].id;
    const exportDownload = await request(app.getHttpServer())
      .get(`/service-orders/export/${exportId}/download`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(exportDownload.status, 200, 'export download should return 200');
    assert.match(
      exportDownload.headers['content-type'] || '',
      /text\/csv/,
      'export download should return text/csv',
    );
    assert.match(
      exportDownload.text || '',
      /protocol,externalProtocol,title,description/,
      'downloaded csv header missing',
    );

    console.log('[e2e] service-orders: create/summary/list/export/download ✓');

    /* ════════════════ ATTACHMENT ════════════════ */

    const uploadAttachment = await request(app.getHttpServer())
      .post(`/service-orders/${orderId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('files', Buffer.from('anexo de teste e2e'), 'e2e.txt');

    expectStatus(uploadAttachment.status, [200, 201]);
    assert.equal(
      Array.isArray(uploadAttachment.body),
      true,
      'attachment response should be an array',
    );
    assert.equal(uploadAttachment.body.length, 1, 'one attachment should be created');

    console.log('[e2e] attachment: upload ✓');

    /* ════════════════ WORKFLOW: transitions / approval ════════════════ */

    const toAnalysis = await request(app.getHttpServer())
      .patch(`/service-orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toStatus: 'EM_ANALISE', reason: 'triagem inicial' });

    assert.equal(toAnalysis.status, 200, 'ABERTA -> EM_ANALISE should be allowed');

    const toResolved = await request(app.getHttpServer())
      .patch(`/service-orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toStatus: 'RESOLVIDA', reason: 'acao aplicada' });

    assert.equal(toResolved.status, 200, 'EM_ANALISE -> RESOLVIDA should be allowed');

    const closeWithoutApproval = await request(app.getHttpServer())
      .patch(`/service-orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toStatus: 'FECHADA', reason: 'fechamento sem aprovacao' });

    assert.equal(
      closeWithoutApproval.status,
      403,
      'closing delayed CRITICA should require approval',
    );

    const approve = await request(app.getHttpServer())
      .post(`/service-orders/${orderId}/approvals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ decision: 'APPROVED', reason: 'aprovado para encerramento' });

    expectStatus(approve.status, [200, 201]);

    const closeWithApproval = await request(app.getHttpServer())
      .patch(`/service-orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toStatus: 'FECHADA', reason: 'encerramento apos aprovacao' });

    assert.equal(closeWithApproval.status, 200, 'closing with approval should pass');

    console.log('[e2e] workflow: transitions/approval ✓');

    /* ════════════════ WEBHOOK IXC ════════════════ */

    const webhookPayloadObject = {
      tenantId: seed.tenantId,
      eventType: 'ticket.updated',
      externalProtocol: `IXC-${randomUUID()}`,
      status: 'em analise',
      title: 'Webhook IXC E2E',
      description: 'Criada via webhook no teste e2e',
      payload: { source: 'e2e' },
    };
    const webhookPayload = JSON.stringify(webhookPayloadObject);
    const signature = createHmac('sha256', 'ixc_e2e_secret').update(webhookPayload).digest('hex');

    const webhookOrder = await request(app.getHttpServer())
      .post('/integrations/ixc/webhook')
      .set('x-ixc-signature', signature)
      .set('content-type', 'application/json')
      .send(webhookPayload);

    expectStatus(webhookOrder.status, [200, 201]);
    assert.equal(webhookOrder.body.processed, true, 'IXC webhook should be processed');

    console.log('[e2e] ixc: webhook ✓');

    /* ════════════════ KNOWLEDGE: articles ════════════════ */

    const articleCreate = await request(app.getHttpServer())
      .post('/knowledge/articles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Artigo E2E de Teste',
        content: 'Conteúdo do artigo criado automaticamente no e2e.',
        tags: ['e2e', 'teste'],
        isPublished: true,
      });

    expectStatus(articleCreate.status, [200, 201]);
    assert.ok(articleCreate.body.id, 'article id must exist');
    const articleId: string = articleCreate.body.id;

    const articleList = await request(app.getHttpServer())
      .get(`/knowledge/articles`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(articleList.status, 200, 'list articles should return 200');
    assert.ok(Array.isArray(articleList.body), 'articles must be array');
    assert.ok(articleList.body.length >= 1, 'must have at least 1 article');

    const articleUpdate = await request(app.getHttpServer())
      .patch(`/knowledge/articles/${articleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Artigo E2E Atualizado' });

    assert.equal(articleUpdate.status, 200, 'update article should return 200');
    assert.equal(
      articleUpdate.body.title,
      'Artigo E2E Atualizado',
      'article title should be updated',
    );

    console.log('[e2e] knowledge: articles create/list/update ✓');

    /* ════════════════ KNOWLEDGE: credentials ════════════════ */

    const credCreate = await request(app.getHttpServer())
      .post('/knowledge/credentials')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'IXC Soft',
        equipmentType: 'OLT',
        equipmentName: 'Huawei MA5800',
        environment: 'production',
        host: 'https://ixc.provedor.com.br',
        username: 'admin_e2e',
        secret: 'super-secret-token-e2e',
        notes: 'Credencial de teste e2e',
      });

    expectStatus(credCreate.status, [200, 201]);
    assert.ok(credCreate.body.id, 'credential id must exist');
    const credId: string = credCreate.body.id;

    const credList = await request(app.getHttpServer())
      .get(`/knowledge/credentials`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(credList.status, 200, 'list credentials should return 200');
    assert.ok(Array.isArray(credList.body.items), 'credentials.items must be array');
    assert.ok(typeof credList.body.total === 'number', 'credentials.total must be number');
    const createdCredentialOnList = (
      credList.body.items as Array<{ id: string; equipmentType?: string; equipmentName?: string }>
    ).find((item) => item.id === credId);
    assert.ok(createdCredentialOnList, 'created credential must appear on list');
    assert.equal(
      createdCredentialOnList?.equipmentType,
      'OLT',
      'credential equipmentType must match',
    );
    assert.equal(
      createdCredentialOnList?.equipmentName,
      'Huawei MA5800',
      'credential equipmentName must match',
    );

    const providerList = await request(app.getHttpServer())
      .get(`/knowledge/credentials/providers`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(providerList.status, 200, 'list credential providers should return 200');
    assert.ok(Array.isArray(providerList.body.items), 'provider list must be array');
    assert.ok(providerList.body.items.length >= 1, 'provider list must have at least 1 provider');

    const credReveal = await request(app.getHttpServer())
      .post(`/knowledge/credentials/${credId}/reveal`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(credReveal.status, 201, 'reveal credential should return 201');
    assert.equal(credReveal.body.secret, 'super-secret-token-e2e', 'revealed secret must match');
    assert.equal(credReveal.body.equipmentType, 'OLT', 'revealed equipmentType must match');
    assert.equal(
      credReveal.body.equipmentName,
      'Huawei MA5800',
      'revealed equipmentName must match',
    );

    console.log('[e2e] knowledge: credentials create/list/reveal ✓');

    /* ════════════════ KNOWLEDGE: notes ════════════════ */

    const noteCreate = await request(app.getHttpServer())
      .post('/knowledge/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Nota E2E',
        content: 'Conteúdo da nota e2e',
        pinned: true,
      });

    expectStatus(noteCreate.status, [200, 201]);
    assert.ok(noteCreate.body.id, 'note id must exist');
    const noteId: string = noteCreate.body.id;

    const noteList = await request(app.getHttpServer())
      .get(`/knowledge/notes`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(noteList.status, 200, 'list notes should return 200');
    assert.ok(Array.isArray(noteList.body), 'notes must be array');
    assert.ok(noteList.body.length >= 1, 'must have at least 1 note');

    const noteUpdate = await request(app.getHttpServer())
      .patch(`/knowledge/notes/${noteId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Nota E2E Updated', pinned: false });

    assert.equal(noteUpdate.status, 200, 'update note should return 200');

    const noteDelete = await request(app.getHttpServer())
      .delete(`/knowledge/notes/${noteId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(noteDelete.status, 200, 'delete note should return 200');

    // verify deletion
    const noteListAfterDelete = await request(app.getHttpServer())
      .get(`/knowledge/notes`)
      .set('Authorization', `Bearer ${accessToken}`);

    const deletedNote = (noteListAfterDelete.body as Array<{ id: string }>).find(
      (n) => n.id === noteId,
    );
    assert.equal(deletedNote, undefined, 'deleted note should not appear in list');

    console.log('[e2e] knowledge: notes create/list/update/delete ✓');

    /* ════════════════ CALENDAR ════════════════ */

    const calendarEvtRes = await request(app.getHttpServer())
      .post('/calendar/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Smoke Test Event',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        isGlobal: true,
      });
    assert.strictEqual(calendarEvtRes.status, 201, 'calendar evt create should be 201');
    const calendarEvtId = calendarEvtRes.body.id;
    assert.ok(calendarEvtId, 'calendar event id should exist');

    const calendarListRes = await request(app.getHttpServer())
      .get(`/calendar/events`)
      .set('authorization', `Bearer ${accessToken}`);
    assert.strictEqual(calendarListRes.status, 200, 'calendar evt list should be 200');
    assert.ok(calendarListRes.body.length > 0, 'calendar event should be in list');

    const calendarDelRes = await request(app.getHttpServer())
      .delete(`/calendar/events/${calendarEvtId}`)
      .set('authorization', `Bearer ${accessToken}`);
    assert.strictEqual(calendarDelRes.status, 200, 'calendar evt delete should be 200');

    console.log('[e2e] calendar: create/list/delete ✓');

    /* ════════════════ AUDIT TRAIL ════════════════ */

    const exportLog = await prisma.auditLog.findFirst({
      where: {
        action: 'EXPORT',
        resourceType: 'report_export',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(exportLog, 'audit log EXPORT should be created');

    const reportExport = await prisma.reportExport.findFirst({
      where: {
        reportType: 'service_orders_csv',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(reportExport, 'report export row should be created');

    const loginAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'LOGIN',
        resourceType: 'auth',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(loginAudit, 'audit log LOGIN should be created');

    console.log('[e2e] audit: trail verified ✓');

    /* ════════════════ DONE ════════════════ */

    console.log('\n[e2e] ════════════════════════════════════════');
    console.log('[e2e] ALL SMOKE TESTS PASSED ✓');
    console.log('[e2e] ════════════════════════════════════════\n');
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}

main().catch((err) => {
  console.error('[e2e] smoke failed', err);
  process.exit(1);
});
