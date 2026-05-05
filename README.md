# Ajust ERP - Bootstrap Sprint 1

Monorepo inicial com:
- `apps/web` (Next.js)
- `apps/api` (NestJS + WebSocket)
- `apps/worker` (NestJS worker/health)
- `packages/shared` (schemas e regras compartilhadas)
- `prisma/schema.prisma` (modelagem inicial v2)

## Portas (Slot 4)

- Web: `8070`
- API/WS: `8071`
- PostgreSQL: `8072`
- Redis: Sistema de cache (porta `8073`)
- pgAdmin: `8077`

## Subir ambiente

```bash
cp .env.example .env
docker compose up -d
```

## Desenvolvimento local (sem Docker)

```bash
corepack enable
pnpm install
pnpm dev
```

## Banco (Prisma)

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed:roles
pnpm db:seed:dev-admin
pnpm db:seed:demo-users
```

Migration baseline criada em:
- `prisma/migrations/20260217214500_baseline/migration.sql`

Seed de acesso inicial:
- usuario: `admin@ajust.local`
- senha: `Admin@123456`
- tenant: `ajust-demo`

Usuarios de exemplo adicionais:
- gerente: `gerente@ajust.local` / `Gerente@123`
- analista: `analista@ajust.local` / `Analista@123`
- cliente: `cliente@ajust.local` / `Cliente@123`

## API inicial (Sprint 2/3)

Rotas principais:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /iam/roles`
- `GET /iam/tenants`
- `POST /iam/tenants`
- `POST /iam/users`
- `GET /iam/users?tenantId=...`
- `POST /service-orders`
- `GET /service-orders`
- `GET /service-orders/summary`
- `GET /service-orders/export/csv`
- `GET /service-orders/export/history`
- `GET /service-orders/export/:id/download`
- `GET /service-orders/:id`
- `PATCH /service-orders/:id/transition`
- `POST /service-orders/:id/approvals`
- `POST /service-orders/:id/attachments` (multipart `files`)
- `POST /integrations/ixc/webhook`
- `POST /integrations/ixc/configure`
- `POST /integrations/ixc/reconcile`
- Worker manual trigger: `POST http://localhost:8076/jobs/ixc/reconcile`
- Worker export cleanup trigger: `POST http://localhost:8076/jobs/exports/cleanup`

## Autenticacao Web (login unificado)

- rota web de entrada: `GET /login`
- sem cadastro publico (somente login)
- sem campo de `tenant_id` no formulario padrao (tenant resolvido pelo vinculo do usuario)
- backend de auth utilizado: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/refresh`
- sessoes web em cookies HTTP-only:
  - `erp_access_token`
  - `erp_refresh_token`
  - `erp_session_id`
  - `erp_role`
  - `erp_tenant_id`
- middleware web aplica:
  - bloqueio de `/gerencia`, `/analista`, `/cliente` sem sessao
  - redirecionamento por perfil:
    - `super_admin` e `gerente` -> `/gerencia`
    - `analista`, `tecnico`, `leitura` -> `/analista`
    - `cliente` -> `/cliente`
- credenciais de exemplo visiveis no proprio login:
  - `gerente@ajust.local` / `Gerente@123`
  - `analista@ajust.local` / `Analista@123`
  - `cliente@ajust.local` / `Cliente@123`

Eventos WebSocket emitidos:
- `service_order.created`
- `service_order.transitioned`
- `service_order.approval`
- `service_order.attachment_uploaded`
- `service_order.synced`
- `sync.ixc_webhook_processed`
- `sync.ixc_webhook_failed`
- `sync.ixc_reconciliation`

Webhook IXC:
- assinatura esperada no header `x-ixc-signature` com `HMAC-SHA256(rawBody)` por tenant.
- segredo armazenado criptografado em `ProviderIntegration.webhookSecretEnc`.

## Teste E2E (smoke)

Com PostgreSQL ativo em `8072`:

```bash
pnpm test:e2e
```

Fluxos validados:
- login e `/auth/me`
- logout de sessao bloqueando token de access imediatamente
- criacao de OS
- upload de anexo
- transicoes de status
- bloqueio de fechamento de OS critica atrasada sem aprovacao
- aprovacao e fechamento posterior
- webhook IXC processado
- filtros e resumo de OS (`/service-orders` e `/service-orders/summary`)
- exportacao CSV com trilha em `AuditLog` e `ReportExport`

Filtros aceitos em `/service-orders` e `/service-orders/summary`:
- `tenantId` (obrigatorio no escopo)
- `status`, `priority`, `type`
- `search` (protocolo/titulo/descricao/externalProtocol)
- `from` e `to` (ISO datetime)
- `orderBy` (`createdAt|updatedAt|deadlineAt|protocol|priority|status`)
- `orderDir` (`asc|desc`)
- `limit` e `offset` (apenas em `/service-orders`)

`/service-orders/export/csv` aceita os mesmos filtros (exceto paginacao), retorna CSV e registra:
- `AuditLog.action=EXPORT` (`resourceType=report_export`)
- linha em `ReportExport` (`reportType=service_orders_csv`)

`/service-orders/export/history` retorna os ultimos exports CSV do tenant:
- campos: `id`, `reportType`, `status`, `createdAt`, `fileAvailable`, `actor`
- filtros: `tenantId` (escopo), `limit` e `offset`

`/service-orders/export/:id/download`:
- baixa o arquivo CSV persistido para aquele export
- exige escopo do mesmo tenant e papel permitido
- registra `AuditLog.action=EXPORT` com operacao de download
- pode retornar 404 quando o arquivo expirar na retencao

Resumo retornado por `/service-orders/summary`:
- totais: `total`, `active`, `closed`, `overdueActive`, `risk2h`, `criticalOverdue`
- distribuicoes: `byStatus`, `byPriority`, `byType`
- produtividade: `topAssignees`

## Frontend (mockups iniciais)

Rotas web implementadas com base conceitual nos 3 mockups:
- `/` hub dos modulos + monitor realtime
- `/gerencia` painel executivo (KPIs, fila critica, saude de sync)
- `/analista` fila operacional e rotina de turno
- `/cliente` resumo do tenant, timeline e OS

As paginas `/gerencia`, `/analista` e `/cliente` ja consomem dados reais da API:
- login server-side com `WEB_DEMO_EMAIL` e `WEB_DEMO_PASSWORD`
- tenant opcional via `WEB_TENANT_ID`
- conectividade interna por `API_INTERNAL_URL` e `WORKER_INTERNAL_URL` (Docker)
- filtros por `period`, `status`, `priority`, `type` e `q` (busca)
- ordenacao por `orderBy` e `orderDir`
- paginacao server-side com `page` e `pageSize` refletindo `limit/offset`
- botao "Exportar CSV" preservando os filtros ativos
- card de historico de exportacoes em `/gerencia` com acao "Baixar"

Retencao de arquivos de export (worker):
- `EXPORT_RETENTION_DAYS` (padrao `30`)
- `EXPORT_RETENTION_INTERVAL_MS` (padrao `3600000`)
- job remove arquivo fisico, marca `ReportExport.status=EXPIRED` e limpa `fileUrl`

Monitor WebSocket (na rota `/`):
- informe `tenantId`
- conecte no gateway (`NEXT_PUBLIC_WS_URL`, padrao `http://localhost:8071`)
- acompanhe eventos `service_order.*` e `sync.*`

## Documentos de referencia

- `plano_execucao_erp_slot4.md`
- `decisao_oficial_escopo_v2.md`
- `docs/matriz_transicoes_status_v2.md`
