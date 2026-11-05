require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const { execFileSync } = require('node:child_process');

const base = 'http://127.0.0.1:8070';
const marker = `Verificação de gravação do relatório ${Date.now()}`;

async function main() {
  let reportId;
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    const context = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.__audioStreams = [];
      navigator.mediaDevices.getUserMedia = async (...args) => {
        if (window.__denyMicrophone) throw new DOMException('Permission denied', 'NotAllowedError');
        const stream = await getUserMedia(...args);
        window.__audioStreams.push(stream);
        if (window.__delayMicrophone) {
          await new Promise((resolve) => {
            window.__releaseMicrophone = resolve;
          });
        }
        return stream;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /permissions policy|content security policy/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });
    await page.goto(base + '/login');
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
    const response = await page.goto(base + '/analista/relatorios-turno');
    expect(response.headers()['permissions-policy']).toContain('microphone=(self)');
    expect(response.headers()['content-security-policy']).toContain("media-src 'self' blob:");
    await expect(
      page.getByRole('heading', { name: 'Relatórios de turno', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Novo relatório', exact: true }).click();
    const content = page.getByRole('textbox', { name: 'Texto do relatório', exact: true });
    await content.fill(marker);
    await expect(page.getByLabel('Anexos do relatório', { exact: true })).toBeHidden();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Anexo', exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'verificacao-anexo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(marker),
    });
    await expect(page.getByRole('list', { name: 'Anexos aguardando envio' })).toContainText(
      'verificacao-anexo.txt',
    );
    await page.getByRole('button', { name: 'Gravar áudio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Parar gravação', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Salvar relatório', exact: true }),
    ).toBeDisabled();
    await expect
      .poll(() => page.getByRole('status').filter({ hasText: 'Gravando' }).textContent())
      .toMatch(/00:0[1-9]/);
    await page.getByRole('button', { name: 'Parar gravação', exact: true }).click();
    const preview = page.locator('audio[aria-label^="Ouvir audio-relatorio-"]');
    await expect(preview).toHaveCount(1);
    await preview.evaluate(async (audio) => {
      await audio.play();
    });
    await expect.poll(() => preview.evaluate((audio) => audio.currentTime)).toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__audioStreams
            .flatMap((s) => s.getTracks())
            .every((t) => t.readyState === 'ended'),
        ),
      )
      .toBe(true);
    const savePromise = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/erp/shift-reports' && r.request().method() === 'POST',
    );
    const uploadPromise = page.waitForResponse(
      (r) =>
        /\/shift-reports\/[^/]+\/attachments$/.test(new URL(r.url()).pathname) &&
        r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar relatório', exact: true }).click();
    const saved = await savePromise;
    expect(saved.status()).toBe(201);
    reportId = (await saved.json()).id;
    const uploaded = await uploadPromise;
    expect(uploaded.status()).toBe(201);
    expect(await uploaded.json()).toHaveLength(2);
    await expect(
      page.getByRole('heading', { name: 'Anexos e áudio · 2', exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole('row')
      .filter({ hasText: 'Anderson Alves' })
      .first()
      .getByRole('button', { name: 'Abrir', exact: true })
      .click();
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ouvir áudio', exact: true }).click();
    const persistedAudio = page.locator('audio');
    await persistedAudio.evaluate(async (audio) => {
      await audio.play();
    });
    await expect
      .poll(() => persistedAudio.evaluate((audio) => audio.currentTime))
      .toBeGreaterThan(0);
    console.log(
      'PASS: botão Anexo, captura real via MediaRecorder com microfone simulado, prévia, upload na API, recarga e reprodução persistida.',
    );

    await page.getByRole('button', { name: 'Novo relatório', exact: true }).click();
    await page.evaluate(() => {
      window.__delayMicrophone = true;
    });
    await page.getByRole('button', { name: 'Gravar áudio', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Aguardando microfone…', exact: true }),
    ).toBeDisabled();
    await expect
      .poll(() => page.evaluate(() => typeof window.__releaseMicrophone))
      .toBe('function');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.evaluate(() => window.__releaseMicrophone());
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__audioStreams
            .flatMap((s) => s.getTracks())
            .every((t) => t.readyState === 'ended'),
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
    console.log(
      'PASS: cancelar enquanto aguarda permissão não deixa o microfone ligado. Sem erros de JavaScript, CSP ou política de microfone.',
    );
    await page.getByRole('button', { name: 'Novo relatório', exact: true }).click();
    await page.evaluate(() => {
      window.__delayMicrophone = false;
      window.__denyMicrophone = true;
    });
    await page.getByRole('button', { name: 'Gravar áudio', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Acesso ao microfone negado' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gravar áudio', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
    console.log('PASS: permissão negada mostra orientação e permite tentar novamente.');
  } finally {
    await browser.close();
    if (reportId) {
      const cleanup = `
        const { PrismaClient } = require('@prisma/client');
        const { rm } = require('node:fs/promises');
        const { join } = require('node:path');
        const db = new PrismaClient();
        (async () => {
          const report = await db.shiftReport.findUnique({ where: { id: process.argv[1] } });
          if (!report || report.content !== process.argv[2]) throw new Error('Relatório de verificação não identificado.');
          const attachments = await db.shiftReportAttachment.findMany({ where: { reportId: report.id } });
          await db.$transaction([
            db.auditLog.deleteMany({ where: { resourceId: { in: [report.id, ...attachments.map((a) => a.id)] }, resourceType: { in: ['shift_report', 'shift_report_attachment'] } } }),
            db.shiftReport.delete({ where: { id: report.id } }),
          ]);
          for (const attachment of attachments) await rm(join(process.env.UPLOAD_ROOT, attachment.storageKey));
          console.log('Dados temporários da verificação removidos.');
        })().finally(() => db.$disconnect()).catch((error) => { console.error(error.message); process.exitCode = 1; });
      `;
      console.log(
        execFileSync(
          'docker',
          ['exec', '-w', '/workspace', 'ajust_erp-api-1', 'node', '-e', cleanup, reportId, marker],
          { encoding: 'utf8' },
        ).trim(),
      );
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
