// Ajust Cofre — entrada automática a partir do cofre do Ajust ERP.
//
// Fluxo: a página do cofre (já com o motivo e a senha do analista confirmados e auditados pelo
// ERP) entrega usuário, senha e os códigos 2FA à extensão. A extensão abre o site numa aba nova e
// só preenche páginas dessa aba cuja origem é exatamente a do endereço cadastrado. Os dados ficam
// em chrome.storage.session (só memória, apagado ao fechar o navegador) por no máximo 3 minutos,
// e são apagados assim que o login termina ou a aba fecha.

const ERP_ORIGINS = ['https://erp.ajustconsulting.com.br'];
const JOB_TTL_MS = 3 * 60 * 1000;
const key = (tabId) => `job:${tabId}`;

async function getJob(tabId) {
  const stored = (await chrome.storage.session.get(key(tabId)))[key(tabId)];
  if (stored && stored.expiresAt < Date.now()) {
    await chrome.storage.session.remove(key(tabId));
    return null;
  }
  return stored || null;
}
const saveJob = (tabId, job) => chrome.storage.session.set({ [key(tabId)]: job });
const dropJob = (tabId) => chrome.storage.session.remove(key(tabId));

function originOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function validPayload(p) {
  if (!p || typeof p !== 'object') return 'Dados de acesso ausentes.';
  const origin = originOf(p.url);
  if (!origin || origin !== p.origin) return 'Endereço inválido (use http ou https).';
  if (typeof p.username !== 'string' || typeof p.password !== 'string')
    return 'Usuário ou senha ausentes.';
  if (p.totp != null) {
    const codes = p.totp.codes;
    if (
      !Array.isArray(codes) ||
      !codes.every(
        (c) =>
          /^\d{6,8}$/.test(String(c?.code)) &&
          Number.isFinite(c.validFrom) &&
          Number.isFinite(c.validUntil),
      )
    )
      return 'Códigos 2FA inválidos.';
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  (async () => {
    if (message?.type === 'autofill') {
      // Só a página do ERP pode pedir uma entrada automática.
      if (!sender.tab || !ERP_ORIGINS.includes(originOf(sender.url)))
        return reply({ ok: false, error: 'Pedido fora do Ajust ERP.' });
      // Mesmo pedido chegando duas vezes (duas pontes na aba): só o primeiro abre o site.
      const seenKey = `seen:${message.requestId}`;
      if (message.requestId) {
        if ((await chrome.storage.session.get(seenKey))[seenKey])
          return reply({ ok: false, duplicate: true });
        await chrome.storage.session.set({ [seenKey]: Date.now() + 60_000 });
        const all = await chrome.storage.session.get(null);
        const expired = Object.keys(all).filter(
          (k) => k.startsWith('seen:') && all[k] < Date.now(),
        );
        if (expired.length) await chrome.storage.session.remove(expired);
      }
      const problem = validPayload(message.payload);
      if (problem) return reply({ ok: false, error: problem });
      const p = message.payload;
      const tab = await chrome.tabs.create({
        url: p.url,
        index: sender.tab.index + 1,
        openerTabId: sender.tab.id,
      });
      await saveJob(tab.id, {
        origin: p.origin,
        username: p.username,
        password: p.password,
        totp: p.totp
          ? { codes: p.totp.codes, skew: Number(p.totp.serverTime) - Date.now() || 0 }
          : null,
        loginDone: false,
        otpDone: !p.totp,
        expiresAt: Date.now() + JOB_TTL_MS,
      });
      return reply({ ok: true, twoFactor: !!p.totp });
    }
    if (message?.type === 'step' && sender.tab) {
      const job = await getJob(sender.tab.id);
      if (!job || originOf(sender.url) !== job.origin) return reply({ ok: false });
      if (message.step === 'login') job.loginDone = true;
      if (message.step === 'otp') job.otpDone = true;
      if (job.loginDone && job.otpDone) await dropJob(sender.tab.id);
      else await saveJob(sender.tab.id, job);
      return reply({ ok: true });
    }
    reply({ ok: false });
  })().catch((error) => reply({ ok: false, error: String(error?.message || error) }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const job = await getJob(tabId);
  if (!job) return;
  // Redirecionou para outro site (ou outra porta/protocolo): não preenche nada ali.
  if (originOf(tab.url) !== job.origin) return;
  await chrome.scripting
    .executeScript({
      target: { tabId },
      func: fillPage,
      args: [
        {
          login: job.loginDone ? null : { username: job.username, password: job.password },
          totp: job.otpDone ? null : job.totp,
        },
      ],
    })
    .catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => void dropJob(tabId));

// Instalou ou atualizou: reconecta as abas do ERP já abertas, sem precisar de F5.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ERP_ORIGINS.map((origin) => `${origin}/*`) });
  for (const tab of tabs)
    await chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] })
      .catch(() => {});
});

/**
 * Roda dentro da página do site (mundo isolado da extensão). Precisa ser autocontida: o Chrome
 * serializa só o corpo desta função.
 */
async function fillPage(data) {
  if (window.__ajustCofre) return 'already-running';
  window.__ajustCofre = true;
  const BANNER_ID = 'ajust-cofre-banner';

  const visible = (el) =>
    !!el &&
    el.getClientRects().length > 0 &&
    !el.disabled &&
    !el.readOnly &&
    getComputedStyle(el).visibility !== 'hidden';
  const describe = (el) => {
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    return [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute('aria-label'),
      el.autocomplete,
      label?.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  };
  const textual = (el) => ['text', 'email', 'tel', 'number', 'password'].includes(el.type);
  const setValue = (el, value) => {
    el.focus();
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const banner = (text, tone = 'info') => {
    let box = document.getElementById(BANNER_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = BANNER_ID;
      box.setAttribute('role', 'status');
      box.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:340px;padding:12px 16px;' +
        'border-radius:12px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);';
      document.documentElement.appendChild(box);
    }
    box.style.background = tone === 'error' ? '#7f1d1d' : '#0f172a';
    box.style.color = '#fff';
    box.textContent = 'Ajust Cofre · ' + text;
    clearTimeout(window.__ajustCofreBannerTimer);
    window.__ajustCofreBannerTimer = setTimeout(() => box.remove(), tone === 'wait' ? 60000 : 8000);
  };
  const report = (step) => chrome.runtime.sendMessage({ type: 'step', step }).catch(() => {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Indício forte de campo 2FA: vale mesmo que o rótulo diga "senha" (o SGP usa "Senha OTP").
  const OTP_STRONG = /otp|2fa|mfa|one-time|autenticador|authenticator|dois fatores|two-factor/;
  // Indício fraco: só vale se o campo não parecer outra coisa.
  const OTP_WEAK = /token|c[oó]digo|code|verifica|autentica/;
  const NOT_OTP = /captcha|altcha|cupom|coupon|cep|postal|promo|senha|password|user|login|e-?mail/;
  const OTP_HINT = { test: (text) => OTP_STRONG.test(text) || OTP_WEAK.test(text) };
  const isOtpField = (el) => {
    const text = describe(el);
    if (el.autocomplete === 'one-time-code' || OTP_STRONG.test(text)) return true;
    return OTP_WEAK.test(text) && !NOT_OTP.test(text.replace(/token|code/g, ''));
  };

  /** querySelectorAll que também entra em shadow roots abertos (widgets como o ALTCHA). */
  function deepAll(root, selector, out = []) {
    if (root.shadowRoot) deepAll(root.shadowRoot, selector, out);
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll('*'))
      if (el.shadowRoot) deepAll(el.shadowRoot, selector, out);
    return out;
  }

  function findLogin() {
    const password = [...document.querySelectorAll('input[type="password"]')].find(
      (el) => visible(el) && !OTP_HINT.test(describe(el)),
    );
    if (!password) return null;
    const scope = password.form || document;
    const inputs = [...scope.querySelectorAll('input')].filter(
      (el) => visible(el) && ['text', 'email', 'tel'].includes(el.type),
    );
    const before = inputs.filter(
      (el) => el.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const user =
      inputs.find((el) => /user|login|e-?mail|usu[aá]rio|conta|account/.test(describe(el))) ||
      before[before.length - 1] ||
      null;
    return { user, password, form: password.form };
  }

  function findOtp() {
    const inputs = [...document.querySelectorAll('input')].filter(
      (el) => visible(el) && textual(el),
    );
    const single = inputs.find(isOtpField);
    if (single) return { fields: [single], form: single.form };
    // Código em caixinhas separadas (uma por dígito).
    const boxes = inputs.filter((el) => el.maxLength === 1);
    if (boxes.length >= 6) {
      const parent = boxes[0].parentElement?.parentElement || document.body;
      const group = boxes.filter((el) => parent.contains(el));
      if (group.length >= 6) return { fields: group, form: group[0].form };
    }
    return null;
  }

  function pickCode() {
    const now = Date.now() + (data.totp.skew || 0);
    return data.totp.codes.find((c) => c.validFrom <= now && now < c.validUntil)?.code || null;
  }

  function captchaToken(form) {
    const root = form || document;
    const widget = root.querySelector(
      'altcha-widget, .g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]',
    );
    if (!widget) return { present: false };
    const token = root.querySelector(
      'input[name="altcha"], textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]',
    );
    const altcha = widget.matches('altcha-widget') ? widget : null;
    const verified = altcha && deepAll(altcha, '[data-state="verified"]').length > 0;
    return { present: true, solved: !!token?.value || !!verified, altcha };
  }

  /**
   * ALTCHA ("Não sou um robô" do SGP) é uma prova de trabalho que o próprio navegador calcula
   * quando a caixa é marcada: a extensão marca a caixa pelo analista, que pediu a entrada.
   * Captchas com desafio humano (reCAPTCHA, hCaptcha, Turnstile) continuam com o analista.
   */
  function clickAltcha(altcha) {
    const box = deepAll(altcha, 'input[type="checkbox"]').find((el) => !el.disabled);
    if (!box || box.checked) return false;
    box.click();
    return true;
  }

  function submit(form, field) {
    const scope = form || document;
    const button =
      scope.querySelector('button[type="submit"], input[type="submit"]') ||
      [...scope.querySelectorAll('button')].find(
        (b) =>
          visible(b) &&
          b.type !== 'button' &&
          /entrar|acessar|login|verificar|confirmar|continuar|validar|enviar|sign in/i.test(
            b.textContent || b.value || '',
          ),
      );
    if (button && visible(button)) return button.click();
    if (form) return form.requestSubmit();
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
  }

  let loginDone = !data.login;
  let otpDone = !data.totp;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !(loginDone && otpDone)) {
    if (!loginDone) {
      const login = findLogin();
      if (login) {
        if (login.user) setValue(login.user, data.login.username);
        setValue(login.password, data.login.password);
        loginDone = true;
        await report('login');
        // Mesmo formulário com campo 2FA: preenche junto.
        const sameFormOtp = !otpDone ? findOtp() : null;
        if (sameFormOtp && sameFormOtp.form === login.form) {
          const code = pickCode();
          if (code) {
            fillOtp(sameFormOtp, code);
            otpDone = true;
            await report('otp');
          }
        }
        let captcha = captchaToken(login.form);
        if (captcha.present && !captcha.solved) {
          const clicked = captcha.altcha && clickAltcha(captcha.altcha);
          banner(
            clicked
              ? 'Usuário e senha preenchidos. Verificando “Não sou um robô”…'
              : 'Usuário e senha preenchidos. Marque “Não sou um robô” e eu entro em seguida.',
            'wait',
          );
          const askedAt = Date.now();
          let asked = !clicked;
          while (Date.now() < deadline) {
            await sleep(400);
            captcha = captchaToken(login.form);
            if (captcha.solved || !document.contains(login.password)) break;
            if (!asked && Date.now() - askedAt > 10_000) {
              asked = true;
              banner('Marque “Não sou um robô” e eu entro em seguida.', 'wait');
            }
          }
          if (!captcha.solved) return 'captcha-timeout';
        }
        banner('Entrando…');
        await sleep(250);
        submit(login.form, login.password);
        continue;
      }
    }
    if (!otpDone && loginDone) {
      const otp = findOtp();
      if (otp) {
        const code = pickCode();
        if (!code) {
          banner(
            'O código 2FA expirou. Volte ao cofre e clique de novo em Entrar automaticamente.',
            'error',
          );
          return 'otp-expired';
        }
        fillOtp(otp, code);
        otpDone = true;
        await report('otp');
        banner('Código 2FA preenchido. Entrando…');
        await sleep(250);
        submit(otp.form, otp.fields[0]);
        return 'otp';
      }
    }
    await sleep(400);
  }
  return loginDone && otpDone ? 'done' : 'timeout';

  function fillOtp(otp, code) {
    if (otp.fields.length === 1) setValue(otp.fields[0], code);
    else otp.fields.forEach((field, i) => setValue(field, code[i] || ''));
  }
}
