# Plano — substituir `apps/web` pelo redesign e integrar ao BFF/NestJS

Fonte: `docs/redeisgn-front-end` (handoff em `docs/redeisgn-front-end/docs/FRONTEND_HANDOFF.md`).
Data: 2026-10-20.

## 1. Diagnóstico

| Item | `apps/web` atual | Redesign |
|---|---|---|
| Stack | Next 15.5, Tailwind 3.4, React 19.0 | Next 16.4, Tailwind 4, shadcn/base-ui, SWR, xyflow |
| Rotas | Portais monolíticos (`gerencia/portal.impl.tsx` etc.) | `app/[...slug]` → `Workspace`, com rotas canônicas validadas |
| Sessão | `middleware.ts` com refresh via cookies HttpOnly e redirecionamento por perfil | `ErpProvider` sem `transport`/`scope` (desconectado) |
| BFF | cerca de 85 route handlers em `app/api/**`, cada um por recurso (`_proxy.ts`, `auth/_lib.ts`) | Espera um transporte da mesma origem: `createSameOriginTransport(basePath)` |
| Testes | Playwright: `smoke`, `flows`, `api-integration` | Nenhum |

**Cobertura de API.** Todos os caminhos que o redesign chama existem nos controllers NestJS (`apps/api/src/**`). Os enums de OS, prioridade, ocorrência e mudança são idênticos ao `prisma/schema.prisma`. Portanto, **não é preciso alterar o backend** para a primeira entrega.

**Lacunas do BFF atual.** Estes endpoints usados pelo redesign não têm handler:
`audit/*`, `auth/2fa/*`, `auth/logout-all`, `auth/admin/revoke-sessions/:id`, `auth/sessions/user/:id`,
`calendar/events/check-conflict`, `change-management/*`, `cmdb/assets/:id/link-order`,
`csat/summary`, `csat/create-for-order`, `service-orders/:id/approvals`, `service-orders/export/{csv,history}`,
`service-catalog/:id`, `service-catalog/seed-defaults`, `time-entries`, `workflows/:id/{toggle,rollback}`, `workflows/status`,
`integrations/ixc/*`, `notifications/whatsapp/dispatch-order`.
Outros endpoints existem com **nome diferente**: `/api/occurrences` em vez de `service-orders/occurrences`, `/api/os-templates` em vez de `os-process-templates` e `/api/csat/[token]` em vez de `csat/survey/:token`.

**Contrato de login divergente.** O BFF atual responde `{ ok, user }` ou `{ ok, twoFactorRequired, temporaryToken }`, mas o redesign espera `BffAuthResult` (`{ authenticated, redirectTo }` ou `{ twoFactorRequired, temporaryToken }`). O primeiro acesso também precisa repassar o `bootstrapToken` vindo de `validate-otp`.

## 2. Decisões de arquitetura

1. **Um BFF genérico com allowlist** em vez de mais 40 handlers:
   - `app/api/erp/[...path]/route.ts` atende GET, POST, PATCH, PUT e DELETE. Ele reaproveita `resolveAuthSession` e `applyRefreshIfNeeded` e remove `tenantId` (`lib/strip-tenant-upstream`). Também repassa multipart e `Content-Type`, transmite o corpo das respostas binárias e preserva `Content-Disposition`, `x-export-rows`, `x-export-truncated` e `ETag`/`If-Match`.
   - **Allowlist explícita** (método + padrão de caminho) gerada da tabela de rotas do NestJS. Um caminho fora da lista retorna 404. Isso impede que o BFF vire um proxy aberto (por exemplo, `/monitoring/metrics` ou `/integrations/ixc/webhook`).
   - `app/api/public/[...path]/route.ts` só aceita `GET csat/survey/:token` e `POST csat/survey/:token/answer`.
   - Rotas de auth ficam **dedicadas** (`app/api/auth/*`), porque gravam e limpam cookies. Elas são adaptadas para responder `BffAuthResult`.
2. **Sessão no servidor.** O `app/layout.tsx` (Server Component) lê os cookies e valida em `/auth/me`. O resultado vira `scope` (`userId`, `tenantId`, `role`, `sessionKey = erp_session_id`). Um wrapper client `ErpSessionProvider` cria `createSameOriginTransport('/api/erp')` e `('/api/public')` e monta o `ErpProvider`. Nenhum token chega ao JavaScript.
3. **Proteção de rotas.** O `middleware.ts` atual é portado para `proxy.ts`, a convenção do Next 16 (`middleware` foi descontinuado). Ele mantém a lógica de refresh, `ROLE_HOME`, `roleCanAccess` e os aliases legados, agora combinada com `canonicalWorkspacePath`/`canAccessSection` (`lib/erp/routes.ts`, `access.ts`). `/` sem sessão redireciona para `/login`, e o link “Explorar o sistema sem autenticação” é removido.
4. **401 global.** Quando uma chamada do transporte recebe `ErpError` 401, o cliente redireciona para `/login?next=…`, sem repetir a chamada.

## 3. Fases (seguem a ordem de homologação do handoff)

Cada fase termina com typecheck, build e testes Playwright da fase verdes. Assim cada fase cabe em um PR.

### Fase 0 — Transplante (sem integração)
- Mover `apps/web` para `apps/web-legacy` (fora do workspace de build). Ele serve de referência até a fase 9.
- Copiar o redesign para `apps/web` com `name: @ajust/web` e os scripts `dev`/`start` com `PORT` e `-H 0.0.0.0`, além de `lint` e `typecheck`. Remover `packageManager: pnpm@12` (a raiz usa pnpm 9.12) e `pnpm-workspace.yaml`/`pnpm-lock.yaml` locais.
- Remover `@vercel/analytics` e o `generator: v0.app`. Trocar `next/font/google` por um pacote local (`geist`) para o build não depender de rede.
- Levar `next.config.mjs` atual: `output: 'standalone'`, `distDir`, headers de segurança/CSP, `allowedDevOrigins` e `typedRoutes`.
- Ajustar `Dockerfile`/`docker-compose*` se algum caminho mudar e alinhar `eslint` ao `eslint.config.mjs` da raiz.
- **Pronto quando:** `pnpm --filter @ajust/web build` passa e a imagem Docker sobe com a UI no estado “Backend não conectado”.

### Fase 1 — Sessão, BFF e escopo
- Portar `app/api/_proxy.ts` e `app/api/auth/**` do legado. Adaptar `login`, `verify-2fa`, `bootstrap/validate-otp`, `forgot`/`reset` a `BffAuthResult` (`redirectTo = ROLE_HOME[role]`).
- Criar `api/erp/[...path]` com a allowlist e `api/public/[...path]`.
- Criar `ErpSessionProvider`, `scope` no layout e `proxy.ts`. Fazer o tratamento do 401 e o logout (`/auth/logout`, `logout-all`).
- Revisar `/auth/socket-token`: credencial curta, conexão encerrada ao trocar sessão ou tenant.
- **Testes:** login (com e sem 2FA), primeiro acesso via OTP, refresh após a expiração do access token, acesso negado entre portais, `/` sem sessão vai para login, e um caminho fora da allowlist retorna 404.

### Fase 2 — Ordens e ocorrências
- `GET/POST service-orders`: conferir o formato da paginação (`items`/total) contra `listRecords`. Testar detalhe, PATCH com `expectedVersion`/ETag (409/412), transição, aprovações, anotações, anexos (upload multipart e download) e SLA por OS.
- Ocorrências: `firstOrder` aninhada, ordens vinculadas e anotações.
- Despacho rápido, `whatsapp/dispatch-order`, `csat/create-for-order`.
- **Testes:** ciclo de vida completo de uma OS, conflito de versão e isolamento de tenant em anexo de outra empresa.

### Fase 3 — Cofre (credenciais) e notas
- `reveal` auditado (`CREDENTIAL_ACCESS`), segredo fora do SWR e limpeza em 30 s. Notas isoladas por autor.

### Fase 4 — Anexos (endurecimento)
- Limites de tamanho e tipo no BFF, streaming sem buffer integral e checagem de autorização por arquivo.

### Fase 5 — Catálogo, CMDB e SLA
- `service-catalog` (PUT completo, `seed-defaults`), `sla-policies`, `sla/calendar` + exceções, `simulate`, `breaches`.
- `cmdb/assets` com snapshots, diff e `link-order`.
- Resolver as leituras “por coleção” (tenants, usuários, artigos, catálogo): confirmar se a coleção vem completa ou paginada antes de buscar o ID.

### Fase 6 — Agenda e plantão
- `calendar/events` (+ `all`, `check-conflict`, `users`), `on-call`. Validar fuso e recorrências.

### Fase 7 — Relatórios e exportação
- KPIs, saúde, fluxo de OS, CSAT, `export/csv` síncrono com metadados de truncamento, histórico e download. Auditoria: `logs`, `metrics`, `export`.

### Fase 8 — Comunicações, integrações e segurança
- `notifications/config`, `api-keys` (exposição única), `integrations/ixc/{configure,reconcile}`, 2FA e sessões próprias e de terceiros (`admin/revoke-sessions`), tempo real (Socket.IO).

### Fase 9 — Workflows, processos, mudanças e apontamentos; descomissionamento
- `workflows` (toggle, rollback, status), `os-process-templates`, `change-management` (+ transição), `time-entries`.
- Reescrever `e2e/` para os seletores do redesign e cobrir o roteiro de homologação ponta a ponta.
- Remover `apps/web-legacy` e as rotas BFF específicas que a allowlist substituiu.

## 4. Riscos e pontos a confirmar

- **Next 16 + Tailwind 4**: são majors novos no monorepo. Validar `standalone` com o `Dockerfile` atual (Node 20 alpine; o Next 16 exige Node ≥ 20.9).
- **Proxy genérico**: a allowlist é o controle de segurança. Ela precisa ser revisada a cada novo endpoint e coberta por teste.
- **Paginação e DTOs**: o redesign aceita `array | items | logs`. Divergências precisam de adaptação explícita, sem trocar UUID por protocolo.
- **Recursos sem GET individual** (artigos, mudanças, tenants): o detalhe depende da coleção vir completa.
- **Paridade funcional**: telas do legado sem equivalente no redesign precisam de inventário antes da fase 9 (por exemplo, a paleta de comandos do analista e o “cockpit 360” de provedores).
- **Volume**: o redesign tem cerca de 416 KB de TSX em linhas longas. Rodar o Prettier na fase 0 facilita a revisão dos PRs seguintes.

## 5. Status de execução (2026-10-20)

Todas as fases foram executadas. O app antigo foi removido e `apps/web` é o redesign integrado.

| Fase | Resultado | Ajustes feitos durante a homologação |
|---|---|---|
| 0 | Redesign em `apps/web` (Next 16.4, Tailwind 4, standalone) | Imports `cn` do pacote npm errado → `@/lib/utils`; fonte Geist local; analytics e marca v0 removidos |
| 1 | BFF genérico com allowlist, `proxy.ts`, sessão via header interno, logout real | Refresh deduplicado (rotação do NestJS); 401 de login vira 400 "credenciais inválidas"; link de navegação anônima removido |
| 2 | OS: criar, editar com `expectedVersion`/ETag (409), transição, anotação, aprovação, anexos, CSAT; ocorrências com `firstOrder`, OS vinculada e anotação | Listagem usava `q`/`page`; o controller espera `search` (≥ 2 caracteres)/`offset`; limites de multipart alinhados (10 × 10 MB) |
| 3–4 | Cofre: segredo só no `reveal` auditado (`CREDENTIAL_ACCESS`), `no-store`; notas CRUD/fixar | Redação de `storageKey`, hashes e `*Enc` em toda resposta JSON |
| 5 | Catálogo (PUT completo, seed), políticas de SLA, calendário SLA, exceções, simulação, CMDB (snapshots, diff, vínculo com OS) | API: `snapshots-diff` sem parâmetros respondia 401 (derrubava a sessão) → 400; erros de validação Zod passam a mostrar os campos |
| 6 | Agenda (eventos, conflito, equipe), plantão | `/on-call/current` vazio retornava corpo vazio → transporte aceita resposta sem corpo |
| 7 | KPIs, saúde, fluxo, CSAT, CSV de OS com metadados, histórico/download, auditoria (logs, métricas, exportação) | — |
| 8 | Regras de notificação, chaves de API (exposição única), 2FA, sessões próprias e de colaborador, tempo real (Socket.IO no NestJS) | `socketUrl` passa a apontar para a URL pública da API; Configurações/Ativos escondidos dos perfis que o NestJS recusa |
| 9 | Workflows (CRUD, toggle), modelos de processo, RFC com transição, apontamentos; e2e reescrito (20 testes); `scripts/web-smoke.sh` atualizado; legado removido | Dados de exemplo (`lib/demo-data.ts`) reduzidos a tipos |

### Pendências conhecidas (fora do frontend)

- **Rate limit de login** (`RateLimitGuard`): conta também os logins bem-sucedidos (5 por usuário+IP a cada 15 min). Atrás do BFF, o IP visto é o do servidor web. Vale contar só falhas ou confiar em `X-Forwarded-For` (`trust proxy`).
- **Mensagens da API em inglês** ("Invalid credentials.", "Insufficient role…") chegam à interface quando não há tradução específica.
- **Produção em HTTP**: os cookies saem com `Secure` quando `NODE_ENV=production`. Em um deploy sem HTTPS, defina `COOKIE_INSECURE=true` (apenas temporariamente).
- **Avisos de lint** das regras do React Compiler (`purity`, `set-state-in-effect`), rebaixados para aviso em `apps/web/eslint.config.mjs`.
