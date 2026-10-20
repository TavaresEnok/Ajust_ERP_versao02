// Rastreador de homologação: entra com um perfil real, percorre as rotas do portal e as abas de
// detalhe com IDs reais e registra erros de console, exceções e respostas 4xx/5xx do BFF.
// Uso: node e2e/support/crawl.mjs <baseURL> <identifier> <password> [rota ...]
import { chromium } from '@playwright/test';

const [baseURL, identifier, password, ...only] = process.argv.slice(2);
if (!baseURL || !identifier || !password) {
  console.error('uso: crawl.mjs <baseURL> <identifier> <password> [rota ...]');
  process.exit(2);
}

const DETAIL_TABS = {
  ordens: [
    'resumo',
    'historico',
    'anotacoes',
    'anexos',
    'editar',
    'transicao',
    'aprovacoes',
    'trabalho',
    'sla',
  ],
  ocorrencias: ['resumo', 'editar', 'ordens', 'anotacoes', 'historico'],
  provedores: ['geral', 'ordens', 'contatos', 'servicos', 'historico'],
  tecnicos: ['geral', 'ordens', 'agenda', 'sessoes'],
  ativos: ['informacoes', 'snapshots', 'novo-snapshot', 'comparacao', 'vincular-ordem'],
  ajustpedia: ['leitura', 'editar'],
  empresas: ['dados', 'identidade', 'setores', 'usuarios', 'sla', 'auditoria'],
  servicos: ['detalhes', 'editar'],
  'politicas-sla': ['detalhes', 'editar'],
  workflows: [],
  mudancas: [],
};
const DETAIL_SOURCES = {
  ordens: '/service-orders',
  ocorrencias: '/service-orders/occurrences',
  provedores: '/iam/tenants',
  tecnicos: '/iam/users',
  ativos: '/cmdb/assets',
  ajustpedia: '/knowledge/articles',
  empresas: '/iam/tenants',
  servicos: '/service-catalog',
  'politicas-sla': '/sla-policies',
  workflows: '/workflows',
  mudancas: '/change-management',
};
const SETTINGS = {
  configuracoes: ['geral', 'perfil', 'preferencias', 'seguranca', 'sessoes', '2fa', 'empresa'],
  seguranca: ['sessoes', 'perfil', '2fa'],
  notificacoes: ['regras', 'canais'],
  integracoes: ['integracoes', 'chaves', 'webhooks', 'ixc'],
};

function firstId(data) {
  const list = Array.isArray(data) ? data : data?.items || data?.data || data?.logs || [];
  return list.find((item) => item && typeof item.id === 'string')?.id;
}

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 900 } });
const login = await context.request.post('/api/public/auth/login', {
  data: { identifier, password },
});
const auth = await login.json();
if (!auth.authenticated) {
  console.error('login falhou', auth);
  process.exit(1);
}
const portal = auth.redirectTo.split('/')[1];
const page = await context.newPage();
const issues = [];
let current = '';
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource'))
    issues.push({ route: current, kind: 'console', text: msg.text().slice(0, 300) });
});
page.on('pageerror', (error) =>
  issues.push({ route: current, kind: 'pageerror', text: String(error).slice(0, 300) }),
);
page.on('response', async (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/') && response.status() >= 400) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 200);
    } catch {}
    if (response.status() === 404 && /registro-inexistente/.test(current)) return;
    issues.push({
      route: current,
      kind: `http ${response.status()}`,
      text: `${response.request().method()} ${url.pathname}${url.search} ${body}`,
    });
  }
});

await page.goto(`/${portal}`);
await page.waitForLoadState('networkidle');
const navRoutes = await page.$$eval('nav[aria-label="Navegação principal"] a[href]', (links) =>
  links.map((link) => link.getAttribute('href')),
);

const routes = new Set(navRoutes);
for (const [section, tabs] of Object.entries(SETTINGS)) {
  for (const tab of tabs) routes.add(`/${portal}/${section}/${tab}`);
}
for (const [section, source] of Object.entries(DETAIL_SOURCES)) {
  if (!navRoutes.some((route) => route === `/${portal}/${section}`)) continue;
  const response = await context.request.get(`/api/erp${source}`);
  if (!response.ok()) continue;
  const id = firstId(await response.json());
  if (!id) continue;
  routes.add(`/${portal}/${section}/${id}`);
  for (const tab of DETAIL_TABS[section] || []) routes.add(`/${portal}/${section}/${id}/${tab}`);
}

const selected = only.length
  ? [...routes].filter((route) => only.some((filter) => route.includes(filter)))
  : [...routes];
const statuses = [];
for (const route of selected) {
  current = route;
  const response = await page
    .goto(route)
    .catch((error) => ({ status: () => `erro ${error.message}` }));
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const alerts = await page
    .$$eval('[role="alert"], .text-destructive', (nodes) =>
      nodes
        .map((node) => node.textContent?.trim())
        .filter(
          (text) => text && /não foi possível|failed|erro|unexpected|recusou|inválid/i.test(text),
        ),
    )
    .catch(() => []);
  for (const text of alerts) issues.push({ route, kind: 'alert', text: text.slice(0, 200) });
  statuses.push(`${response.status()} ${route}`);
}

console.log(`# ${identifier} (${portal}) — ${selected.length} rotas`);
for (const line of statuses) if (!line.startsWith('200')) console.log('ROTA', line);
const seen = new Set();
for (const issue of issues) {
  const key = `${issue.route}|${issue.kind}|${issue.text}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`[${issue.kind}] ${issue.route} :: ${issue.text}`);
}
await browser.close();
