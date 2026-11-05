# Plano de análise completa do Ajust ERP

> Início: 04/11/2026 · Escopo: monorepo inteiro (API, web, worker, banco, infraestrutura)
> Achados vão para [CORRECOES.md](./CORRECOES.md). Nada é corrigido durante a análise:
> primeiro a análise inteira, depois as correções em lote, por prioridade.

## Como ler esta lista

| Marca | Significado |
| --- | --- |
| `[ ]` | Ainda não verificado |
| `[x]` | Verificado, sem problema |
| `[!]` | Verificado, há achado (ver `C-xxx` em CORRECOES.md) |
| `[~]` | Verificado em parte (motivo anotado ao lado) |

**Como cada item é verificado:** leitura do código (backend e tela), regras de permissão por papel
(super_admin, gerente, analista, cliente), isolamento entre empresas (tenant), concorrência (duas
pessoas ao mesmo tempo), casos de borda, mensagens ao usuário e testes existentes. Quando for
útil, rodo testes e **consultas só de leitura** no banco local. Não altero dados.

**Severidade dos achados**

- **Crítica**: vazamento de dados, quebra de isolamento entre empresas, perda de dados, escalada de permissão.
- **Alta**: regra de negócio errada que afeta atendimento, SLA ou fechamento; o sistema fica inconsistente.
- **Média**: comportamento confuso, falha em caso de borda, falta de validação, desempenho ruim.
- **Baixa**: código morto, duplicação, texto, padronização.

---

## Fase 1 — Atendimento e abertura de chamado (prioridade) · concluída em 04/11/2026

### 1.1 Abertura de atendimento
- [!] Tela de abertura (`attendance-intake.tsx`, `order-contract-form.tsx`): C-011, C-012 (troca de serviço já corrigida em C-003)
- [!] `POST /service-orders/occurrences` → `createOccurrenceWithFirstOrder`: C-004, C-006, C-008, C-010
- [!] `POST /service-orders` → `create`: C-005, C-007
- [!] `POST /service-orders/occurrences/:id/orders` → `createOrderInOccurrence`: C-004 (status livre); bloqueio de ocorrência encerrada já corrigido (C-003)
- [x] Geração de protocolo e número de ocorrência: corrigido em C-003 e validado no banco local
- [!] Catálogo de serviços (`service-catalog`): C-009 (código de fluxo sem validação); permissões ok (escrita só gerente)
- [~] Rascunho de O.S. e despacho rápido (`order-draft.ts`, `quick-dispatch-dialog.tsx`): não aprofundado; usam os mesmos endpoints acima
- [~] Origens do atendimento: telefone/tela ok; chat, Zabbix e IXC ver 1.11

### 1.2 Ciclo de vida da O.S.
- [!] Máquina de estados em `transition`: C-014, C-015, C-030
- [!] Operações do analista (`POST :id/operations`): C-013, C-018
- [!] Edição (`PATCH :id` → `updateOrder`): C-005, C-007, C-025
- [!] Concorrência: operações e motor v2 corretos; edição e transição com versão opcional (C-017); workflows sem versão (C-037)
- [!] Coerência entre os caminhos de mudança de estado: C-013, C-035
- [x] Eventos de status e histórico: gravados em transition, operations e motor v2 (faltam em workflow e IXC: C-037, C-045)
- [!] Telas `order-board.tsx`, `record-workspace.tsx`: C-015

### 1.3 Ocorrência
- [!] Listagem e detalhe: C-019 (isolamento do papel cliente), C-022 (sem limite)
- [x] `PATCH occurrences/:id`: bloqueio com O.S. pendente e transação serializável ok
- [!] `POST occurrences/:id/close`: C-016 (não atômico)
- [x] Sincronização do estado: unificada em `occurrence-sync.ts` (C-003); exceções em C-034, C-045
- [~] Anotações: criação e edição com controle de versão ok; não revisei todas as regras de visibilidade ao cliente
- [~] Tela `occurrence-attendance.tsx`: não aprofundada

### 1.4 SLA e prazos
- [!] `sla-engine.service.ts`: C-024, C-026, C-031
- [!] Calendário e exceções: C-026
- [!] Políticas de SLA: C-024
- [x] Pausa e retomada: cálculo em minutos úteis e `SlaAuditEvent` ok (só nas operações; ver C-030)
- [!] Prazo manual × calculado: C-005, C-006, C-025
- [x] `service-order-deadlines.ts`: filtros corretos e com fuso do tenant
- [~] `/sla/simulate`, `/sla/breaches`, `/sla/audit/:orderId`: consultas ok; simulação não explica a política escolhida (ver C-024)
- [!] Monitor no worker: C-027, C-028, C-029
- [~] Telas de SLA: não aprofundadas

### 1.5 Encerramento e pós-atendimento
- [!] Fechamento por transition × finish: C-013
- [!] Aprovação de fechamento atrasado: C-003 (corrigido na transição), C-013 e C-039 (faltam nos outros caminhos)
- [!] Reabertura: C-014
- [~] Cancelamento: só pela transição (gerente ou analista, motivo obrigatório); falta limpar agendamento e calendário ao cancelar (baixa, anotar na correção de C-013)
- [!] CSAT automático: C-032
- [!] WhatsApp ao resolver/fechar: C-033
- [x] Mudanças vinculadas (`changeRequest`) ao concluir: ok no `finish`
- [~] Tela de encerramento: não aprofundada

### 1.6 Workflows, processos e automações
- [!] Inventário do que dispara o quê: C-035
- [!] `workflows.service.ts` + `action-executor.service.ts`: C-036, C-037
- [!] `os-process-templates`: C-034
- [!] `service-processes` (v1): ainda exposto na tela e no BFF; ver C-035
- [~] `operational-processes` (v2): concorrência e permissões ok; C-038, C-039; regras de definição não revisadas por completo
- [~] Importadores SGP: não aprofundados (rodam por script)
- [~] Telas de workflow e processo: não aprofundadas; os gatilhos oferecidos estão em C-036

### 1.7 Visão gerencial
- [~] Dashboard do gerente: os números vêm de `summary` e `reports`; ver C-040, C-042
- [!] `GET /service-orders/summary` e listagem: C-041, C-042
- [x] Alertas operacionais: consulta limitada a 200 e por tenant
- [~] Trilha da O.S.: não aprofundada
- [!] Relatórios: C-040
- [x] Exportação CSV: permissões (sem cliente), histórico e download por tenant ok
- [~] Análise por tipo de serviço: mesmo padrão de C-040

### 1.8 Visão do analista
- [~] "Meu trabalho": usa `scope=mine` (dono ou responsável); tela não aprofundada
- [!] Escopo do analista: C-018
- [x] Passagem de atendimento (assign): valida membro ativo da equipe e registra nota
- [ ] Integração com a escala: fica para a Fase 3.3

### 1.9 Provedores, clientes e portal
- [!] `customers`: C-002 (teste), C-008
- [x] Portal do cliente vinculado: bem isolado por `customerId`
- [!] Papel `cliente` nas rotas de O.S.: C-019
- [ ] Perfil do provedor e operações: fica para a Fase 3

### 1.10 Anexos
- [!] Upload: C-023
- [x] Download: escopo por tenant e papel, `nosniff`, `attachment`, proteção de caminho

### 1.11 Entradas automáticas de chamados
- [!] Webhook de monitoramento: C-044
- [!] Webhook genérico (chat): C-043
- [!] IXC: C-045 (reconciliação do worker fica para a Fase 4)

---

## Fase 2 — Segurança e partes críticas da plataforma · concluída em 04/11/2026

### 2.1 Autenticação e sessão
- [!] `auth.service.ts` (login, refresh, troca e recuperação de senha): C-048, C-050, C-052; recuperação de senha ok, mas quebrada sem `JWT_RESET_SECRET` (C-047)
- [!] 2FA/TOTP: C-051; token temporário corretamente recusado como acesso
- [x] Bootstrap (OTP do primeiro acesso): aleatório, com hash, limite de tentativas, um ativo por vez (usa `Tenant.taxId`, ver C-050)
- [x] Sessões: expiração, revogação no logout, na troca de senha e no reset
- [!] Rate limits: C-049

### 2.2 Autorização e isolamento entre empresas
- [x] `auth.guard.ts`: exige `typ: access`, sessão válida e papel atual do banco; restringe o cliente vinculado às rotas do portal
- [!] `tenant-isolation.guard.ts`: correto para `tenantId` em query/body; o problema é o escopo do IAM e do cliente sem vínculo (C-019, C-021)
- [~] Varredura de `tenantId` nas consultas: feita nos módulos de atendimento, IAM, cofre, portal e integrações; os demais módulos na Fase 3
- [!] IAM: C-020, C-021 (inclui remoção de usuário)
- [~] Administração de tenants (telas): não aprofundada
- [~] Acesso na tela (`lib/erp/access.ts`) × API: a API é a fonte de verdade; telas só escondem

### 2.3 BFF e borda
- [x] `lib/bff` (allowlist, forward, scope): allowlist por método e rota, bloqueio de mutação de outra origem, cookies HttpOnly/SameSite; repasse de `x-forwarded-for` em C-049
- [~] `proxy.ts`, `next.config.mjs` (cabeçalhos de segurança): não aprofundado
- [!] `main.ts` da API e exposição: C-046, C-057
- [!] WebSocket: C-053

### 2.4 Cofre de credenciais
- [x] Criptografia: AES-256-GCM, IV aleatório, chave dedicada `0600`
- [!] Revelação, auditoria e gestão da chave: C-054
- [~] Telas do cofre: não aprofundadas

### 2.5 Auditoria
- [!] `audit.interceptor.ts`: redação correta; C-056
- [ ] Arquivamento de auditoria (worker): Fase 4

### 2.6 Proteções gerais
- [!] SSRF guard: C-055
- [x] `path-security`: download de anexo validado contra a raiz
- [x] Chaves de API: hash SHA-256, expiração, revogação, só gerente
- [!] Segredos e configuração: C-047, C-058

---

## Fase 3 — Demais módulos · concluída em 04/11/2026

- [x] Varredura de isolamento (`tenantId`) em todos os módulos desta fase: sem achados
- [~] 3.1 Ajustpedia (`knowledge`, artigos): papéis por operação ok; busca e tags não aprofundadas
- [!] 3.2 Agenda e calendário: C-060
- [!] 3.3 Plantão e escala: C-059
- [x] 3.4 Relatórios de turno: anexos com validação extensão × tipo, caminho relativo, autoria; rascunhos fora da auditoria genérica
- [!] 3.5 Topologias de rede: versão otimista e histórico ok; C-064
- [x] 3.6 CMDB e ativos: tenant e papéis ok (exclusão só gerente); snapshots não aprofundados
- [!] 3.7 Gestão de mudanças: tabela de transições ok; C-063
- [!] 3.8 Apontamento de horas: C-062
- [~] 3.9 Notificações: configuração só gerente e destino validado; conteúdo das mensagens em C-029, C-033
- [!] 3.10 Notas pessoais: C-061
- [~] 3.11 Saúde e monitoramento: `/health`, `/ready`, `/live` públicos e sem dados sensíveis; métricas em C-057
- [~] 3.12 Configurações e identidade: logo validado pela assinatura; telas não aprofundadas

---

## Fase 4 — Worker e tarefas agendadas · concluída em 04/11/2026

- [!] Agendador de filas: sem duplicidade entre instâncias (BullMQ), mas não lê senha/TLS do Redis (C-065)
- [x] Autenticação do worker: token em tempo constante, fechado quando vazio
- [!] Processadores: SLA (C-027, C-028, C-029, C-069), reconciliação IXC (C-066, C-067), retenção de exportações (ok), arquivamento de auditoria (C-068), relatório mensal (vai para o contato do tenant; ok para uso interno)
- [x] Falha, retry e logs: tentativas com backoff em todas as filas; erros por O.S. não derrubam a execução; `SyncEvent` registra falhas do IXC

---

## Fase 5 — Banco de dados · concluída em 04/11/2026

- [!] `schema.prisma` (índices, `onDelete`, unicidades): unicidades ok; C-071 (índices), C-074 (cascatas)
- [x] Soft delete respeitado nas consultas (varredura automática; os casos sinalizados já vinham com o filtro)
- [!] Campos só texto: C-070
- [!] Migrations: 39 aplicadas e coerentes com a pasta; 3 fora do git (C-072)
- [~] Dados inconsistentes: base local quase só de demonstração; consultas prontas em `consultas-consistencia.sql` para rodar na produção; C-073 (sessões)

---

## Fase 6 — Infraestrutura e operação · concluída em 04/11/2026

- [!] `Dockerfile`, `docker-compose*.yml`: C-046, C-077, C-078; o compose de produção não publica banco nem Redis e tem healthchecks e limites
- [!] Backups e restauração: C-058, C-076
- [!] Pasta `uploads/`: fora do backup e com a chave do cofre dentro (C-054, C-076)
- [!] Scripts de manutenção: C-079
- [!] `start-api.sh` (ok: `migrate deploy`) e variáveis por ambiente: C-047, C-078
- [!] Acesso externo: C-075 (HTTP sem TLS)

---

## Fase 7 — Qualidade transversal · concluída em 04/11/2026

- [!] Estado atual (typecheck, lint, testes): C-001, C-002, C-085; tabela com os números em CORRECOES.md
- [!] Cobertura das regras críticas: C-081 (integração com banco nunca roda no CI), C-082
- [!] Código morto e duplicado: C-083
- [!] Arquivos grandes: C-084
- [x] Desempenho: sem achados novos além de C-022, C-040, C-041, C-069, C-071
- [!] Consistência de UX (mensagens): C-080

---

## Encerramento da análise

Concluída em 04/11/2026: 7 fases, cerca de 130 itens verificados (≈30 parciais, com o motivo anotado).
Resultado em [CORRECOES.md](./CORRECOES.md) e a sequência sugerida em [ORDEM_CORRECOES.md](./ORDEM_CORRECOES.md).
As consultas para conferir a base real estão em [consultas-consistencia.sql](./consultas-consistencia.sql).

## Registro de andamento

| Data | Fase | Itens verificados | Achados novos |
| --- | --- | --- | --- |
| 04/11/2026 | Preparação | Inventário e plano | C-001 a C-003 (linha de base) |
| 04/11/2026 | Fase 1 | 1.1 a 1.11 (≈70 itens; 17 parciais) | C-004 a C-045 (3 críticas, 15 altas) |
| 04/11/2026 | Fase 2 | 2.1 a 2.6 (≈25 itens; 6 parciais) | C-046 a C-058 (2 críticas, 1 alta) |
| 04/11/2026 | Fase 3 | 3.1 a 3.12 (13 itens; 5 parciais) | C-059 a C-064 (sem críticas nem altas) |
| 04/11/2026 | Fase 4 | 4 itens | C-065 a C-069 (1 alta) |
| 04/11/2026 | Fase 5 | 5 itens (1 parcial) | C-070 a C-074 (sem críticas nem altas) |
| 04/11/2026 | Fase 6 | 6 itens | C-075 a C-079 (2 altas) |
| 04/11/2026 | Fase 7 | 6 itens | C-080 a C-085 (sem críticas nem altas) |


## Continuação das correções — 04/11/2026

Lote 6 retomado: cofre, SSRF, métricas, auditoria, anexos, travas de manutenção, módulos Nest,
limpeza de cópias em docs, lint e integração com banco no CI. O detalhamento e os limites estão
em [CORRECOES.md](./CORRECOES.md#continuação-do-lote-6--04112026).

As marcações das fases acima preservam o resultado da auditoria original; o estado das correções
fica na tabela-resumo de CORRECOES.md. Esta continuação altera código e testes por solicitação do
usuário, sem modificar dados reais. C-072 (commits), partes de C-079/C-082/C-084 e implantação
continuam pendentes.

Validação local: tipos e lint sem erros/avisos, formatação aprovada, 640 testes API e 54 worker
com cobertura, 61 testes nas suítes de integração com PostgreSQL descartável e 4 testes das travas
de scripts. Os grupos de testes podem se sobrepor. Validação visual em navegador permanece pendente.


### Continuação do lote 7 — 04/11/2026

Correções de agenda, notas pessoais, horas, mudanças, histórico e sessões; retenção de revisões,
índices e proteção de histórico contra exclusão física; simplificação do motor de SLA.
Também complementadas proteções de refresh, WebSocket e rate limit e preparado compose de produção.
Achados parciais e dependências de implantação permanecem explícitos em CORRECOES.md.
Não foram alterados dados reais nem reiniciados serviços nesta continuação.

Validação: typecheck, lint e formatação passaram; 660 testes API e 55 worker com cobertura,
5 testes direcionados (incluindo dois novos para customerId) e 62 testes de integração em
13 suítes com PostgreSQL descartável. Números dos grupos não representam casos únicos somáveis.


### Fechamento adicional — 04/11/2026

Implementados login por identidade não ambígua, proteção contra reuso de TOTP e configuração
obrigatória para gestão, retirada das entradas legadas de automação após inventário somente leitura,
paginação/total de horas e proteção de dumps. D-2/D-5 decididas pelo usuário. HTTPS/backup externo
aguardam infraestrutura ainda não definida. Estado detalhado e limites em CORRECOES.md.

Validação desta etapa: 666 testes API e 55 worker com cobertura; 63 testes de integração
em PostgreSQL descartável; 6 testes de scripts. Tipos, lint e formatação aprovados.
Consultas à base da aplicação limitadas ao inventário em transação READ ONLY.

Continuação autorizada em 04/11: HTTPS/backup externo excluídos por ora. Atualização/transição
de O.S. e auditoria de SLA tornaram-se transacionais; testes de rollback em PostgreSQL passaram.
Validação desta continuação: 666 testes API e 65 testes de integração em 15 suítes; tipos,
lint e formatação aprovados. Demais pendências de código continuam autorizadas.


Continuação de 04/11: conclusão conjunta transacional inclusive no v2 (C-016), identidade
segura da autoria (C-007) e reconciliação IXC delegada pelo worker à API (C-066).
669 testes API, 49 worker, 68 testes de integração; tipos/lint/formatação aprovados.
