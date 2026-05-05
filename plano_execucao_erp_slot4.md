# Plano de Execucao ERP Ajust (Slot 4) - v2

## 1) Base e escopo fechado

Fontes de referencia:
- `gerencia.txt`
- `cliente.txt`
- `analista.txt`

Stack obrigatoria (confirmada):
- Runtime: Node.js
- Frontend: Next.js + TypeScript
- Backend: NestJS (Express adapter)
- Realtime: NestJS Gateway (WebSocket)
- Banco: PostgreSQL
- Cache/estado: Redis
- Cache/estado: Redis
- ORM: Prisma
- Auth: JWT + Refresh Token
- Validacao: Zod (preferencial) ou class-validator

Decisoes oficiais incorporadas nesta v2:
- Tipos OS MVP: Rompimento, Lentidao, Configuracao ONU, Troca de Senha, Cancelamento, Auditoria, Instalacao, BGP.
- SLA base: Critica 4h, Alta 8h, Normal 24h, Baixa 72h.
- Override SLA: Rompimento e BGP usam 50% do SLA base, com minimo de 2h.
- Workflow: Cancelada sai de Aberta/Em Analise; Ag. Terceiros -> Resolvida -> Fechada; reabertura faz Fechada -> Em Analise.
- Fechamento OS: analista, gerente e super_admin. Tecnico somente marca Resolvida.
- Aprovacao obrigatoria para fechamento de OS Critica/Alta com atraso SLA.
- Papeis iniciais: super_admin, gerente, analista, tecnico, cliente, leitura.
- Multi-tenant obrigatorio por `tenant_id`.
- Usuario multi-tenant via tabela `user_tenant` com papel por tenant.
- Relatorios globais: super_admin sempre; gerente global so com permissao explicita.
- Integracao inicial: IXC Soft via REST + webhook (arquivo apenas fallback).
- Autoridade de dados: SGP controla ciclo principal da OS; ERP controla metadados internos.
- Reconciliacao: dominio de autoridade + `updated_at`; empate por prioridade de fonte.
- Sync: webhook em tempo real + polling de reconciliacao a cada 5 minutos.
- Realtime WS: criacao/alteracao OS, mudanca status, atribuicao tecnico, nova ocorrencia, alerta SLA, erro de sync.
- 2FA: obrigatorio para super_admin; opcional para demais no MVP.
- Token: access 15 min; refresh rotativo 7 dias.
- Logout remoto por sessao/dispositivo: minimo admin/gerente; alvo para todos.
- Criptografia em repouso para tokens/credenciais/segredos: obrigatoria.
- Auditoria obrigatoria: login/logout/falha login, mudancas em OS/SLA/papeis, acesso credenciais, exportacao, sync.
- Anexos MVP: ate 10 MB por arquivo, ate 10 arquivos por OS, tipos `pdf,png,jpg,jpeg,txt,csv,zip`.
- Capacidade MVP: ate 1.000 OS/dia e 100 usuarios simultaneos.
- Deploy inicial: cloud gerenciado com conectividade segura aos SGPs.
- Go-live: rollout por tenant (piloto + expansao), sem big bang.

## 2) Arquitetura alvo

## 2.1 Componentes
- `web` (Next.js): experiencia por perfil (gerencia, analista, cliente).
- `api` (NestJS): dominio, auth, RBAC, dashboards, relatorios, integracao SGP, websocket gateway.
- `worker` (NestJS standalone): jobs assinc., sync, reconciliacao, fila DLQ.
- `postgres`: persistencia transacional.
- `redis`: cache, rate-limit, token/session blacklist, pub/sub leve.

Padrao arquitetural:
- Monorepo TypeScript (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`).
- Backend modular monolith com fronteiras claras por contexto.
- Multi-tenant logico com `tenant_id` em entidades de negocio e filtros obrigatorios no acesso.

## 2.2 Portas Docker - Slot 4
- `8070` -> Next.js (`web`)
- `8071` -> NestJS API + WebSocket (`api`)
- `8072` -> PostgreSQL
- `8073` -> Redis
- `8076` -> Worker health/debug
- `8077` -> pgAdmin opcional
- `8078` -> Observabilidade opcional
- `8079` -> Observabilidade opcional
- `8080-8089` -> reserva de expansao

## 2.3 Dominio de autoridade (sync)
- Campos SGP (fonte principal): status operacional principal, datas oficiais do ciclo, protocolo externo.
- Campos ERP (fonte principal): owner, notas internas, tags internas, anexos internos, flags internas.
- Politica de conflito:
  1. Verificar dominio de autoridade do campo.
  2. Usar `updated_at` mais recente dentro do dominio.
  3. Empate resolve por prioridade de fonte definida (SGP para ciclo OS, ERP para internos).

## 3) Modelagem de dados (Prisma v2)

Entidades principais:
- `Tenant`
- `User`
- `Role`
- `UserTenant`
- `ServiceOrder`
- `ServiceOrderOccurrence`
- `ServiceOrderAttachment`
- `ServiceOrderApproval`
- `SlaPolicy`
- `SlaEvent`
- `ProviderIntegration`
- `SyncEvent`
- `AuditLog`
- `ReportExport`
- `KnowledgeArticle`
- `KnowledgeTag`
- `Note`
- `Session` (refresh token rotativo por dispositivo)

Campos obrigatorios em `Tenant`:
- `id` (uuid auto)
- `legalName`
- `tradeName`
- `taxId` (CNPJ/CPF)
- `slug`
- `domain`
- `timezone`
- `techContactName`
- `techContactEmail`
- `techContactPhone`
- `status`

Estados de OS (enum):
- `ABERTA`
- `EM_ANALISE`
- `AG_CAMPO`
- `AG_TERCEIROS`
- `RESOLVIDA`
- `FECHADA`
- `CANCELADA`

Regras de transicao (resumo):
- `AG_TERCEIROS -> RESOLVIDA -> FECHADA`
- `ABERTA/EM_ANALISE -> CANCELADA`
- `FECHADA -> EM_ANALISE` (acao de reabertura)

Indices chave:
- `ServiceOrder(tenantId, status, priority, deadlineAt)`
- `ServiceOrder(tenantId, protocol)` unico
- `ServiceOrderOccurrence(serviceOrderId, createdAt desc)`
- `AuditLog(tenantId, createdAt desc, actorUserId)`
- `SyncEvent(tenantId, source, createdAt desc)`

## 4) Modulos e responsabilidades

Backend (NestJS):
- `auth`: login, refresh rotativo, revoke, 2FA
- `iam`: usuarios, papeis, permissoes, vinculo multi-tenant
- `tenants`: cadastro e configuracao de tenant
- `service-orders`: CRUD, workflow, regras de aprovacao, atribuicao
- `sla`: calculo SLA, override por tipo, alertas
- `approvals`: aprovacao de fechamento (Critica/Alta atrasada)
- `realtime`: gateway websocket por tenant/canais
- `integrations.ixc`: webhook, pull REST, reconciliacao, retry e DLQ
- `reports`: filtros, exportacao e historico
- `knowledge`, `notes`, `calendar`
- `attachments`: validacao de tipo/tamanho/limite
- `audit`: trilha completa obrigatoria

Frontend (Next.js):
- `app/(auth)`
- `app/(gerencia)`
- `app/(analista)`
- `app/(cliente)`
- `components/os` (tabela, filtros, drawer, timeline, aprovacao)
- `components/kpi` (cards e graficos)
- `lib/api-client`
- `lib/ws-client`
- `lib/rbac`
- `lib/schemas`

## 5) Backlog detalhado por sprint (1 semana cada)

Premissas:
- Squad 2-4 devs
- Objetivo MVP em 10 sprints
- Critico: entregar fluxo OS + sync IXC + SLA + seguranca minima antes de modulos secundarios

Sprint 1 - Fundacao
- Setup monorepo, padrao de codigo, CI basica (lint/test/build).
- Docker Compose Slot 4 com servicos base.
- Bootstrap `api`, `web`, `worker`.
- Entrega: stack sobe com healthchecks.

Sprint 2 - IAM e multi-tenant base
- Modelos `User`, `Role`, `UserTenant`, `Tenant`.
- Login JWT (15 min), refresh rotativo (7 dias), logout por sessao.
- RBAC por tenant.
- Entrega: autenticacao e autorizacao funcional com tenant isolation.

Sprint 3 - Dominio OS (v1)
- Modelos `ServiceOrder`, `Occurrence`, `Attachment`.
- CRUD OS, filtros, paginacao e detalhe.
- Workflow base de status + reabertura.
- Entrega: ciclo operacional principal sem integracao externa.

Sprint 4 - SLA e aprovacao
- Implementar matriz SLA base + override Rompimento/BGP.
- Deteccao de atraso e alertas.
- Regra de aprovacao para fechamento Critica/Alta atrasada.
- Entrega: fechamento governado por regra formal.

Sprint 5 - Realtime + auditoria
- WebSocket por tenant para eventos operacionais.
- Trilhas obrigatorias de auditoria (auth, OS, papeis, export, sync).
- Entrega: telas atualizam em tempo real e log de conformidade.

Sprint 6 - Integracao IXC (MVP)
- Recepcao webhook IXC.
- Sync REST incremental + reconciliacao a cada 5 min.
- Regras de conflito por dominio de autoridade.
- Retry + DLQ interno (no worker).
- Entrega: fluxo hibrido SGP/ERP estavel.

Sprint 7 - Dashboards e relatorios
- Dashboards Gerencia, Analista e Cliente aderentes ao mock.
- KPIs de volume, status, atraso, produtividade.
- Exportacao com trilha de auditoria.
- Entrega: visao gerencial completa.

Sprint 8 - Modulos de suporte
- Knowledge base, notas e calendario.
- Configuracoes administrativas.
- Gestao de tenants e permissoes globais.
- Entrega: pacote funcional de apoio operacional.

Sprint 9 - Hardening
- Politicas de criptografia em repouso para segredos.
- Limites de anexos e validacoes de tipo/tamanho.
- Testes E2E dos fluxos criticos e carga alvo inicial.
- Entrega: estabilidade e seguranca para piloto.

Sprint 10 - Piloto e rollout
- Deploy cloud gerenciado.
- Onboarding do tenant piloto.
- Observacao assistida + correcoes.
- Expansao gradual por tenant.
- Entrega: go-live controlado sem big bang.

## 6) Estrategia de implantacao

Ambientes recomendados:
- `dev` local (compose)
- `hml` cloud (UAT + treino)
- `prod` cloud (go-live)

CI/CD:
- PR: lint + unit + build
- Main: image build + deploy hml
- Prod: promocao com checklist de release e rollback documentado

Banco e continuidade:
- Migrations via Prisma
- Backup diario + teste de restore semanal
- Objetivo inicial de continuidade (ajustavel): RPO ate 15 min, RTO ate 2h

Rollout:
- Lote 1: 1 tenant piloto
- Lote 2: 3-5 tenants
- Lote 3: expansao progressiva

## 7) Riscos e mitigacoes (v2)

- Conectividade SGP cliente a cliente
  - Mitigacao: pool de conectores, timeout padrao, retry exponencial, DLQ, dashboard de sync.
- Vazamento cross-tenant
  - Mitigacao: guard global por `tenant_id`, testes automaticos de isolamento, revisao de query.
- Gargalo em picos de eventos
  - Mitigacao: consumidores escalaveis, cache Redis e backpressure.
- Divergencia de dados entre SGP e ERP
  - Mitigacao: politica formal de autoridade + reconciliacao recorrente e rastreio via `SyncEvent`.

## 8) Status de execucao (17/02/2026)

Entregas validadas ate aqui:
- Infra Slot 4 operacional (`8070` a `8077`) com `web`, `api`, `worker`, `postgres`, `redis`.
- Sprint 1 concluida: monorepo, bootstrap `web/api/worker`, compose e health endpoints.
- Sprint 2 concluida: IAM base, JWT + refresh rotativo, sessao/dispositivo e isolamento por tenant.
- Sprint 3 concluida: dominio de OS, workflow principal, anexos com limites MVP e auditoria basica.
- Sprint 4 concluida: matriz SLA + override Rompimento/BGP + aprovacao obrigatoria em atraso.
- Sprint 5 parcialmente concluida: WebSocket por tenant com eventos operacionais principais.
- Sprint 6 parcialmente concluida: integracao IXC com webhook, assinatura HMAC, reconciliacao periodica e trigger manual no worker.
- Sprint 7 iniciado: rotas web `/gerencia`, `/analista` e `/cliente` com estrutura visual inicial baseada nos mockups.
- Sprint 7 em andamento: dashboards conectados ao backend (`/auth/me` + `/service-orders`) com fallback de erro.
- Sprint 7 em andamento: filtros web por periodo/status/prioridade/tipo/busca e endpoint `/service-orders/summary`.
- Sprint 7 em andamento: agregacoes server-side (`byPriority`, `byType`, `topAssignees`) e paginacao web.
- Sprint 7 em andamento: ordenacao server-side (`orderBy`, `orderDir`) integrada aos filtros web.
- Sprint 7 em andamento: exportacao CSV de OS com filtros ativos + trilha em `AuditLog` e `ReportExport`.
- Sprint 7 em andamento: endpoint e visao de historico de exportacoes CSV por tenant (`/service-orders/export/history` + card em `/gerencia`).
- Sprint 7 em andamento: persistencia de arquivo CSV e download por export (`/service-orders/export/:id/download`).
- Sprint 7 em andamento: rotina de retencao de arquivos de export no worker (`EXPORT_RETENTION_DAYS`) com limpeza automatica e endpoint manual (`/jobs/exports/cleanup`).
- Sprint 7 em andamento: login web unificado sem cadastro publico, sessao por cookies HTTP-only e roteamento por papel (`/login`, middleware `/gerencia|/analista|/cliente`).
- Sprint 7 em andamento: alinhamento visual de marca entre os 3 portais (Gerencia, Analista, Cliente) com nomenclatura unica `Ajust ERP`.
- Hardening aplicado no escopo atual: criptografia de segredos (`AES-256-GCM`) e trilha de sync/auditoria.

Validacoes executadas:
- `corepack pnpm typecheck` (ok)
- `corepack pnpm test:e2e` com banco em `localhost:8072` (ok)
- `docker compose up -d --force-recreate api worker web` (ok)
- `GET /health` em `api` e `worker` + `GET /` no `web` (ok)

## 9) Proximo bloco imediato (Sprint 7 em diante)

1. Evoluir dashboards conectados:
   - aplicar filtros por tenant, periodo, status e prioridade;
   - criar endpoints agregados (KPIs server-side) para reduzir carga no frontend.
2. Relatorios e exportacao:
   - adicionar politica de notificacao/alerta para falhas na retencao;
   - preparar trilha para formatos adicionais (ex.: consolidado gerencial).
3. Integracao assinc madura:
   - retry com backoff para falhas de webhook/reconciliacao.
4. Seguranca e governanca:
   - completar cobertura de auditoria obrigatoria;
   - fluxo de logout remoto para todos os papeis (MVP+).
5. Go-live por tenant:
   - checklist de onboarding IXC por tenant;
   - plano de piloto (1 tenant) e expansao em lotes.
