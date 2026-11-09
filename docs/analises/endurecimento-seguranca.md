# Endurecimento de Segurança: Cabeçalhos HTTP, CSP com Nonce e Rate Limiting

> **Status da Análise**: Concluída em 09/11/2026  
> **Ambiente Avaliado**: Ajust ERP (Next.js 16.4.5, NestJS 11.1.19, Caddy 2.11.4, PostgreSQL 16, Redis 7)  
> **Regra de Execução**: Modo estritamente somente leitura. Nenhuma alteração foi realizada nos arquivos em produção e nenhum serviço foi reiniciado.

---

## 1. Proposta de CSP sem `'unsafe-inline'` usando Nonce no Next.js 16

### 1.1 Contexto e Mecanismo do Next.js 16 (App Router)
* **Verificado no código**: O frontend utiliza Next.js `16.4.5` (conforme [`apps/web/package.json`](file:///home/app/projects/Ajust_ERP/apps/web/package.json)) e React `19.3.1`.
* **Verificado na documentação oficial**: Na documentação interna do pacote ([`apps/web/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`](file:///home/app/projects/Ajust_ERP/apps/web/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)), o Next.js 16 consolidou a convenção do arquivo [`apps/web/proxy.ts`](file:///home/app/projects/Ajust_ERP/apps/web/proxy.ts) (que substitui o antigo `middleware.ts`).
* **Como funciona o Nonce no Next.js 16**:
  1. O arquivo `proxy.ts` intercepta as requisições de página, gera um nonce criptográfico único (`crypto.randomUUID()` em base64) e monta a diretiva `Content-Security-Policy`.
  2. O nonce é injetado no cabeçalho interno da requisição: `requestHeaders.set('x-nonce', nonce)` e `requestHeaders.set('Content-Security-Policy', csp)`.
  3. Durante a renderização no servidor (SSR), o Next.js 16 extrai automaticamente o valor `'nonce-{valor}'` do cabeçalho CSP e anexa o atributo `nonce` a todos os scripts do framework (runtime React, chunks de bundle do Next.js e tags `<script>` geradas internamente).
  4. Para componentes assíncronos do App Router (como o layout raiz), a função `headers()` da API `next/headers` tornou-se assíncrona (`await headers()`), permitindo ler `(await headers()).get('x-nonce')`.
  5. **Obrigatoriedade de Renderização Dinâmica**: Conforme a documentação oficial do Next.js 16, o uso de nonces exige que as páginas sejam dinamicamente renderizadas a cada requisição, desativando pre-rendering estático rígido e Partial Prerendering (PPR). No Ajust ERP, isso já ocorre naturalmente porque [`apps/web/app/layout.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/app/layout.tsx) consome `headers()` para resolução de sessão e escopo de tenant.

---

### 1.2 O que quebraria se `'unsafe-inline'` fosse simplesmente removido?

A remoção direta de `'unsafe-inline'` sem adaptações quebraria componentes críticos da aplicação:

#### A. Draw.io Embutido (`/drawio/index.html`)
* **Verificado no código**: O Draw.io roda através do contêiner `jgraph/drawio:32.6.1` ([`docker-compose.prod.yml`](file:///home/app/projects/Ajust_ERP/docker-compose.prod.yml)), acessado por rewrite em [`apps/web/next.config.mjs`](file:///home/app/projects/Ajust_ERP/apps/web/next.config.mjs) e embutido via `<iframe>` em [`apps/web/components/erp/drawio-frame.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/drawio-frame.tsx).
* **Diagnóstico**: O Draw.io é uma aplicação legada empacotada em Java/Tomcat baseada em mxGraph. Ela possui centenas de scripts inline embutidos em `index.html`, manipuladores de evento inline (`onclick`, `onload`), e faz uso intensivo de `eval()` e `new Function()` para deserialização de diagramas XML e cálculos de layout geométrico.
* **O que quebraria**: O Draw.io não possui suporte para receber ou injetar nonces do Next.js. Se a rota `/drawio/:path*` receber uma política CSP sem `'unsafe-inline'` e sem `'unsafe-eval'`, **a tela de topologias de rede fica completamente em branco e inutilizável**. Além disso, se a página pai possuir `frame-src 'none'`, o `<iframe>` não pode ser instanciado.
* **Solução arquitetural**:
  1. Manter a rota `/drawio/:path*` isolada com seu próprio cabeçalho CSP permissivo (`script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self';`) em `next.config.mjs`.
  2. No `proxy.ts`, certificar-se de que o `matcher` continue ignorando a rota `drawio/` (já verificado na linha 135 do `proxy.ts`).
  3. No CSP principal do ERP, manter `frame-src 'self'`.

#### B. Conexão em Tempo Real do Socket.IO
* **Verificado no código**: A aplicação utiliza `socket.io-client` v4.8.4 ([`apps/web/components/erp/realtime-events-workspace.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/realtime-events-workspace.tsx)) conectando ao backend NestJS via proxy reverso do Caddy ([`/home/app/infra/caddy/sites/ajust-erp.caddy`](file:///home/app/infra/caddy/sites/ajust-erp.caddy)).
* **Diagnóstico**: O código do `socket.io-client` v4 está empacotado dentro dos bundles estáticos do Next.js (`_next/static/chunks/...`). Como o Next.js anexa automaticamente o nonce aos seus bundles, o carregamento do script do socket **NÃO quebra** com a remoção de `'unsafe-inline'`.
* **O que quebraria**: O Socket.IO inicia a conexão via HTTP Long-Polling (`/socket.io/?EIO=4&transport=polling`) e realiza upgrade para WebSocket (`wss://erp.ajustconsulting.com.br/socket.io/?EIO=4&transport=websocket`). Se a diretiva `connect-src` omitir `ws:` ou `wss:` (ou se o endereço `WS_PUBLIC_URL` for externo e não estiver na allowlist), o navegador **bloqueará o handshake do WebSocket** com erro de CSP.
* **Solução arquitetural**: Garantir na diretiva `connect-src` a inclusão explícita de `'self' ws: wss:`.

#### C. Estilos Inline (`style={{ ... }}` e tags `<style>`)
* **Verificado no código**: Identificamos 5 usos diretos de atributos de estilo inline no frontend:
  1. [`apps/web/components/ui/chart.tsx:293`](file:///home/app/projects/Ajust_ERP/apps/web/components/ui/chart.tsx#L293): cor dinâmica das legendas (`backgroundColor: item.color`).
  2. [`apps/web/components/erp/reports-page.tsx:349`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/reports-page.tsx#L349): largura dinâmica de barras de progresso (`width: ...%`).
  3. [`apps/web/components/erp/service-types-analytics.tsx:308`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/service-types-analytics.tsx#L308): largura de barras de métricas de serviços.
  4. [`apps/web/components/erp/dashboard.tsx:506`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/dashboard.tsx#L506): cor dinâmica de status (`background: item.color`).
  5. [`apps/web/components/erp/analyst-dashboard.tsx:475`](file:///home/app/projects/Ajust_ERP/apps/web/components/erp/analyst-dashboard.tsx#L475): cor dinâmica de operadores.
* **Verificado no código**: O layout raiz ([`apps/web/app/layout.tsx:51`](file:///home/app/projects/Ajust_ERP/apps/web/app/layout.tsx#L51)) possui uma tag inline para prevenção de flash de tema escuro:
  ```tsx
  <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  ```
* **Diagnóstico**:
  - Pela especificação do W3C CSP Level 2 e Level 3, um nonce em `style-src` aplica-se exclusivamente a elementos `<style>` (`style-src-elem`), **mas não a atributos HTML `style="..."`** (`style-src-attr`).
  - Se for aplicado `style-src 'self' 'nonce-{valor}'` sem `'unsafe-inline'` ou sem `style-src-attr 'unsafe-inline'`, o navegador **bloqueará todos os gráficos do Recharts, todas as barras de progresso dinâmicas e os indicadores de cor dos painéis**.
  - O script de tema em `layout.tsx` não é empacotado como chunk externo; ele é inserido inline. Sem o atributo `nonce={nonce}`, o tema escuro falha na inicialização da página.
* **Solução arquitetural**:
  1. Para scripts: utilizar `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` (em produção) e `'unsafe-eval'` (em desenvolvimento).
  2. No [`apps/web/app/layout.tsx`](file:///home/app/projects/Ajust_ERP/apps/web/app/layout.tsx), ler o nonce com `(await headers()).get('x-nonce')` e passá-lo à tag: `<script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />`.
  3. Para estilos: manter `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'` OU usar `style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'` (CSP Level 3), garantindo que atributos inline de estilização continuem funcionando sem permitir stylesheets externas não confiáveis.

---

## 2. Proposta de Limite Global de Requisições por IP

### 2.1 Modelagem da Carga para ~50 Usuários Simultâneos
* **Particularidade do Ajust ERP (Verificado no Domínio de Negócio)**:
  - O sistema atende provedores de internet e analistas da consultoria de suporte técnico (NOC).
  - É um cenário recorrente que **de 10 a 50 analistas e operadores compartilhem o mesmo endereço IPv4 público de saída (NAT ou CGNAT)** na sede do provedor ou no escritório central.
  - Portanto, um limite de requisições baseado puramente em IP público precisa comportar o tráfego agregado desse grupo sob o mesmo IP sem causar falsos positivos (erro `429 Too Many Requests`).

* **Levantamento de Padrão de Tráfego por Usuário**:
  - **Abertura inicial de página / F5**: Carrega HTML, 15 a 25 chunks JavaScript, folha de estilos CSS, fontes Geist, imagens e dispara de 3 a 5 chamadas de API via BFF (`/api/erp/auth/me`, `/api/erp/service-orders`, `/api/erp/reports/overview`). Total: **~25 a 35 requisições por segundo por usuário** nos primeiros 2 segundos.
  - **Navegação contínua (SPA)**: 2 a 5 requisições por transição de tela.
  - **Polling em segundo plano (SWR)**: 1 requisição a cada 15–30 segundos por aba aberta.
  - **WebSocket (Socket.IO)**: Conexão persistente estabelecida uma única vez (baixo consumo HTTP após handshake).
  - **Pico Coletivo de 50 Usuários sob o mesmo IP (ex: Troca de Turno ou Início de Plantão)**:
    - *Regime normal contínuo*: 50 usuários × 1 req/s = **50 req/s**.
    - *Pico de atividade / múltiplos F5 simultâneos*: 10 a 20 usuários abrindo telas ao mesmo tempo = **150 a 200 req/s**.
    - *Rajada instantânea (Burst)*: **250 a 350 requisições** em uma janela de 2 segundos.

* **Números Recomendados**:
  - **Taxa contínua (Rate)**: **150 a 200 req/s por IP** (ou **9.000 a 12.000 req/min**).
  - **Capacidade de Rajada (Burst)**: **300 requisições**.
  - **Exclusão**: Assets estáticos sob `/_next/static/*` devem ser servidos diretamente com cache no Caddy ou possuir teto separado (300 req/s).
  - **Rotas de Risco**: Rotas sensíveis (como `/auth/login`) já possuem limites específicos no NestJS (`RateLimitGuard`: 5 falhas por IP + identificador com atraso progressivo).

---

### 2.2 Onde implementar: Caddy vs. NestJS?

* **Verificação no Contêiner do Caddy (`edge_caddy`)**:
  - Executamos `docker exec edge_caddy caddy list-modules` no servidor.
  - **Resultado factual**: A imagem do Caddy é a oficial `v2.11.4-alpine` com os 132 módulos padrão. O módulo de rate limiting de terceiros (`http.handlers.rate_limit`, do plugin `github.com/mholt/caddy-ratelimit`) **NÃO está instalado**.
  - Tentar adicionar a diretiva `rate_limit` no Caddyfile atual provocaria erro de sintaxe na inicialização do Caddy (`unrecognized directive: rate_limit`).
  - Para implementar no Caddy, seria mandatório recompilar o binário com `xcaddy`.

* **Verificação no NestJS / Redis**:
  - O NestJS já possui o serviço [`apps/api/src/common/redis.service.ts`](file:///home/app/projects/Ajust_ERP/apps/api/src/common/redis.service.ts) integrado ao Redis 7 com suporte a scripts atômicos e expiração automática (`incrEx`).
  - A API já possui o [`TenantRateLimitGuard`](file:///home/app/projects/Ajust_ERP/apps/api/src/common/tenant-rate-limit.guard.ts), porém ele só atua em rotas anotadas individualmente.

* **Recomendação Técnica**:
  - **Camada de Borda (Caddy)**: Se a imagem do Caddy for recompilada com `caddy-ratelimit`, aplicar um teto de mitigação de DoS volumétrico: 200 req/s com burst de 300 por IP.
  - **Camada de Aplicação (NestJS / BFF)**: Implementar um Middleware / Throttler global no NestJS conectado ao Redis.
  - **Grande Vantagem da Aplicação**: A aplicação consegue distinguir entre IP de visitante anônimo e usuários autenticados (via `req.auth.userId`). Se 50 analistas compartilharem o mesmo IP público, o limite por IP protege as rotas públicas, enquanto usuários autenticados recebem uma cota individual por usuário (ex: 600 req/min por analista), evitando que o uso pesado de um analista bloqueie os outros 49 colegas de trabalho.

---

## 3. Matriz de Cabeçalhos: Ausentes ou Permissivos Demais

A tabela a seguir consolida a auditoria nos 5 arquivos especificados:

| Cabeçalho | Situação Atual | Risco de Segurança | Correção Recomendada | Verificação |
| :--- | :--- | :--- | :--- | :--- |
| **`Content-Security-Policy`** | Contém `'unsafe-inline'` em `next.config.mjs` e `main.ts`. | Permite injeção e execução de scripts arbitrários (XSS) caso ocorra falha de sanitização em HTML ou em atributos. | Migrar a política para o `proxy.ts` com nonce dinâmico para scripts e `'strict-dynamic'`. Preservar `'unsafe-inline'` e `'unsafe-eval'` isolados exclusivamente em `/drawio/*`. | **Verificado no código** ([`next.config.mjs:17`](file:///home/app/projects/Ajust_ERP/apps/web/next.config.mjs#L17), [`main.ts:147`](file:///home/app/projects/Ajust_ERP/apps/api/src/main.ts#L147)). |
| **`Strict-Transport-Security` (HSTS)** | Duplicado: Caddy define `max-age=31536000; includeSubDomains`; Next.js define `max-age=63072000` (sem subdomínios). | Cabeçalhos duplicados com diretivas divergentes podem confundir parsers de navegadores. Falta a diretiva `preload`. | Manter o HSTS exclusivamente na borda TLS (Caddy) com `max-age=63072000; includeSubDomains; preload` e remover de `next.config.mjs`. | **Verificado no código** ([`Caddyfile:9`](file:///home/app/infra/caddy/Caddyfile#L9), [`next.config.mjs:13`](file:///home/app/projects/Ajust_ERP/apps/web/next.config.mjs#L13)). |
| **`X-Powered-By`** | O cabeçalho `X-Powered-By: Next.js` é enviado nas respostas HTTP do frontend. | Divulgação desnecessária de tecnologia e versão do framework, facilitando enumeração e ataques direcionados. | Adicionar `poweredByHeader: false` em `next.config.mjs` e `-X-Powered-By` no snippet `(seguranca)` do Caddy. | **Verificado no código e na resposta HTTP** (`curl -I` retornou `X-Powered-By: Next.js`). |
| **`Cross-Origin-Resource-Policy` (CORP)** | `main.ts` define `policy: 'cross-origin'` no Helmet. Ausente no Next.js. | Permite que qualquer site externo carregue recursos e endpoints da API por meio de tags `<script>` ou `<img>`. | Alterar para `policy: 'same-origin'` no Helmet da API e aplicar `same-origin` no Next.js. | **Verificado no código** ([`main.ts:142`](file:///home/app/projects/Ajust_ERP/apps/api/src/main.ts#L142)). |
| **`Cross-Origin-Opener-Policy` (COOP)** | Ausente no Caddy, Next.js e NestJS. | Permite que páginas externas que abriram a aplicação em uma aba mantenham referência ao objeto `window` (risco de ataques de canal lateral e ataques entre abas). | Adicionar `Cross-Origin-Opener-Policy: same-origin` nas respostas de página do frontend. | **Verificado no código** (ausente em todos os arquivos). |
| **`Permissions-Policy`** | Next.js define `camera=(), microphone=(self), geolocation=()`. Ausente no Caddy e no NestJS. | APIs sensíveis do navegador como WebUSB, Pagamentos, Captura de Tela e FLoC não estão explicitamente bloqueadas. | Expandir para `camera=(), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=(), interest-cohort=()`. | **Verificado no código** ([`next.config.mjs:12`](file:///home/app/projects/Ajust_ERP/apps/web/next.config.mjs#L12)). *(Nota: `microphone=(self)` foi verificado como necessário para o gravador de áudio do relatório de turno)*. |
| **`X-DNS-Prefetch-Control`** | Ausente no Next.js e Caddy (o Helmet do NestJS ativa por padrão). | O navegador pode tentar resolver previamente domínios externos encontrados em textos de ocorrências, vazando metadados via consultas DNS. | Adicionar `X-DNS-Prefetch-Control: off` no Next.js. | **Verificado no código** (ausente em `next.config.mjs`). |
| **`X-Frame-Options` vs. `frame-ancestors`** | Next.js define `DENY` em `/:path*` e `SAMEORIGIN` em `/drawio/*`. Caddy não possui `X-Frame-Options`. | Se alguém definir `X-Frame-Options: DENY` ou `frame-ancestors 'none'` no Caddy globalmente, o Draw.io deixará de abrir no iframe. | A configuração granular atual do Next.js é a correta; deve-se evitar sobrepor `X-Frame-Options` ou `frame-ancestors` no Caddy. | **Verificado no código** ([`next.config.mjs:10,52`](file:///home/app/projects/Ajust_ERP/apps/web/next.config.mjs#L10)). |
| **`Rate-Limit` / Throttling Headers** | Ausentes na borda do Caddy, no BFF e na maior parte da API. | Risco de exaustão de conexões, scraping massivo e sobrecarga do Node.js por requisições descontroladas. | Implementar rate limiting global no NestJS (Redis) e na borda do Caddy, expondo cabeçalhos padronizados (`RateLimit-*` ou `Retry-After`). | **Verificado no código** (ausente nos arquivos de infraestrutura e nos guards gerais). |

---

## 4. Mudanças Propostas em Formato Diff

Abaixo estão os diffs exatos e compatíveis para implementação futura (sem aplicação no momento, respeitando a regra de somente leitura).

### 4.1 Infraestrutura Caddy

#### Diff 1: `/home/app/infra/caddy/Caddyfile`
*Remove o cabeçalho `X-Powered-By` vazado pelo Next.js, reforça o HSTS com `preload` e adiciona proteção de abertura cross-origin.*

```diff
--- a/home/app/infra/caddy/Caddyfile
+++ b/home/app/infra/caddy/Caddyfile
@@ -6,10 +6,13 @@
 # Cabeçalhos aplicados a todos os sites.
 (seguranca) {
 	header {
-		Strict-Transport-Security "max-age=31536000; includeSubDomains"
+		Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
 		X-Content-Type-Options "nosniff"
 		Referrer-Policy "strict-origin-when-cross-origin"
+		Cross-Origin-Opener-Policy "same-origin"
+		X-DNS-Prefetch-Control "off"
 		-Server
+		-X-Powered-By
 	}
 	encode zstd gzip
 	log {
```

#### Diff 2: `/home/app/infra/caddy/sites/ajust-erp.caddy`
*(Opcional: Requer Caddy compilado com `caddy-ratelimit`. Apresentado para quando a imagem customizada estiver disponível).*

```diff
--- a/home/app/infra/caddy/sites/ajust-erp.caddy
+++ b/home/app/infra/caddy/sites/ajust-erp.caddy
@@ -2,6 +2,15 @@
 erp.ajustconsulting.com.br {
 	import seguranca
 
+	# Rate limit de proteção global (50 usuários simultâneos no mesmo IP = 200 req/s, burst 300)
+	# Requer módulo caddy-ratelimit
+	# rate_limit {
+	# 	zone global_ip {
+	# 		key {remote_host}
+	# 		events 200
+	# 		window 1s
+	# 	}
+	# }
+
 	# Tempo real (Socket.IO) vai direto ao NestJS; o restante passa pelo Next (BFF).
 	@socket path /socket.io/*
 	reverse_proxy @socket 127.0.0.1:8092
```

---

### 4.2 Frontend Next.js 16

#### Diff 3: `apps/web/next.config.mjs`
*Remove a política estática de CSP em `/:path*` (que será gerada dinamicamente com nonce no `proxy.ts`), desativa `poweredByHeader`, remove duplicação de HSTS (já gerenciado pelo Caddy), expande a `Permissions-Policy` e preserva o CSP permissivo em `/drawio/:path*`.*

```diff
--- a/apps/web/next.config.mjs
+++ b/apps/web/next.config.mjs
@@ -7,21 +7,16 @@ const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..
 
 const securityHeaders = [
   { key: 'X-Content-Type-Options', value: 'nosniff' },
   { key: 'X-Frame-Options', value: 'DENY' },
   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
-  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
-  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]),
-  {
-    key: 'Content-Security-Policy',
-    value:
-      "default-src 'self'; script-src 'self' 'unsafe-inline'" +
-      (isDev ? " 'unsafe-eval'" : '') +
-      "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-src 'self'; frame-ancestors 'none';",
-  },
+  {
+    key: 'Permissions-Policy',
+    value:
+      'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=(), interest-cohort=()',
+  },
+  { key: 'X-DNS-Prefetch-Control', value: 'off' },
+  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
 ];
 
 const nextConfig = {
+  poweredByHeader: false,
   devIndicators: false,
   ...(isDev
     ? {
```

#### Diff 4: `apps/web/proxy.ts`
*Gera nonce criptográfico por requisição, monta a política de CSP com `'nonce-${nonce}'` e `'strict-dynamic'`, repassa o nonce para os headers internos e injeta o cabeçalho `Content-Security-Policy` nas respostas de navegação.*

```diff
--- a/apps/web/proxy.ts
+++ b/apps/web/proxy.ts
@@ -42,6 +42,28 @@ export async function proxy(request: NextRequest) {
   const requestHeaders = new Headers(request.headers);
   // O escopo só pode vir deste proxy; nunca do cliente.
   requestHeaders.delete(SCOPE_HEADER);
   requestHeaders.delete('x-middleware-subrequest');
 
+  // Gera nonce criptográfico único por requisição (Next.js 16 CSP)
+  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
+  const isDev = process.env.NODE_ENV !== 'production';
+
+  const cspHeader = `
+    default-src 'self';
+    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''};
+    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
+    style-src-attr 'unsafe-inline';
+    img-src 'self' data: blob:;
+    media-src 'self' blob:;
+    font-src 'self' data:;
+    connect-src 'self' ws: wss:;
+    frame-src 'self';
+    frame-ancestors 'none';
+    object-src 'none';
+    base-uri 'self';
+    form-action 'self';
+    ${!isDev ? 'upgrade-insecure-requests;' : ''}
+  `.replace(/\s{2,}/g, ' ').trim();
+
+  requestHeaders.set('x-nonce', nonce);
+  requestHeaders.set('Content-Security-Policy', cspHeader);
+
   const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/csat/');
@@ -75,6 +97,7 @@ export async function proxy(request: NextRequest) {
   if (legacy && legacy !== pathname) {
     return withRefreshedCookies(
       NextResponse.redirect(new URL(legacy, request.url)),
       session?.refreshed,
     );
   }
 
   if (isPublic) {
     if (session && home && pathname === '/login') {
       return withRefreshedCookies(
         NextResponse.redirect(new URL(home, request.url)),
         session.refreshed,
       );
     }
-    const response = NextResponse.next({ request: { headers: requestHeaders } });
+    const response = NextResponse.next({ request: { headers: requestHeaders } });
+    response.headers.set('Content-Security-Policy', cspHeader);
     if (hasSessionCookie && !session) clearAuthCookies(response.cookies);
     return response;
   }
@@ -93,6 +116,7 @@ export async function proxy(request: NextRequest) {
     const response = NextResponse.redirect(url);
     if (hasSessionCookie) clearAuthCookies(response.cookies);
     return response;
   }
 
   const normalized = pathname.replace(/^\/portal(?=\/|$)/, '/cliente');
@@ -127,6 +151,8 @@ export async function proxy(request: NextRequest) {
-  return withRefreshedCookies(
-    NextResponse.next({ request: { headers: requestHeaders } }),
-    session.refreshed,
-  );
+  const response = NextResponse.next({ request: { headers: requestHeaders } });
+  response.headers.set('Content-Security-Policy', cspHeader);
+  return withRefreshedCookies(response, session.refreshed);
 }
```

#### Diff 5: `apps/web/app/layout.tsx`
*Consome o nonce gerado no `proxy.ts` de forma assíncrona (`(await headers()).get('x-nonce')`) e o vincula ao script inline de inicialização do tema.*

```diff
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -46,11 +46,13 @@ export default async function RootLayout({
   children,
 }: Readonly<{
   children: React.ReactNode;
 }>) {
-  const scope = parseScope((await headers()).get(SCOPE_HEADER));
+  const headerList = await headers();
+  const scope = parseScope(headerList.get(SCOPE_HEADER));
+  const nonce = headerList.get('x-nonce') ?? undefined;
   return (
     <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
       <head>
-        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
+        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
       </head>
       <body className="font-sans antialiased">
         <ThemeProvider>
```

#### Diff 6: `apps/web/lib/bff/forward.ts`
*Garante que as respostas JSON do BFF incluam cabeçalhos de proteção cross-origin e prevenção de MIME-sniffing.*

```diff
--- a/apps/web/lib/bff/forward.ts
+++ b/apps/web/lib/bff/forward.ts
@@ -44,7 +44,14 @@ const FORWARD_RESPONSE_HEADERS = [
 export function json(status: number, message: string) {
   return NextResponse.json(
     { message, statusCode: status },
-    { status, headers: { 'cache-control': 'no-store' } },
+    {
+      status,
+      headers: {
+        'cache-control': 'no-store',
+        'x-content-type-options': 'nosniff',
+        'cross-origin-resource-policy': 'same-origin',
+      },
+    },
   );
 }
```

---

### 4.3 Backend NestJS

#### Diff 7: `apps/api/src/main.ts`
*Ajusta a política do Helmet para `crossOriginResourcePolicy: { policy: 'same-origin' }` em vez de `'cross-origin'`, prevenindo o consumo não autorizado de endpoints por sites de terceiros.*

```diff
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -141,7 +141,7 @@ async function bootstrap() {
   // Rotas de API (JSON) não renderizam HTML, então o benefício real é proteger o Swagger.
   app.use(
     helmet({
-      crossOriginResourcePolicy: { policy: 'cross-origin' },
+      crossOriginResourcePolicy: { policy: 'same-origin' },
       crossOriginEmbedderPolicy: false,
       contentSecurityPolicy: {
         directives: {
```

#### Diff 8: Rate Limiting Global no NestJS (`apps/api/src/common/global-rate-limit.middleware.ts`)
*Implementa um middleware de rate limit em Redis na API para cobrir todas as requisições, dimensionado para suportar picos de 50 usuários simultâneos no mesmo IP público.*

```diff
--- /dev/null
+++ b/apps/api/src/common/global-rate-limit.middleware.ts
@@ -0,0 +1,48 @@
+import { Injectable, NestMiddleware, HttpException, HttpStatus, Inject } from '@nestjs/common';
+import { Request, Response, NextFunction } from 'express';
+import { RedisService } from './redis.service';
+import { RequestWithAuth } from './request-with-auth';
+
+@Injectable()
+export class GlobalRateLimitMiddleware implements NestMiddleware {
+  constructor(@Inject(RedisService) private readonly redis: RedisService) {}
+
+  async use(req: RequestWithAuth, res: Response, next: NextFunction) {
+    // Se autenticado, aplica cota por usuário (10 req/s = 600 req/min por analista);
+    // Se anônimo, aplica cota por IP (200 req/s para comportar 50 usuários sob o mesmo NAT/CGNAT).
+    const userId = req.auth?.userId;
+    const ip = req.ip || req.socket.remoteAddress || 'unknown';
+    
+    const key = userId 
+      ? `rate-limit:user:${userId}` 
+      : `rate-limit:ip:${ip}`;
+
+    // 50 usuários * 4 req/s de pico = 200 req/s na janela de 1 segundo para IP compartilhado.
+    // Usuário autenticado individual: 25 req/s.
+    const limit = userId ? 25 : 200;
+    const windowSeconds = 1;
+
+    try {
+      const current = await this.redis.incrEx(key, windowSeconds);
+      
+      res.setHeader('X-RateLimit-Limit', limit);
+      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
+
+      if (current > limit) {
+        res.setHeader('Retry-After', '1');
+        throw new HttpException(
+          {
+            statusCode: HttpStatus.TOO_MANY_REQUESTS,
+            message: 'Limite de requisições excedido. Aguarde um instante.',
+          },
+          HttpStatus.TOO_MANY_REQUESTS,
+        );
+      }
+      next();
+    } catch (err) {
+      if (err instanceof HttpException) throw err;
+      // Em caso de falha transitória do Redis, não derruba o fluxo operacional (fail-open)
+      next();
+    }
+  }
+}
```

---

## 5. Resumo da Verificação e Conclusão

1. **CSP com Nonce**: Viável no Next.js 16 via `proxy.ts`, mantendo a exceção do Draw.io (`/drawio/*`) com sua política isolada e preservando `style-src 'unsafe-inline'` ou `style-src-attr 'unsafe-inline'` para suportar estilos dinâmicos de gráficos e barras de progresso.
2. **Rate Limiting**: Configurar rate limiting estrito por IP de forma ingênua causaria falsos positivos e indisponibilidade para equipes que compartilham o mesmo escritório/NAT. A estratégia recomendada é alocar **200 req/s (burst 300)** por IP na borda e cotas granulares por usuário autenticado no backend.
3. **Integridade da Operação**: Nenhuma alteração foi persistida no código de produção ou na configuração de infraestrutura ativa durante esta análise.

