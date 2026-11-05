# Correções encontradas na análise

> Gerado durante a execução de [PLANO_ANALISE.md](./PLANO_ANALISE.md).
> Cada achado tem um ID fixo (`C-001`…). As correções serão feitas **depois** da análise
> completa, na ordem de severidade.

## Resumo

**Totais:** Crítica: 6 · Alta: 20 · Média: 34 · Baixa: 26 · Outros: 1

> **Urgente, sem esperar o fim da análise:** C-046 + C-065 + C-047 + C-078 (servidor público com banco/Redis expostos e segredos de desenvolvimento), C-075 (HTTP sem TLS), C-076 (backup de hoje, com a chave do cofre, fora do servidor); depois C-019, C-020, C-021.

| ID | Severidade | Item | Título | Status |
| --- | --- | --- | --- | --- |
| C-001 | Média | 7 | Typecheck do web quebrado: falta a prop `change` | Corrigido (sem commit) |
| C-002 | Baixa | 1.9 | Teste de clientes desatualizado em relação ao controller | Corrigido (sem commit) |
| C-003 | — | 1.1, 1.2, 1.3, 1.5 | Correções de regra já aplicadas em 04/11 (registro) | Corrigido, sem commit |
| C-004 | Alta | 1.1 | A abertura aceita O.S. já nascendo resolvida, fechada ou cancelada | Corrigido (sem commit; já em execução) |
| C-005 | Alta | 1.1 | Prazo (`deadlineAt`) livre na abertura e na edição, sem motivo nem auditoria de SLA | Corrigido (sem commit; já em execução) |
| C-006 | Média | 1.1 | Data de abertura retroativa (`createdAt`) aceita do cliente e inconsistente com o prazo | Corrigido (sem commit; já em execução) |
| C-007 | Média | 1.1 | "Aberto por" e responsáveis aceitam qualquer pessoa e, em `create`, até usuários do perfil cliente | Corrigido no código (implantação pendente) |
| C-008 | Média | 1.1 | Abertura sem `customerId` cria ocorrência com provedor só em texto | Corrigido no código (não implantado) |
| C-009 | Alta | 1.1 | Serviço do catálogo com modelo de processo inexistente ou não publicado bloqueia toda abertura | Corrigido (sem commit; já em execução) |
| C-010 | Alta | 1.1 | O evento `order_created` dos workflows não dispara na abertura principal | Corrigido (sem commit; já em execução) |
| C-011 | Baixa | 1.1 | A escolha de "ocorrência existente" lista ocorrências encerradas | Corrigido (sem commit; já em execução) |
| C-012 | Baixa | 1.1 | Opção "Registrar como concluído" fica abaixo do botão de enviar | Corrigido (sem commit; já em execução) |
| C-013 | Alta | 1.2 | "Concluir" pelas operações do analista fecha a O.S. sem aprovação, auditoria, CSAT, WhatsApp, eventos ou workflow | Corrigido (em execução) |
| C-014 | Alta | 1.2 | Reabrir pela transição mantém `closedAt` e `resolvedAt` antigos | Corrigido (sem commit; já em execução) |
| C-015 | Média | 1.2 | Telas de transição oferecem todos os status e aparecem em O.S. presas a um processo | Corrigido (sem commit; já em execução) |
| C-016 | Média | 1.2 | Concluir a ocorrência inteira não é atômico | Corrigido no código (implantação pendente) |
| C-017 | Baixa | 1.2 | `expectedVersion` opcional na edição e na transição | Corrigido (sem commit; já em execução) |
| C-018 | Baixa | 1.2 | Analista pode operar O.S. de outro analista sem registro de "assumir" | Resolvido por decisão de negócio (colaboração permitida) |
| C-019 | Crítica | 1.3 | Usuário "cliente" sem provedor vinculado enxerga atendimentos de todos os provedores | Corrigido (sem commit; já em execução) |
| C-020 | Crítica | 2.2 | Cadastrar usuário com e-mail já existente troca a senha e o nome dessa pessoa | Corrigido (sem commit; já em execução) |
| C-021 | Crítica | 2.2 | Gerente altera e-mail, senha e papel de qualquer membro, inclusive super_admin, em qualquer tenant | Corrigido (sem commit; já em execução) |
| C-022 | Média | 1.3 | Listagem de ocorrências sem limite padrão e sempre com todas as anotações | Corrigido (sem commit; já em execução) |
| C-023 | Baixa | 1.10 | Anexos: o tipo do arquivo depende do que o navegador declara; todos ficam internos; limite de 10 por O.S. para sempre | Corrigido no código (não implantado) |
| C-024 | Alta | 1.4 | Políticas de SLA por prioridade são aceitas, mas nunca aplicadas | Corrigido (sem commit; já em execução) |
| C-025 | Média | 1.4 | Mudar o tipo de serviço da O.S. não recalcula o prazo | Corrigido (sem commit; já em execução) |
| C-026 | Média | 1.4 | Feriados e exceções só funcionam se o servidor rodar em UTC | Corrigido (sem commit; já em execução) |
| C-027 | Média | 1.4 | Monitor de SLA calcula 75% e 90% em tempo corrido, não em horas úteis | Corrigido (sem commit; já em execução) |
| C-028 | Média | 1.4 | Alertas de SLA não voltam a disparar depois que o prazo muda e podem se perder quando falham | Corrigido (sem commit; já em execução) |
| C-029 | Média | 1.4 | Mensagens de alerta de SLA com cliente e horário errados | Corrigido (sem commit; já em execução) |
| C-030 | Baixa | 1.4 | SLA continua correndo em "Aguardando terceiros" e "Aguardando campo" | Corrigido (sem commit; já em execução) |
| C-031 | Baixa | 1.4 | Código morto e caminhos padrão divergentes no motor de SLA | Corrigido no código (não implantado) |
| C-032 | Alta | 1.5 | Pesquisa de satisfação vai para o e-mail da própria Ajust e não sai no fluxo principal | Corrigido (em execução) |
| C-033 | Média | 1.5 | Ao resolver ou fechar, o sistema dispara uma mensagem de "escalonamento" com link interno e IP fixo | Corrigido (sem commit; já em execução) |
| C-034 | Alta | 1.5 | Modelos de processo de O.S. criam O.S. filhas sem SLA, sem vínculo, em laço e depois de a ocorrência encerrar | Corrigido no código (legado desativado; implantação pendente) |
| C-035 | Alta | 1.6 | Cinco motores de automação e cinco caminhos de fechamento sem regra comum | Corrigido (em execução) |
| C-036 | Alta | 1.6 | Gatilho "O.S. crítica" dispara para qualquer O.S.; gatilho "SLA violado" nunca dispara | Corrigido (sem commit; já em execução) |
| C-037 | Alta | 1.6 | Ações de workflow alteram a O.S. sem versão, histórico, auditoria nem regras | Corrigido (sem commit; já em execução) |
| C-038 | Média | 1.6 | Retry do evento `order_closed` reexecuta todas as regras, inclusive as que já deram certo | Corrigido (sem commit; já em execução) |
| C-039 | Média | 1.6 | Fechamento pelo motor de processos não aplica a regra de aprovação | Corrigido (sem commit; já em execução) |
| C-040 | Média | 1.7 | Indicadores por analista agrupam pelo nome em texto e carregam o período inteiro na memória | Corrigido (sem commit; já em execução) |
| C-041 | Média | 1.7 | Listagem de O.S. sem limite padrão | Corrigido (sem commit; já em execução) |
| C-042 | Baixa | 1.7 | "Concluídas" no resumo e nos relatórios inclui O.S. só resolvidas | Corrigido (sem commit; já em execução) |
| C-043 | Alta | 1.11 | Integração de chat (`/webhooks/chat/incoming`) sempre falha | Corrigido (sem commit; já em execução) |
| C-044 | Alta | 1.11 | Alerta do Zabbix abre um chamado novo a cada disparo, sem deduplicar nem fechar na recuperação | Corrigido (em execução) |
| C-045 | Alta | 1.11 | Webhook do IXC muda o status por fora da máquina de estados e cria O.S. sem ocorrência | Corrigido (sem commit; já em execução) |
| C-046 | Crítica | 2.3 | Banco, Redis, pgAdmin, API e worker publicados em todas as interfaces do servidor público | Corrigido em parte (aplicado; web ainda pública até o HTTPS) |
| C-047 | Crítica | 2.6 | Instância pública usando segredos de desenvolvimento e sem os segredos obrigatórios | Corrigido (aplicado) |
| C-048 | Alta | 2.1 | Troca de e-mail da própria conta sem confirmar a senha atual | Corrigido (sem commit; já em execução) |
| C-049 | Média | 2.1 | Rate limit de login usa o IP do proxy e permite bloquear a conta de outra pessoa | Corrigido em parte (proxy/implantação pendentes) |
| C-050 | Média | 2.1 | Login por nome ou prefixo do e-mail é ambíguo; login por CNPJ procura no tenant | Corrigido no código (implantação pendente) |
| C-051 | Média | 2.1 | 2FA não é obrigatório para super_admin e o código TOTP pode ser reutilizado | Corrigido no código (migration e implantação pendentes) |
| C-052 | Baixa | 2.1 | Reuso do refresh token não é detectado | Corrigido no código (não implantado) |
| C-053 | Média | 2.3 | WebSocket: conexões continuam recebendo eventos depois de revogar a sessão ou remover o usuário | Corrigido no código (não implantado nesta continuação) |
| C-054 | Média | 2.4 | Cofre: qualquer analista revela qualquer senha, sem motivo, sem reautenticação e sem limite | Corrigido no código (implantação pendente) |
| C-055 | Média | 2.6 | Proteção contra SSRF pode ser contornada por redirecionamento e por IPv6 | Corrigido no código (não implantado) |
| C-056 | Baixa | 2.5 | Auditoria: IP falsificável, falhas não registradas e ações genéricas | Corrigido no código (não implantado) |
| C-057 | Baixa | 2.6 | `/monitoring/metrics` sem autenticação fora de produção | Corrigido no código (não implantado) |
| C-058 | Baixa | 2.6 | Backup do banco com leitura para qualquer usuário do servidor | Corrigido |
| C-059 | Média | 3.3 | Plantão e escala são dois cadastros separados e nenhum conversa com o atendimento | Resolvido por decisão (D-4) |
| C-060 | Baixa | 3.2 | Qualquer membro lista todos os usuários com e-mail; analista cria eventos na agenda de colegas | Corrigido no código (não implantado) |
| C-061 | Baixa | 3.10 | Notas pessoais podem ser editadas e apagadas pelo gerente sem que ele as veja | Corrigido no código (não implantado) |
| C-062 | Baixa | 3.8 | Apontamento de horas aceita data futura, O.S. encerrada e lista sem paginação | Corrigido no código (implantação pendente) |
| C-063 | Baixa | 3.7 | Transição de RFC sem controle de versão, sem auditoria própria e com autoaprovação | Corrigido no código (migration e implantação pendentes) |
| C-064 | Baixa | 3.5 | Topologias guardam todas as revisões completas, criptografadas com a chave fraca do ambiente | Corrigido (em execução) |
| C-065 | Alta | 4 | O worker ignora senha, banco e TLS do `REDIS_URL` (e isso bloqueia a correção de C-046) | Corrigido (sem commit; em produção) |
| C-066 | Média | 4 | Reconciliação periódica do IXC repete os problemas do webhook e chama a URL configurada sem proteção | Corrigido (em execução) |
| C-067 | Média | 4 | Três geradores de protocolo diferentes; o worker cria objetos no banco fora das migrations | Corrigido (em execução) |
| C-068 | Baixa | 4 | A trilha de auditoria some da tela depois de 90 dias | Corrigido no código (não implantado) |
| C-069 | Baixa | 4 | Worker: varredura completa de SLA a cada minuto, CORS aberto e validação de ambiente só em produção | Corrigido (em execução) |
| C-070 | Média | 5 | Responsáveis, provedor, setor e origem gravados como texto, não como referência | Corrigido (em execução) |
| C-071 | Baixa | 5 | Faltam índices para "Meu trabalho", portal e notas | Corrigido no código (migration pendente) |
| C-072 | Média | 5 | Três migrations e a mudança do schema estão fora do git | Corrigido (na branch, sem push) |
| C-073 | Baixa | 5 | Sessões expiradas nunca são removidas | Corrigido no código (não implantado) |
| C-074 | Baixa | 5 | Algumas exclusões em cascata apagam histórico que deveria ficar | Corrigido no código (migration pendente) |
| C-075 | Alta | 6 | O ERP é acessado por HTTP puro, sem TLS | Em correção (preparado; falta o domínio) |
| C-076 | Alta | 6 | Backups: sem agendamento, só do banco, sem a chave do cofre e no mesmo disco | Em correção (parcial; falta destino externo e agendamento) |
| C-077 | Média | 6 | Redis de produção descarta chaves das filas e do rate limit quando enche | Corrigido nos arquivos de compose (produção pendente) |
| C-078 | Média | 6 | O servidor roda a configuração de desenvolvimento, que lê `.env.example` e monta o repositório inteiro | Em correção (parcial) |
| C-079 | Média | 6 | Scripts de manutenção que apagam ou reescrevem dados não têm trava de ambiente | Corrigido (em execução) |
| C-080 | Média | 7 | Mensagens de erro da API em inglês chegam à tela | Corrigido (sem commit; já em execução) |
| C-081 | Média | 7 | Os testes de integração com banco nunca rodam no CI | Corrigido no código (CI remoto pendente) |
| C-082 | Média | 7 | Lacunas de teste exatamente onde estão os achados críticos e altos | Corrigido em parte |
| C-083 | Baixa | 7 | Cópia antiga do front-end e arquivos compactados versionados dentro de `docs/` | Corrigido no repositório (sem commit) |
| C-084 | Baixa | 7 | Arquivos muito grandes e módulos declarados dentro de controllers | Corrigido em parte |
| C-085 | Baixa | 7 | Avisos de lint pendentes no web e no back-end | Corrigido no código (sem commit) |
| C-086 | Alta | 4 | Worker ficou 22 horas parado porque a validação de ambiente exigia SMTP | Corrigido (sem commit; já em execução) |
| C-087 | Crítica | 5 | Código em execução dependia de 4 migrations não aplicadas: login fora do ar | Corrigido (aplicado) |

**Status possíveis:** Aberto · Em correção · Corrigido · Descartado (com motivo)

---

## Modelo de registro

```
### C-000 · Título curto
- **Severidade:** Crítica | Alta | Média | Baixa
- **Área / item do plano:** ex.: 1.4 SLA e prazos
- **Onde:** caminho/arquivo.ts:linha (e demais arquivos envolvidos)
- **O problema:** o que o código faz hoje.
- **Como acontece:** passos ou dados concretos que levam ao erro.
- **Impacto:** quem é afetado e o que dá errado (gerente, analista, cliente, relatório, SLA…).
- **Correção proposta:** o que mudar e onde; alternativa, se houver.
- **Como validar:** teste, consulta ou passo na tela que prova a correção.
- **Status:** Aberto
```

---

## Achados

### C-001 · Typecheck do web quebrado: falta a prop `change`
- **Severidade:** Média
- **Área / item do plano:** 7 · Qualidade transversal
- **Onde:** `apps/web/components/erp/dashboard.tsx:424,430,436,444` e `apps/web/components/erp/monitor-pages.tsx:44,50,56`
- **O problema:** os cartões de indicador são usados sem a prop `change`, que o componente exige.
- **Como acontece:** `pnpm --filter @ajust/web typecheck` falha com TS2741.
- **Impacto:** o build de produção pode falhar e erros novos ficam escondidos no meio dos antigos.
- **Correção proposta:** tornar `change` opcional no componente (os cartões novos não têm variação) ou informar a variação nas chamadas.
- **Como validar:** typecheck do web sem erros.
- **Lote 6 (04/11):** `Metric.change` opcional em `primitives.tsx`; typecheck do web com 0 erros.
- **Status:** Corrigido (sem commit)

### C-002 · Teste de clientes desatualizado em relação ao controller
- **Severidade:** Baixa
- **Área / item do plano:** 1.9 · Provedores; 7 · Qualidade
- **Onde:** `apps/api/src/customers/customers.controller.spec.ts` (teste "always anchors listing to the authenticated workspace")
- **O problema:** o controller passou a incluir `_count` de ocorrências abertas, mas o teste espera a consulta antiga.
- **Como acontece:** `npx jest src/customers` falha.
- **Impacto:** a suíte não fica verde, e uma regressão real nesse ponto passaria despercebida.
- **Correção proposta:** atualizar a expectativa do teste com o `include` novo, mantendo a checagem do `tenantId`.
- **Como validar:** `npx jest src/customers` verde.
- **Lote 6 (04/11):** teste atualizado com o `include._count` de ocorrências abertas.
- **Status:** Corrigido (sem commit)

### C-003 · Correções de regra já aplicadas em 04/11 (registro)
- **Severidade:** — (registro histórico)
- **Área / item do plano:** 1.1, 1.2, 1.3, 1.5
- **Onde:** `apps/api/src/service-orders/service-orders.service.ts`, `occurrence-sync.ts`, `order-operations.service.ts`, `apps/web/components/erp/order-contract-form.tsx`
- **O que já foi feito:**
  1. Troca de serviço do catálogo sem modal, com "Desfazer" e sem perder o que foi digitado.
  2. Aprovação de fechamento atrasado: só gerente, só com O.S. resolvida, vale a decisão mais recente desta resolução.
  3. Bloqueio de O.S. nova em ocorrência encerrada.
  4. A transição direta de status sincroniza a ocorrência (reabre e encerra).
  5. Protocolo e número de ocorrência pelo maior número do ano, não pela contagem.
- **Pendente:** commit; teste na interface. Os itens 1.5 e 1.2 do plano vão conferir se o caminho `finish` das operações respeita a mesma regra de aprovação (resposta: não respeita, ver C-013).
- **Status:** Corrigido, sem commit

---

## Fase 1.1 — Abertura de atendimento

### C-004 · A abertura aceita O.S. já nascendo resolvida, fechada ou cancelada
- **Severidade:** Alta
- **Área / item do plano:** 1.1 · Abertura; 1.2 · Ciclo de vida
- **Onde:** `apps/api/src/service-orders/service-orders.controller.ts` (`OccurrenceOrderSchema.status`, `CreateOccurrenceSchema.status`); `service-orders.service.ts` → `createOccurrenceWithFirstOrder` (`firstOrderStatus = input.firstOrder.status || 'ABERTA'`) e `createOrderInOccurrence` (`status = input.status || 'ABERTA'`)
- **O problema:** o corpo da requisição pode informar qualquer `status` para a primeira O.S. (`RESOLVIDA`, `FECHADA`, `CANCELADA`) e qualquer status para a ocorrência (`ENCERRADA`). Isso pula a máquina de estados.
- **Como acontece:** `POST /service-orders/occurrences` com `firstOrder.status = "FECHADA"` e sem `recordCompleted`. A O.S. é gravada FECHADA com `closedAt = null` e `resolvedAt = null`, sem evento de status, sem aprovação e com um processo operacional iniciado em cima de uma O.S. fechada. Com `status = "ENCERRADA"` na ocorrência, ela nasce encerrada com uma O.S. aberta dentro.
- **Impacto:** relatórios de fechamento e SLA contam errado (O.S. fechada sem data de fechamento); a regra de aprovação de fechamento atrasado é contornada; a ocorrência fica inconsistente.
- **Correção proposta:** remover `status` dos dois schemas de criação. A O.S. nasce sempre `ABERTA` e a ocorrência sempre `ABERTA`. O único atalho de conclusão continua sendo `recordCompleted`, que já grava datas e eventos.
- **Como validar:** teste de integração: criar com `status: 'FECHADA'` deve retornar 400 ou ignorar o campo; consulta `SELECT count(*) FROM "ServiceOrder" WHERE status='FECHADA' AND "closedAt" IS NULL` para achar registros já afetados.
- **Lote 2 (04/11):** `status` removido de `OccurrenceOrderSchema` e `CreateOccurrenceSchema`; O.S. e ocorrência nascem ABERTA; só `recordCompleted` registra trabalho já feito.
- **Status:** Corrigido (sem commit; já em execução)

### C-005 · Prazo (`deadlineAt`) livre na abertura e na edição, sem motivo nem auditoria de SLA
- **Severidade:** Alta
- **Área / item do plano:** 1.1 · Abertura; 1.4 · SLA e prazos
- **Onde:** `service-orders.controller.ts` (`deadlineAt` em `CreateOrderSchema`, `OccurrenceOrderSchema`, `UpdateOrderSchema`); `service-orders.service.ts` → `create`, `createOccurrenceWithFirstOrder`, `updateOrder` (`...(patch.deadlineAt ? { deadlineAt: new Date(patch.deadlineAt) } : {})`); tela `apps/web/lib/erp/modules.ts` (campo "Prazo excepcional")
- **O problema:** qualquer analista pode definir ou mudar o prazo da O.S. para qualquer data: no passado, daqui a um ano, ou adiar o próprio prazo vencido. Não há justificativa obrigatória nem registro em `SlaAuditEvent`, e o histórico da O.S. só diz "Campos da O.S atualizados manualmente".
- **Como acontece:** O.S. vencida → `PATCH /service-orders/:id` com `deadlineAt` daqui a uma semana → a O.S. sai do "vencido" e o indicador de SLA melhora.
- **Impacto:** o SLA perde a confiabilidade; o gerente não vê quem mudou o prazo nem por quê.
- **Correção proposta:** (1) mudança de prazo só por gerente/super_admin, ou por analista com motivo obrigatório; (2) gravar `SlaAuditEvent` (`DEADLINE_CHANGED`) com o prazo anterior, o novo, o autor e o motivo; (3) rejeitar prazo no passado; (4) guardar `originalDeadlineAt` na primeira alteração; (5) mostrar no histórico qual campo mudou.
- **Como validar:** teste de `updateOrder` com analista sem motivo → 400/403; com gerente → evento de auditoria criado.
- **Lote 2 (04/11):** mudar o prazo de O.S. aberta é só da gestão, com motivo obrigatório e data futura; grava `SlaAuditEvent DEADLINE_CHANGED`, guarda `originalDeadlineAt` e registra no histórico. Na abertura, o prazo excepcional precisa estar no futuro. Reenviar o mesmo prazo (formulário completo) não conta como mudança. Campo "Motivo da mudança de prazo" na edição.
- **Status:** Corrigido (sem commit; já em execução)

### C-006 · Data de abertura retroativa (`createdAt`) aceita do cliente e inconsistente com o prazo
- **Severidade:** Média
- **Área / item do plano:** 1.1 · Abertura
- **Onde:** `CreateOccurrenceSchema.createdAt`; `createOccurrenceWithFirstOrder` (`occurrenceCreatedAt = input.createdAt ? new Date(input.createdAt) : now`)
- **O problema:** a ocorrência pode ser criada com qualquer data de abertura, inclusive futura. A O.S. criada junto continua com `createdAt = agora` e prazo calculado a partir de agora, não da data informada.
- **Como acontece:** abrir uma ocorrência com `createdAt` de 10 dias atrás: ela aparece como antiga nos relatórios, mas a O.S. dentro dela tem SLA "no prazo".
- **Impacto:** relatórios por período e tempo de atendimento ficam incoerentes; dá para manipular datas.
- **Correção proposta:** se a data retroativa for necessária (registro de atendimento já feito), restringir a gerente, exigir que não seja futura, e usar a mesma data como base do prazo e da O.S. Caso contrário, remover o campo do schema.
- **Como validar:** teste: `createdAt` futuro → 400; analista com `createdAt` → 403.
- **Lote 2 (04/11):** data retroativa só para gerente/super_admin, nunca no futuro, e passa a valer também para a O.S. e para o cálculo do prazo.
- **Status:** Corrigido (sem commit; já em execução)

### C-007 · "Aberto por" e responsáveis aceitam qualquer pessoa e, em `create`, até usuários do perfil cliente
- **Severidade:** Média
- **Área / item do plano:** 1.1 · Abertura
- **Onde:** `service-orders.service.ts` → `create` (verifica só se o usuário pertence ao tenant, não o papel); `updateOrder` (mesma coisa); `apps/web/lib/erp/modules.ts` (`ownerUserId` "Aberto por" é um campo de escolha); `CreateOccurrenceSchema.openedByName` (texto livre)
- **O problema:** (a) quem abre escolhe livremente quem consta como "Aberto por", em vez de o sistema usar o usuário autenticado; (b) `create` e `updateOrder` aceitam como responsável um usuário com papel `cliente` do mesmo tenant, enquanto `createOccurrenceWithFirstOrder` já exige papel da equipe (`role: { code: { in: ROLE_SET } }`).
- **Como acontece:** analista A abre a O.S. e escolhe B em "Aberto por"; o histórico registra a autoria errada. Ou, via API, atribui a O.S. a um login de cliente.
- **Impacto:** autoria e produtividade erradas nos relatórios; O.S. atribuída a quem não pode trabalhar nela.
- **Correção proposta:** `ownerUserId` = usuário autenticado (gerente pode sobrescrever ao registrar em nome de outro, com registro no histórico); aplicar o filtro de papel da equipe em `create` e `updateOrder`, reaproveitando uma função única de validação de membros.
- **Como validar:** teste: `assigneeUserId` de usuário cliente → 400 nos três caminhos.
- **Lote 2 (04/11):** `teamMemberNames`: `create` e `updateOrder` só aceitam responsáveis com papel de equipe (mesma regra da abertura). "Aberto por" escolhido à mão continua (decisão de produto).
- **Status:** Corrigido no código (implantação pendente)
- **Continuação sem nova autorização (04/11):** Abertura autenticada usa o próprio usuário como autor por padrão; analista não substitui o autor. Gestão pode registrar em nome de membro ativo da equipe, conservando o ator autenticado no histórico. Edição por analista não altera autoria; nomes sem IDs correspondentes não são aceitos para substituir os snapshots. Abertura principal valida também status e exclusão dos membros.

### C-008 · Abertura sem `customerId` cria ocorrência com provedor só em texto
- **Severidade:** Média
- **Área / item do plano:** 1.1 · Abertura; 1.9 · Provedores; 5 · Banco
- **Onde:** `CreateOccurrenceSchema` (`customerId` opcional, `provider` texto obrigatório); `createOccurrenceWithFirstOrder`
- **O problema:** a tela sempre envia `customerId`, mas a API aceita abrir atendimento só com o nome do provedor digitado. A ocorrência fica sem vínculo com o cadastro.
- **Como acontece:** integração ou script chama a API sem `customerId` → a ocorrência não aparece no portal do provedor, nem na contagem de ocorrências abertas do cadastro, nem nos filtros por cliente.
- **Impacto:** atendimentos "órfãos", que somem do portal e dos relatórios por provedor.
- **Correção proposta:** tornar `customerId` obrigatório na criação pela equipe (manter texto livre só para importação, com uma flag explícita); derivar `provider` sempre do cadastro.
- **Como validar:** consulta `SELECT count(*) FROM "Occurrence" WHERE "customerId" IS NULL AND "deletedAt" IS NULL`; teste de schema.
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** A rota de abertura manual exige customerId UUID. A identificação do provedor passa pelo cadastro validado no serviço; integrações automáticas mantêm seus contratos próprios.

### C-009 · Serviço do catálogo com modelo de processo inexistente ou não publicado bloqueia toda abertura
- **Severidade:** Alta
- **Área / item do plano:** 1.1 · Catálogo; 1.6 · Processos
- **Onde:** `apps/api/src/service-catalog/service-catalog.service.ts` (`create`/`update` gravam `workflowTemplateCode` sem validar); `operational-processes.service.ts:start` (`if (!template?.publishedAt) throw 'Publique o modelo antes de iniciar.'`); chamado dentro da transação de `create` e `createOccurrenceWithFirstOrder`
- **O problema:** toda O.S. aberta por ocorrência inicia um processo operacional (`AJUST_SIMPLES` ou o código do catálogo). Se o código não existir, não estiver publicado ou for despublicado depois, a abertura inteira falha com uma mensagem que o analista não tem como resolver.
- **Como acontece:** gerente cadastra no catálogo o serviço "BGP" com `workflowTemplateCode = "BGP_V2"` ainda em rascunho → todo atendimento que escolhe esse serviço falha ao salvar. Se `AJUST_SIMPLES` for despublicado, nenhum atendimento abre.
- **Impacto:** parada total ou parcial da abertura de chamados.
- **Correção proposta:** (1) validar no catálogo que o código existe e está publicado; (2) impedir despublicar ou excluir um modelo usado por serviço ativo ou pelo padrão; (3) na tela do catálogo, escolher o modelo numa lista, não digitar; (4) mensagem clara para o analista ("O serviço X está sem fluxo publicado; avise a gestão").
- **Como validar:** teste do catálogo com código inexistente → 400; teste de despublicação de modelo em uso → 409.
- **Lote 3 (04/11):** o catálogo recusa código de fluxo inexistente ou não publicado; a mensagem na abertura diz qual fluxo falta e o que fazer. Salvar rascunho de fluxo não despublica, então um fluxo publicado não some depois.
- **Status:** Corrigido (sem commit; já em execução)

### C-010 · O evento `order_created` dos workflows não dispara na abertura principal
- **Severidade:** Alta
- **Área / item do plano:** 1.1 · Abertura; 1.6 · Workflows
- **Onde:** `service-orders.service.ts` → `createOccurrenceWithFirstOrder` (não chama `workflowsService.executeForEvent`); só `create` chama (linha ~429)
- **O problema:** a abertura pela tela "Novo atendimento" cria a primeira O.S. por `createOccurrenceWithFirstOrder`, que não dispara as regras de workflow de "O.S. criada". Só as O.S. adicionadas a uma ocorrência existente disparam.
- **Como acontece:** gerente cria a regra "ao criar O.S. CRÍTICA, notificar plantão"; abre um novo atendimento crítico → nada acontece.
- **Impacto:** automações configuradas pela gestão não funcionam no caso mais comum.
- **Correção proposta:** extrair os efeitos de "O.S. criada" (auditoria, eventos em tempo real, workflow) para um único método `afterOrderCreated(order)` chamado pelos três caminhos de criação.
- **Como validar:** teste: `createOccurrenceWithFirstOrder` chama `executeForEvent` com `type: 'order_created'`.
- **Lote 2 (04/11):** `afterOrderCreated` (auditoria, eventos em tempo real e workflow `order_created`) nos três caminhos de criação; `recordCompleted` também dispara os efeitos de fechamento.
- **Status:** Corrigido (sem commit; já em execução)

### C-011 · A escolha de "ocorrência existente" lista ocorrências encerradas
- **Severidade:** Baixa
- **Área / item do plano:** 1.1 · Abertura (tela)
- **Onde:** `apps/web/components/erp/reference-field.tsx` (recurso `occurrences` busca `/service-orders/occurrences` sem filtro de status); `attendance-intake.tsx` (modo "Adicionar O.S. a uma ocorrência existente")
- **O problema:** a lista traz ocorrências encerradas. Desde a correção de 04/11 a API recusa O.S. nova nelas, então o usuário escolhe, preenche tudo e só depois recebe o erro.
- **Impacto:** retrabalho e frustração na abertura.
- **Correção proposta:** filtrar a referência de ocorrências por status diferente de `ENCERRADA` nesse campo, ou marcar as encerradas como desabilitadas.
- **Como validar:** na tela, o modo "existente" não oferece ocorrências encerradas.
- **Lote 5 (04/11):** o seletor "Ocorrência existente" da abertura oculta ocorrências encerradas (`reference.hideClosed`).
- **Status:** Corrigido (sem commit; já em execução)

### C-012 · Opção "Registrar como concluído" fica abaixo do botão de enviar
- **Severidade:** Baixa
- **Área / item do plano:** 1.1 · Abertura (tela)
- **Onde:** `apps/web/components/erp/attendance-intake.tsx` (checkbox renderizado depois de `<OrderContractForm>`)
- **O problema:** a caixa que muda o tipo de registro (aberto × já concluído) aparece depois do botão de enviar e fora do formulário. Quem não rola a tela abre como pendente um trabalho que já foi feito.
- **Impacto:** O.S. pendentes que já foram resolvidas, poluindo a fila e o SLA.
- **Correção proposta:** mover a opção para o topo, junto da escolha "Novo atendimento / ocorrência existente", como uma terceira forma clara: "Registrar trabalho já realizado".
- **Como validar:** na tela, a opção aparece antes dos campos.
- **Lote 5 (04/11):** "Registrar trabalho já realizado" agora fica no topo do formulário, em destaque, junto da escolha do destino.
- **Status:** Corrigido (sem commit; já em execução)

---

## Fase 1.2 — Ciclo de vida da O.S.

### C-013 · "Concluir" pelas operações do analista fecha a O.S. sem aprovação, auditoria, CSAT, WhatsApp, eventos ou workflow
- **Severidade:** Alta
- **Área / item do plano:** 1.2 · Ciclo de vida; 1.5 · Encerramento
- **Onde:** `apps/api/src/service-orders/order-operations.service.ts` → `run` (`action: 'finish'` → `data.status = 'FECHADA'`), `closeOccurrence`; comparar com `service-orders.service.ts:transition`
- **O problema:** existem dois caminhos para fechar uma O.S. com regras diferentes. `transition` exige RESOLVIDA antes de FECHADA, aplica a aprovação de atraso, grava auditoria (`OS_CLOSE`), emite evento em tempo real, dispara CSAT, WhatsApp, workflow `order_closed` e modelos de processo de O.S. O `finish` das operações, que é o botão usado pelo analista, fecha de qualquer status (até ABERTA) e não faz nenhuma dessas coisas. O mesmo vale para `start`, `pause`, `assign`, `reopen`: nenhum grava `AuditLog` nem emite evento em tempo real.
- **Como acontece:** analista conclui uma O.S. CRÍTICA atrasada e com `requiresApproval` pelo botão "Concluir" → a O.S. fecha sem aprovação, o cliente não recebe a pesquisa de satisfação nem o WhatsApp, a tela de outro usuário não atualiza e a trilha de auditoria não mostra o fechamento.
- **Impacto:** regra gerencial contornada; automações e comunicação com o cliente falham no fluxo principal; auditoria incompleta.
- **Nuance (vista na Fase 1.6):** quando a O.S. tem processo v2, o `finish` passa pelo motor de processos, que publica `order_closed` para os workflows por uma fila com retry. CSAT, WhatsApp, `AuditLog` e aprovação continuam faltando nesse caminho. Em O.S. sem processo, nem o workflow dispara.
- **Correção proposta:** centralizar a mudança de status num único serviço de domínio (ex.: `ServiceOrderLifecycle.changeStatus`) usado por `transition`, `run` e pelo motor de processos, com: tabela de transições, regra de aprovação, gravação de datas, auditoria, eventos, efeitos pós-fechamento e sincronização da ocorrência. `finish` passaria por RESOLVIDA→FECHADA dentro da mesma operação.
- **Como validar:** testes: `finish` em O.S. crítica atrasada com `requiresApproval` sem aprovação → 403; `finish` grava `AuditLog` `OS_CLOSE` e chama CSAT e workflow.
- **Lote 2 (04/11):** `service-order-rules.ts` (transições, datas, regra de aprovação) e `ServiceOrderLifecycleService` (auditoria, evento em tempo real, sincronização da ocorrência, conclusão do processo, CSAT, WhatsApp, workflow, modelos de O.S.) usados por `transition` e pelas operações. "Concluir" agora resolve e fecha; com aprovação pendente fica RESOLVIDA aguardando a gestão. Iniciar, reabrir e as demais operações gravam auditoria. **Pendente (Lote 3):** `execCloseOrder` dos workflows e as integrações (IXC) ainda gravam o status direto; fechamentos feitos pela tela de processos (`/service-processes/operational/:id/actions`) não disparam CSAT.
- **Conclusão (05/11):** o fechamento pelo motor de processos (botão do analista e tela de processos) roda os efeitos únicos do ciclo de vida pela fila do processo, na primeira entrega; novas tentativas só reenviam os workflows. Todos os caminhos de fechamento passam pelas mesmas regras e efeitos.
- **Status:** Corrigido (em execução)

### C-014 · Reabrir pela transição mantém `closedAt` e `resolvedAt` antigos
- **Severidade:** Alta
- **Área / item do plano:** 1.2 · Ciclo de vida; 1.7 · Relatórios
- **Onde:** `service-orders.service.ts:transition` (`closedAt: to === 'FECHADA' ? now : order.closedAt`, idem `resolvedAt`); comparar com `order-operations.service.ts` reopen (zera os dois)
- **O problema:** FECHADA→EM_ANALISE ou RESOLVIDA→EM_ANALISE pela transição deixa a O.S. ativa com data de fechamento ou resolução preenchida. Além disso, `reopenedCount` só aumenta quando vem de FECHADA; voltar de RESOLVIDA não conta como reabertura.
- **Como acontece:** O.S. fechada, reaberta pelo quadro → relatórios que usam `closedAt IS NOT NULL` ou "fechadas no período" continuam contando a O.S. como fechada.
- **Impacto:** relatórios de produtividade e SLA errados; a regra de aprovação (C-003) usa `resolvedAt` e pode considerar uma resolução antiga.
- **Correção proposta:** ao sair de RESOLVIDA ou FECHADA para um estado ativo, zerar `resolvedAt` e `closedAt` e incrementar `reopenedCount`; fica resolvido de vez com o serviço único de C-013.
- **Como validar:** teste da transição FECHADA→EM_ANALISE verificando `closedAt: null`; consulta `SELECT count(*) FROM "ServiceOrder" WHERE status NOT IN ('FECHADA','CANCELADA') AND ("closedAt" IS NOT NULL OR "resolvedAt" IS NOT NULL)`.
- **Lote 2 (04/11):** `statusDates`: sair de RESOLVIDA/FECHADA para etapa ativa limpa `resolvedAt` e `closedAt` e incrementa `reopenedCount`, nos três caminhos (transição, operações, motor).
- **Status:** Corrigido (sem commit; já em execução)

### C-015 · Telas de transição oferecem todos os status e aparecem em O.S. presas a um processo
- **Severidade:** Média
- **Área / item do plano:** 1.2 · Ciclo de vida (tela)
- **Onde:** `apps/web/components/erp/order-board.tsx` ("Alterar etapa", lista `orderStatuses` inteira); `apps/web/components/erp/record-workspace.tsx` aba "Transição" (lista `orderStatuses` inteira)
- **O problema:** (a) as opções não seguem a tabela de transições do servidor, então o usuário escolhe "FECHADA" a partir de "ABERTA" e recebe erro técnico em inglês ("Transition ABERTA -> FECHADA is not allowed."); (b) quase toda O.S. aberta hoje nasce com processo operacional (ver C-009), e para elas o servidor sempre recusa com "Esta O.S. pertence a um processo"; mesmo assim o formulário aparece. A tela de RFC já filtra as transições (`changeTransitions`), as de O.S. não.
- **Impacto:** tentativa e erro, mensagens em inglês, sensação de sistema quebrado.
- **Correção proposta:** compartilhar a tabela de transições (por exemplo em `packages/shared`) e mostrar só os destinos válidos; esconder a transição manual quando `processInstanceId` existe e apontar para "Concluir etapa"; traduzir as mensagens da API.
- **Como validar:** na tela, uma O.S. ABERTA oferece só "Em análise" e "Cancelada"; uma O.S. com processo não mostra a aba.
- **Lote 5 (04/11):** `nextStatusOptions` (mesma tabela da API) filtra "Próxima etapa" nas três telas (ficha, aba Transição e quadro): ABERTA oferece só Em análise e Cancelada. A tela de ficha já escondia a transição para O.S. com processo. Mensagens de transição inválida agora em português com as opções.
- **Status:** Corrigido (sem commit; já em execução)

### C-016 · Concluir a ocorrência inteira não é atômico
- **Severidade:** Média
- **Área / item do plano:** 1.2 · Ciclo de vida; 1.3 · Ocorrência
- **Onde:** `order-operations.service.ts:closeOccurrence` (laço `for (const order of pending) await this.run(...)`)
- **O problema:** cada O.S. é concluída numa transação separada. Se a terceira de cinco falhar (O.S. com processo que exige escolher o resultado, conflito de versão, evidência faltando), as duas primeiras já ficaram fechadas e a ocorrência fica pela metade.
- **Impacto:** estado parcial que o usuário não esperava ao confirmar "concluir tudo"; a mensagem de erro não diz o que foi fechado.
- **Correção proposta:** validar todas as O.S. antes de fechar qualquer uma (pausa, versão, processo com resultado único, evidências) e executar o conjunto numa transação; ou, se não der, devolver a lista do que foi e do que não foi concluído.
- **Como validar:** teste com 3 O.S. em que a última exige resultado → nenhuma é fechada.
- **Lote 2 (04/11):** a conclusão conjunta valida antes todas as O.S. com processo (etapa ativa e resultado único) e, se alguma não puder, não conclui nenhuma e lista o motivo. Cada O.S. ainda é gravada numa transação própria.
- **Status:** Corrigido no código (implantação pendente)
- **Continuação sem nova autorização (04/11):** Conclusão conjunta usa uma única transação Serializable, compartilhada com o motor operacional v2. Toda validação e gravação ocorre nessa transação; efeitos de fechamento só rodam depois do commit. Teste provoca conflito na segunda ordem e confirma rollback da primeira, da ocorrência e dos históricos, sem efeitos externos. Colaboração sem assumir permitida conforme D-5.

### C-017 · `expectedVersion` opcional na edição e na transição
- **Severidade:** Baixa
- **Área / item do plano:** 1.2 · Concorrência
- **Onde:** `UpdateOrderSchema.expectedVersion`, `TransitionSchema.expectedVersion` (opcionais); as operações já exigem
- **O problema:** sem a versão, a gravação é "última vence". As telas atuais enviam a versão, mas qualquer outro cliente da API sobrescreve alterações de outra pessoa sem aviso.
- **Correção proposta:** tornar obrigatório para chamadas da equipe (manter opcional só para chaves de API de integração, se necessário).
- **Como validar:** teste: `PATCH` sem `expectedVersion` → 400.
- **Lote 2 (04/11):** `PATCH :id` e `PATCH :id/transition` recusam sem versão (corpo ou `If-Match`).
- **Status:** Corrigido (sem commit; já em execução)

### C-018 · Analista pode operar O.S. de outro analista sem registro de "assumir"
- **Severidade:** Baixa (decisão de negócio)
- **Área / item do plano:** 1.2 · Ciclo de vida; 1.8 · Analista
- **Onde:** `order-operations.service.ts:run` (sem checagem de `assigneeUserId`); só `closeOccurrence` restringe o analista às próprias entregas
- **O problema:** um analista pode pausar, reagendar, concluir ou reatribuir a O.S. de um colega. A regra muda conforme o caminho: na conclusão conjunta é proibido, na individual é permitido.
- **Correção proposta:** decidir a regra. Sugestão: o analista age nas próprias O.S. e nas sem responsável; para a de um colega, precisa "assumir" (registra a passagem) ou ser gerente.
- **Como validar:** teste conforme a regra escolhida.
- **Status:** Resolvido por decisão de negócio (colaboração permitida)

---
- **Fechamento de pendências (04/11):** Decisão explícita do usuário: analista pode colaborar na O.S. de colega sem assumir a responsabilidade. Mantida a atribuição; teste confirma gravação do ator autenticado no histórico e ausência de troca implícita do responsável.

## Fase 1.3 — Ocorrência · 1.10 — Anexos (e achados críticos de acesso vistos no caminho)

### C-019 · Usuário "cliente" sem provedor vinculado enxerga atendimentos de todos os provedores
- **Severidade:** Crítica
- **Área / item do plano:** 1.3 · Ocorrência; 1.9 · Portal; 2.2 · Isolamento
- **Onde:** `apps/api/src/auth/auth.guard.ts:104-116` (a restrição ao portal só vale quando `membership.customerId` existe); `service-orders.service.ts` → `list`, `getById`, `listOccurrences`, `getOccurrenceById` (para `cliente`, filtram só `isCustomerVisible: true`, nunca `customerId`)
- **O problema:** uma conta `cliente` sem vínculo de provedor passa pelo guard sem restrição de rotas e chama as rotas gerais (`GET /service-orders`, `GET /service-orders/occurrences`…). Essas rotas mostram, para o papel cliente, tudo o que é "visível ao cliente" **de todos os provedores do workspace**. O próprio comentário em `customer-portal-access.ts` diz que essas rotas "não são seguras para uma consultoria com vários clientes no mesmo workspace".
- **Como acontece:** no banco local há hoje **1 vínculo `cliente` sem `customerId`** (consulta só de leitura em 04/11). Esse usuário faz login e abre `/service-orders/occurrences?includeOrders=true` → recebe ocorrências, O.S., anotações e histórico de outros provedores.
- **Impacto:** vazamento de dados entre clientes da Ajust.
- **Correção proposta:** (1) **fechar por padrão** no guard: `cliente` sem `customerId` → 403 em tudo, exceto `/auth/*` essencial; (2) nos serviços, quando o papel for `cliente`, filtrar também por `customerId = req.auth.customerId` (defesa em profundidade); (3) impedir no IAM a criação de vínculo `cliente` sem provedor; (4) corrigir o vínculo existente.
- **Como validar:** teste do guard: `cliente` sem vínculo chamando `GET /service-orders` → 403; consulta `SELECT count(*) FROM "UserTenant" ut JOIN "Role" r ON r.id=ut."roleId" WHERE r.code='cliente' AND ut."customerId" IS NULL` = 0.
- **Lote 1 (04/11):** `auth.guard.ts`: toda conta cliente, vinculada ou não, só alcança portal e própria conta; sem vínculo recebe "ainda não está vinculada a um provedor". `events.gateway.ts` recusa socket de cliente. IAM passa a exigir `customerId` ao criar usuário cliente (campo "Provedor" na tela de usuários). Teste novo no guard. Pendente: vincular ou remover a conta cliente sem provedor que já existe; filtro por `customerId` nos serviços (defesa em profundidade).
- **Status:** Corrigido (sem commit; já em execução)

### C-020 · Cadastrar usuário com e-mail já existente troca a senha e o nome dessa pessoa
- **Severidade:** Crítica
- **Área / item do plano:** 2.2 · IAM (achado antecipado)
- **Onde:** `apps/api/src/iam/iam.service.ts:createUser` (ramo `if (existingUser)` → `tx.user.update({ data: { name, passwordHash, status: 'ACTIVE', deletedAt: null } })`); `iam.controller.ts:229` (`POST /iam/users` aceita `super_admin`, `gerente`, `cliente`)
- **O problema:** o usuário (`User`) é global, compartilhado entre tenants. Ao "vincular" um e-mail que já existe a outro tenant, o sistema sobrescreve a senha dele com a informada por quem está cadastrando, além de reativar uma conta excluída.
- **Como acontece:** um gerente (ou um cliente sem vínculo, ver C-019) chama `POST /iam/users` com o e-mail do super_admin, um tenant onde ele ainda não é membro e uma senha escolhida → a senha do super_admin passa a ser essa, e a pessoa entra como super_admin.
- **Impacto:** tomada de qualquer conta, inclusive administrativa.
- **Correção proposta:** se o e-mail já existe, **não tocar** em senha, nome, status ou `deletedAt`: só criar o vínculo (e, idealmente, enviar convite para a pessoa aceitar). Bloquear vínculo de contas excluídas sem ação do super_admin.
- **Como validar:** teste: `createUser` com e-mail existente mantém o `passwordHash` anterior.
- **Lote 1 (04/11):** `iam.service.ts:createUser`: e-mail existente só ganha o vínculo; nome, senha e situação ficam intocados; conta inativa ou excluída é recusada. Testes novos.
- **Status:** Corrigido (sem commit; já em execução)

### C-021 · Gerente altera e-mail, senha e papel de qualquer membro, inclusive super_admin, em qualquer tenant
- **Severidade:** Crítica
- **Área / item do plano:** 2.2 · IAM (achado antecipado)
- **Onde:** `apps/api/src/iam/iam.controller.ts:422` (`assertTenantScope` libera `super_admin`, `gerente` **e `analista`** para qualquer tenant); `iam.controller.ts:252` (`PATCH /iam/users/:userId` aceita `targetTenantId`); `iam.service.ts:updateUserInTenant` (não verifica o papel atual do usuário-alvo)
- **O problema:** `assertRoleAssignment` só confere o papel **novo**, não o papel atual do alvo. Um gerente pode mudar e-mail e senha de um super_admin que seja membro de qualquer tenant. Além disso, o escopo entre tenants vale para todo gerente e analista, não só para a equipe da consultoria.
- **Como acontece:** gerente chama `PATCH /iam/users/<id do super_admin>` com `password` → assume a conta.
- **Impacto:** escalada de privilégio e tomada de conta.
- **Também (visto na Fase 2):** `DELETE /iam/users/:userId` (`removeUserFromTenant`) também não olha o papel do alvo. Um gerente remove um super_admin do tenant e, se for o último vínculo, a conta é desativada e marcada como excluída.
- **Correção proposta:** (1) gerente só edita usuários com papel `gerente`, `analista` ou `cliente`, nunca super_admin, e não edita a si mesmo por essa rota; (2) troca de senha ou e-mail de terceiros revoga as sessões do alvo e gera auditoria; (3) rever `assertTenantScope`: acesso entre tenants só para super_admin ou para tenants explicitamente gerenciados; analista não deveria passar.
- **Como validar:** testes: gerente editando super_admin → 403; analista com `targetTenantId` de outro tenant → 403.
- **Lote 1 (04/11):** `assertCanManageUser`: só super admin altera ou remove quem é super admin em qualquer tenant; `assertTenantScope` libera outro tenant só para super admin; troca de e-mail de terceiro revoga as sessões dele. Testes novos.
- **Status:** Corrigido (sem commit; já em execução)

### C-022 · Listagem de ocorrências sem limite padrão e sempre com todas as anotações
- **Severidade:** Média
- **Área / item do plano:** 1.3 · Ocorrência; 7 · Desempenho
- **Onde:** `service-orders.service.ts:listOccurrences` (`take` só se `limit` vier; `include.annotations` sempre, sem limite)
- **O problema:** sem `limit`, a rota devolve todas as ocorrências do workspace com todas as anotações de cada uma; com `includeOrders`, também todas as O.S., anexos e históricos. Cresce sem controle com o volume (há importação do SGP).
- **Impacto:** lentidão nas telas de ocorrência e de provedores, e consumo de memória na API.
- **Correção proposta:** limite padrão (ex.: 50) e máximo; anotações só no detalhe (ou as últimas N); devolver `total` para paginação.
- **Como validar:** `GET /service-orders/occurrences` sem parâmetros devolve no máximo o limite padrão.
- **Lote 5 (04/11):** lista de ocorrências com teto de 200 e só as 5 últimas anotações por ocorrência (o histórico completo está no detalhe).
- **Status:** Corrigido (sem commit; já em execução)

### C-023 · Anexos: o tipo do arquivo depende do que o navegador declara; todos ficam internos; limite de 10 por O.S. para sempre
- **Severidade:** Baixa
- **Área / item do plano:** 1.10 · Anexos
- **Onde:** `service-orders.service.ts:uploadAttachments` (`ALLOWED_MIME` confere `file.mimetype`, que vem do cliente, e aceita `application/octet-stream`; extensão e mime são checados separadamente; `isInternal: true` fixo; `ATTACHMENT_LIMIT = 10` contando todos os anexos já existentes); `storageKey` guarda o **caminho absoluto**
- **O problema:** (a) um arquivo de qualquer conteúdo passa com a extensão `.pdf` e o mime `application/octet-stream`; (b) não existe forma de deixar um anexo visível ao cliente, então o filtro `isInternal: false` do portal nunca mostra nada; (c) 10 anexos por O.S. no total é pouco para atendimento de campo com fotos; (d) mudar `UPLOAD_ROOT` ou o caminho do volume quebra todos os downloads antigos.
- **Impacto:** risco baixo (o download sai como `attachment` com `nosniff`), mas há limitação funcional.
- **Correção proposta:** checar o conteúdo real (assinatura do arquivo) e a coerência extensão × mime; opção "visível ao cliente" no envio; limite por envio e um limite total maior e configurável; gravar o caminho relativo ao `UPLOAD_ROOT`.
- **Como validar:** testes de upload com mime incoerente → 400; download continua funcionando após mudar a raiz.
- **Continuação do lote 6 (04/11):** Validação por assinatura/UTF-8 e extensão; MIME declarado pelo navegador não decide o formato. Visibilidade escolhida no envio, padrão interno. Dez arquivos por envio e teto total configurável (`ORDER_ATTACHMENT_TOTAL_LIMIT`, padrão 100), com trava transacional por O.S. Os novos caminhos são relativos ao `UPLOAD_ROOT`; arquivos e registros são compensados em falhas. Testes de conteúdo forjado, quota, caminho relativo e visibilidade passam. Caminhos absolutos antigos não foram migrados.
- **Status:** Corrigido no código (não implantado)

---

## Fase 1.4 — SLA e prazos

> Contexto verificado (consultas só de leitura em 04/11): o tenant usa `America/Fortaleza`; há 7 linhas
> de calendário e 0 feriados cadastrados; existe 1 política de SLA (override DNS 48h). Hoje não há
> O.S. fechada sem data nem O.S. ativa em ocorrência encerrada.

### C-024 · Políticas de SLA por prioridade são aceitas, mas nunca aplicadas
- **Severidade:** Alta
- **Área / item do plano:** 1.4 · Políticas de SLA
- **Onde:** `apps/api/src/sla/sla-engine.service.ts:findApplicablePolicy` (só usa override por tipo, política por tipo, ou a política `NORMAL` sem tipo; o comentário diz "a prioridade ordena a fila, não altera o prazo"); `apps/api/src/sla-policies/sla-policies.service.ts:create` (aceita política não-override para qualquer prioridade)
- **O problema:** o gerente cadastra "CRÍTICA = 4h" e o sistema grava, lista e mostra como ativa, mas o motor ignora: toda O.S. sem override de tipo recebe o prazo da política NORMAL (ou 48h fixas se nem ela existir).
- **Como acontece:** criar política `priority: CRITICA, hours: 4` → abrir O.S. crítica → prazo de 48h.
- **Impacto:** o gerente acredita que o SLA crítico é de 4h; o monitor, os alertas e os relatórios usam 48h.
- **Correção proposta:** decidir a regra e deixá-la coerente nos dois lados. (a) Se a prioridade não muda o prazo: a API recusa política por prioridade diferente de NORMAL e a tela explica "o prazo vem do tipo de serviço". (b) Se muda: o motor passa a usar a política da prioridade como segundo nível (override de tipo → tipo → prioridade → NORMAL → 48h). Em qualquer caso, `/sla/simulate` deve mostrar qual política foi escolhida e por quê.
- **Também:** existe uma segunda API de políticas em `POST /iam/tenants/:tenantId/sla` (`iam.service.ts:saveSlaPolicy`), além de `/sla-policies`. As duas gravam na mesma tabela com validações diferentes; manter só uma.
- **Como validar:** teste do motor para cada nível; a tela de políticas não permite cadastrar algo que não terá efeito.
- **Lote 4 (04/11):** decisão D-1: a prioridade muda o prazo. Ordem: exceção do tipo → política do tipo → política da prioridade → NORMAL → 48 h (a reconciliação do worker já usava essa ordem). Mudar a prioridade na edição recalcula o prazo, como o tipo. Pendente: a segunda API de políticas em `/iam/tenants/:id/sla`.
- **Status:** Corrigido (sem commit; já em execução)

### C-025 · Mudar o tipo de serviço da O.S. não recalcula o prazo
- **Severidade:** Média
- **Área / item do plano:** 1.4 · Prazos; 1.2 · Edição
- **Onde:** `service-orders.service.ts:updateOrder` (`type` muda, `deadlineAt` não)
- **O problema:** o prazo depende do tipo (override por tipo), mas, ao corrigir o tipo depois da abertura, o prazo antigo continua.
- **Como acontece:** O.S. aberta como "Outro" (48h) e corrigida para "DNS", que tem outra política → o prazo segue o do tipo errado.
- **Correção proposta:** ao mudar o tipo, recalcular o prazo a partir de `createdAt` (descontando pausas) e registrar `SlaAuditEvent` `RECALCULATED`; ou perguntar na tela se o prazo deve ser recalculado.
- **Como validar:** teste de `updateOrder` com troca de tipo → novo `deadlineAt` e evento de auditoria.
- **Lote 2 (04/11):** trocar o tipo recalcula o prazo a partir da abertura (se ativa, sem pausa e com SLA) e grava `SlaAuditEvent RECALCULATED`. Pausas anteriores não são descontadas nesse recálculo.
- **Status:** Corrigido (sem commit; já em execução)

### C-026 · Feriados e exceções só funcionam se o servidor rodar em UTC
- **Severidade:** Média
- **Área / item do plano:** 1.4 · Calendário
- **Onde:** `sla-engine.service.ts:getCalendarExceptionForWallDate` (`startOfDay.setHours(0,0,0,0)` no fuso do processo) × `addCalendarException` (grava `${date}T00:00:00.000Z`); a coluna `BusinessCalendarException.date` é `timestamp`, não `date`
- **O problema:** a busca do feriado gera a meia-noite no fuso local do processo Node. Com `TZ=UTC` (o padrão do contêiner hoje) coincide com o valor gravado; com `TZ=America/Fortaleza` vira 03:00Z e o feriado nunca é encontrado. Não há teste com feriado real: os testes mockam `findUnique` retornando `null` e passam nos dois fusos.
- **Impacto:** se alguém definir `TZ` no contêiner (comum para acertar horário de logs), os prazos passam a contar feriados como dias úteis, sem nenhum erro visível.
- **Correção proposta:** montar a chave do dia a partir dos campos de parede (`yyyy-mm-dd` via `Intl.DateTimeFormat` no fuso do tenant) e buscar por `new Date(`${dia}T00:00:00.000Z`)`; ou migrar a coluna para `@db.Date`. Adicionar teste com feriado rodando com `TZ` diferente de UTC.
- **Como validar:** `TZ=America/Fortaleza npx jest src/sla` com um teste de feriado passando.
- **Lote 4 (04/11):** a chave do feriado é montada em UTC a partir da data de parede do tenant, na API e no worker; teste com feriado real passando em `TZ=UTC`, `America/Fortaleza` e `Asia/Tokyo`.
- **Status:** Corrigido (sem commit; já em execução)

### C-027 · Monitor de SLA calcula 75% e 90% em tempo corrido, não em horas úteis
- **Severidade:** Média
- **Área / item do plano:** 1.4 · Monitor (worker)
- **Onde:** `apps/worker/src/sla/sla-monitoring.service.ts:evaluateOpenOrders` (`percentElapsed = (now - createdAt) / (deadlineAt - createdAt)`)
- **O problema:** o prazo é calculado em horas úteis, mas o percentual usa o relógio corrido e o `createdAt` (ignora pausas). Uma O.S. aberta na sexta às 17h com prazo na terça dispara "75%" no domingo, quando ninguém trabalha; uma O.S. que ficou pausada aparece mais consumida do que está.
- **Impacto:** alertas de aviso fora de hora e fora de proporção; perda de confiança nos alertas.
- **Correção proposta:** calcular o consumido em minutos úteis com o mesmo motor da API (extrair o motor para `packages/shared` ou expor um cálculo comum), descontando pausas.
- **Como validar:** teste com abertura na sexta à tarde: nenhum aviso no fim de semana.
- **Lote 4 (04/11):** `business-clock.ts` no worker: percentual em minutos úteis com o calendário do tenant (carregado uma vez por rodada), fim de semana e feriado parados.
- **Status:** Corrigido (sem commit; já em execução)

### C-028 · Alertas de SLA não voltam a disparar depois que o prazo muda e podem se perder quando falham
- **Severidade:** Média
- **Área / item do plano:** 1.4 · Monitor (worker)
- **Onde:** `sla-monitoring.service.ts:checkAndSetIdempotency` (chave `sla:alert:<orderId>:<limiar>` no Redis por 7 dias **antes** de enviar; no banco, qualquer `SlaAuditEvent` do mesmo limiar, sem olhar o prazo)
- **O problema:** (a) uma O.S. que estourou, foi pausada e retomada com prazo novo, ou reaberta, nunca mais recebe aviso de 75%, 90% ou violação, porque o evento antigo já existe; (b) a chave do Redis é gravada antes do envio: se a gravação do evento ou o envio falhar, o alerta fica bloqueado por 7 dias.
- **Impacto:** violações reais sem aviso.
- **Correção proposta:** a idempotência deve considerar o prazo vigente (`orderId + limiar + deadlineAt`); gravar a chave só depois de registrar o evento, ou apagá-la no `catch`.
- **Como validar:** teste: O.S. com `BREACHED` antigo e `deadlineAt` novo vencido → alerta novo.
- **Lote 4 (04/11):** idempotência por O.S. + limiar + prazo vigente (Redis e `SlaAuditEvent.deadlineAt`); a trava é gravada só depois do registro e do envio. Prazo novo volta a avisar. Na primeira rodada em produção não houve reenvio dos alertas já emitidos.
- **Status:** Corrigido (sem commit; já em execução)

### C-029 · Mensagens de alerta de SLA com cliente e horário errados
- **Severidade:** Média
- **Área / item do plano:** 1.4 · Monitor; 3.9 · Notificações
- **Onde:** `sla-monitoring.service.ts:dispatchNotifications` (`clientName = order.tenant.tradeName`; `deadlineAt.toLocaleString('pt-BR')` sem `timeZone`; e-mail com `toISOString()`)
- **O problema:** o campo "Cliente" mostra o nome do tenant (a própria Ajust), não o provedor da ocorrência. O horário do prazo no WhatsApp sai no fuso do servidor (UTC, 3 horas adiantado em Fortaleza), e no e-mail sai em ISO/UTC.
- **Impacto:** quem recebe o alerta vê o provedor e o horário errados e age na hora errada.
- **Correção proposta:** buscar `occurrence.customer` (ou `requester`) para "Cliente"; formatar com `timeZone` do tenant nos dois canais.
- **Como validar:** teste do texto gerado: provedor certo e horário no fuso do tenant.
- **Lote 4 (04/11):** "Cliente" é o provedor da ocorrência (cadastro, nome ou solicitante), não o tenant; prazo formatado no fuso do tenant no WhatsApp e no e-mail.
- **Status:** Corrigido (sem commit; já em execução)

### C-030 · SLA continua correndo em "Aguardando terceiros" e "Aguardando campo"
- **Severidade:** Baixa (decisão de negócio)
- **Área / item do plano:** 1.4 · Pausa
- **Onde:** `transition` (AG_TERCEIROS/AG_CAMPO não pausam); `sla-monitoring.service.ts` e `deadlineWhere` contam esses status como ativos
- **O problema:** a única pausa é a manual das operações. Pela transição, mover para "Aguardando terceiros" não para o relógio, e o analista precisa lembrar de pausar separadamente. São dois conceitos parecidos sem ligação.
- **Correção proposta:** decidir se esses status pausam o SLA automaticamente (com motivo) ou deixar explícito na tela que não pausam.
- **Lote 4 (04/11):** decisão D-3: entrar em "Aguardando terceiros" pausa o SLA (motivo da transição, `SlaAuditEvent PAUSED`); sair retoma e estende o prazo pelo tempo útil parado (`RESUMED`). "Aguardando campo" continua contando. Pausa manual anterior não é mexida.
- **Status:** Corrigido (sem commit; já em execução)

### C-031 · Código morto e caminhos padrão divergentes no motor de SLA
- **Severidade:** Baixa
- **Área / item do plano:** 1.4 · Motor; 7 · Qualidade
- **Onde:** `sla-engine.service.ts` (`adjustWithConfigSingle` não é usado; `adjustWithConfig` reinicia o dia às 08:00 fixas, enquanto o calendário padrão sem linhas usa 00:00–24:00; `calcTargetDefault`/`calcPauseDefault` usam 08–18 sem fuso)
- **O problema:** três versões da regra de "hora útil" convivem. Hoje toda chamada de produção passa `tenantId` (caminho com calendário), mas qualquer chamada sem tenant cai numa regra diferente, sem fuso.
- **Correção proposta:** remover as variantes sem tenant e o código não usado; uma única função de cálculo.
- **Status:** Corrigido no código (não implantado)

---
- **Continuação do lote 7 (04/11):** Motor de SLA exige tenantId e usa exclusivamente o calendário do tenant. Removidos os caminhos de cálculo padrão divergentes e auxiliares sem uso; testes usam calendários explícitos.

## Fase 1.5 — Encerramento e pós-atendimento

### C-032 · Pesquisa de satisfação vai para o e-mail da própria Ajust e não sai no fluxo principal
- **Severidade:** Alta
- **Área / item do plano:** 1.5 · CSAT
- **Onde:** `apps/api/src/csat/csat.service.ts:createForOrder` (envia para `survey.tenant.techContactEmail`); disparo só em `transition` quando `to === 'RESOLVIDA'`
- **O problema:** (a) o destinatário é o contato técnico do **tenant**, que é a Ajust, e não o provedor atendido; (b) o botão "Concluir" do analista (operações, ver C-013) vai direto para FECHADA sem passar por RESOLVIDA, então a pesquisa nunca é criada no fluxo mais usado; (c) o texto diz "Sua Ordem de Serviço foi concluída" mesmo quando a O.S. só foi resolvida e ainda pode ser reaberta.
- **Impacto:** o indicador de satisfação não mede o cliente; a Ajust recebe pesquisas das próprias O.S.
- **Correção proposta:** enviar ao contato do provedor (`Customer`, ou o contato do usuário cliente vinculado); disparar no fechamento efetivo pelo serviço único de ciclo de vida (C-013); não enviar se o provedor não tiver contato, registrando o motivo.
- **Como validar:** teste: fechar a O.S. de um provedor com e-mail cadastrado → e-mail para esse endereço.
- **Lote 2 (04/11):** pesquisa só no fechamento efetivo e enviada ao primeiro e-mail do provedor (`Customer.contacts.emails`); sem e-mail, não envia. Pendente: fechamentos feitos pela tela de processos (ver C-013).
- **Conclusão (05/11):** pesquisa também nos fechamentos pela tela de processos (via fila do motor).
- **Status:** Corrigido (em execução)

### C-033 · Ao resolver ou fechar, o sistema dispara uma mensagem de "escalonamento" com link interno e IP fixo
- **Severidade:** Média
- **Área / item do plano:** 1.5 · Notificações
- **Onde:** `apps/api/src/notifications/notifications.service.ts:dispatchWhatsAppOrder` (usa o gatilho `ORDER_ESCALATED`, título "🚨 [AJUST NOC] ORDEM DE SERVIÇO", `PUBLIC_APP_URL || 'http://168.194.13.18:8070'`, link para `/gerencia?...exportPdf=`, `deadlineAt.toLocaleString('pt-BR')` sem fuso); chamado por `transition` em RESOLVIDA e FECHADA
- **O problema:** (a) quem configurou o canal "O.S. escalonada" passa a receber também toda resolução e todo fechamento, com o mesmo visual de alerta 🚨; (b) uma O.S. resolvida e depois fechada gera duas mensagens; (c) o link aponta para a área de gerência (exige login da equipe) e, sem variável de ambiente, para um IP fixo de produção; (d) o horário sai em UTC; (e) a mensagem inclui 300 caracteres da descrição interna.
- **Impacto:** ruído no canal de escalonamento, links quebrados fora da produção, possível exposição de descrição interna se o canal for do cliente.
- **Correção proposta:** gatilho próprio (`ORDER_RESOLVED` / `ORDER_CLOSED`) e texto próprio; remover o IP fixo e falhar a configuração se `PUBLIC_APP_URL` não existir; formatar data com o fuso do tenant; não incluir descrição interna.
- **Como validar:** teste: fechar uma O.S. não chama `dispatch` com `ORDER_ESCALATED`.
- **Lote 3 (04/11):** fechamento usa o gatilho próprio `ORDER_CLOSED` (`notifyOrderClosed`): sem descrição interna, horário no fuso do tenant, uma mensagem por O.S. fechada; resolução não manda mais nada. O aviso manual de escalonamento perdeu o IP fixo (sem URL pública, sai sem link) e também usa o fuso do tenant.
- **Status:** Corrigido (sem commit; já em execução)

### C-034 · Modelos de processo de O.S. criam O.S. filhas sem SLA, sem vínculo, em laço e depois de a ocorrência encerrar
- **Severidade:** Alta
- **Área / item do plano:** 1.5 · Pós-fechamento; 1.6 · Automações
- **Onde:** `apps/api/src/os-process-templates/os-process-templates.service.ts:executeForOrder`; chamado sem `await` no fim de `transition` (depois de `syncOccurrenceStatus`)
- **O problema:**
  1. **Laço:** a O.S. filha pode ter o mesmo tipo que dispara o modelo. Fechar a filha dispara o modelo de novo e cria outra filha, sem fim.
  2. **Duplicidade:** reabrir e fechar de novo a O.S. de origem cria outra leva de filhas.
  3. **Ocorrência encerrada com O.S. ativa:** a ocorrência é sincronizada antes (fica ENCERRADA) e as filhas são criadas depois, dentro dela.
  4. **Sem padrão:** prazo em horas corridas (`Date.now() + deadlineHours`), não pelo motor de SLA; protocolo `WF-xxxx` fora da sequência; `parentOrderId`/`rootOrderId` não são preenchidos (os campos existem); sem responsável; sem auditoria nem evento em tempo real.
  5. **Quase nunca roda:** a função sai se a O.S. tem processo (`if (managed.processInstanceId) return`), e toda O.S. nova nasce com processo (C-009). O recurso fica configurável na tela, mas sem efeito para O.S. novas.
- **Impacto:** risco de explosão de O.S. e de ocorrências inconsistentes onde o recurso ainda roda (O.S. antigas sem processo); confusão para o gerente onde não roda.
- **Correção proposta:** decidir se o recurso continua (ver C-035, unificação das automações). Se continuar: impedir laço (não disparar para O.S. com tag `template:`/`parentOrderId`), idempotência por origem + modelo, criar as filhas antes de sincronizar a ocorrência e na mesma transação, usar o motor de SLA, protocolo normal e `parentOrderId`.
- **Como validar:** teste: fechar a filha não cria neta; fechar a origem duas vezes cria uma leva só.
- **Lote 3 (04/11):** sem laço (O.S. com `parentOrderId` ou tag `template:` não dispara modelo), sem segunda leva para a mesma origem, filhas com protocolo da sequência e `parentOrderId`/`rootOrderId`, e a ocorrência é sincronizada depois. Pendente: prazo das filhas ainda em horas corridas e a decisão D-2 (manter ou desativar o recurso).
- **Status:** Corrigido no código (legado desativado; implantação pendente)

---
- **Fechamento de pendências (04/11):** Decisão D-2: processos v2 oficiais. API antiga de modelos retorna 410 nas mutações; fechamento não chama mais executeForOrder. Tela antiga é somente consulta. Inventário somente leitura confirmou zero OsProcessTemplate nesta instância; não houve dados para migrar.

## Fase 1.6 — Workflows, processos e automações

> Inventário: hoje existem **cinco** mecanismos que mudam O.S. automaticamente ou guiam o trabalho:
> (1) workflows (`workflows` + `action-executor`), (2) modelos de processo de O.S. (`os-process-templates`),
> (3) processos v1 (`service-processes.service.ts`, ainda na tela `service-processes.tsx`),
> (4) processos operacionais v2 (`operational-processes.service.ts`, que é o que toda O.S. nova usa) e
> (5) as operações do analista (`order-operations.service.ts`). Fechar uma O.S. acontece por **cinco
> caminhos de código diferentes**: `transition`, `run(finish)`, `operational-processes` (linha ~984),
> `action-executor:execCloseOrder` e `recordCompleted` na abertura. Cada um com regras próprias.

### C-035 · Cinco motores de automação e cinco caminhos de fechamento sem regra comum
- **Severidade:** Alta (arquitetura; é a causa de C-010, C-013, C-014, C-032, C-034, C-037)
- **Área / item do plano:** 1.6 · Automações; 1.2 · Ciclo de vida
- **Onde:** os arquivos listados acima
- **O problema:** a mesma regra de negócio (fechar, reabrir, criar O.S. derivada, notificar) foi reimplementada em cada motor, com efeitos diferentes. Só o caminho `transition` aplica aprovação, CSAT e WhatsApp; só o motor v2 publica `order_closed` por fila com retry (`serviceProcessEvent`); só `run` gera calendário e RFC; ninguém, a não ser `syncOccurrenceStatus`, mantém a ocorrência. O gerente vê três telas de "fluxo/workflow/processo" e não sabe qual vale.
- **Impacto:** cada correção precisa ser feita em vários lugares; o comportamento depende de qual botão foi usado.
- **Correção proposta:** (1) um serviço único de ciclo de vida da O.S. (C-013), usado por todos; (2) manter **processos operacionais v2** como o fluxo oficial de trabalho e **workflows** só como automação de efeitos colaterais (notificar, webhook, criar tarefa), assinando os eventos do serviço único; (3) desativar e depois remover os processos v1 e os modelos de processo de O.S. (migrar o que estiver configurado); (4) uma tela "Automação" só, explicando a diferença.
- **Como validar:** grep: só o serviço de ciclo de vida grava `status: 'FECHADA'` em `serviceOrder`.
- **Conclusão (05/11):** motor v2 é o fluxo oficial; workflows restritos a efeitos (D-2, migration de corte aplicada); motores v1 e modelos de O.S. aposentados; fechamento único por `service-order-rules` + `ServiceOrderLifecycleService` em transição, operações, motor, integrações e registro de trabalho feito.
- **Status:** Corrigido (em execução)
- **Fechamento de pendências (04/11):** Processos v1 deixam de aceitar início, edição e ações pela API. Workflows só aceitam notificações, webhooks e CSAT; ações que criavam/atribuíam/escalavam/fechavam O.S. foram removidas do executor e recusadas na criação, edição, ativação e restauração. Telas antigas viraram consulta. Inventário: 65 processos, todos v2 (35 ativos/30 concluídos), nenhum modelo v1, nenhum modelo de O.S. ou nó de ação de workflow. Migration de corte aborta em outra instalação com configurações legadas que precisem de migração. Ainda resta concentrar integralmente as gravações de transição/operations/v2 em um único serviço transacional (C-013/C-016) e remover implementações antigas internas não expostas.

### C-036 · Gatilho "O.S. crítica" dispara para qualquer O.S.; gatilho "SLA violado" nunca dispara
- **Severidade:** Alta
- **Área / item do plano:** 1.6 · Workflows
- **Onde:** `apps/api/src/workflows/workflows.service.ts:evaluateTrigger` (`os_critica: ['order_created', 'order_updated']`, sem olhar a prioridade; `sla_breach: ['sla_breach']`); ninguém chama `executeForEvent` com `type: 'sla_breach'` (nem a API nem o worker); a tela oferece os dois gatilhos (`workflow-node-form.tsx:100-101`, `lib/erp/workflow.ts`)
- **O problema:** a regra "quando a O.S. for crítica, faça X" executa X em toda criação e toda atualização de qualquer O.S., de qualquer prioridade. A regra "quando o SLA for violado" nunca roda.
- **Como acontece:** criar workflow com gatilho "OS crítica" → ação "Escalar" (que muda a prioridade para CRÍTICA) → a primeira O.S. NORMAL atualizada vira CRÍTICA.
- **Impacto:** automação perigosa (escala tudo) ou inútil (SLA), sem nenhum aviso ao gerente.
- **Correção proposta:** `os_critica` deve exigir `order.priority === 'CRITICA'` (e, em atualização, a mudança para crítica); o worker de SLA (C-027/C-028) deve publicar `sla_breach` para a API, ou a tela deve esconder o gatilho até existir.
- **Como validar:** teste: `evaluateTrigger(os_critica, order NORMAL)` → falso; teste de integração do worker publicando `sla_breach`.
- **Lote 3 (04/11):** "O.S. crítica" exige `priority === CRITICA`; "SLA violado" passa a disparar: o worker publica em `POST /workflows/internal/sla-breach` (protegido por `WORKER_API_TOKEN`, fora do BFF) na primeira violação de cada O.S.
- **Status:** Corrigido (sem commit; já em execução)

### C-037 · Ações de workflow alteram a O.S. sem versão, histórico, auditoria nem regras
- **Severidade:** Alta
- **Área / item do plano:** 1.6 · Workflows
- **Onde:** `apps/api/src/workflows/action-executor.service.ts` → `execAssign` (troca `assigneeUserId` sem `analystName`, sem checar papel, sem `version`), `execEscalate` (muda prioridade sem `version` nem histórico), `execCloseOrder` (fecha sem `version`, sem `AuditLog`, sem sincronizar a ocorrência, sem aprovação), `execTaskService` (O.S. `WF-xxxx`, sem `parentOrderId`, sem responsável)
- **O problema:** o workflow age por fora das regras. Como `version` não aumenta, uma tela aberta salva por cima da mudança do workflow sem conflito; o nome do analista exibido fica o antigo enquanto o id é o novo; o fechamento automático deixa a ocorrência aberta e não respeita a aprovação.
- **Impacto:** dados inconsistentes (responsável exibido ≠ responsável real), perda silenciosa de alterações, fechamento sem regras.
- **Correção proposta:** as ações chamam o serviço de domínio (C-013/C-035) em vez de `prisma.serviceOrder.update` direto; `assign` usa a validação de membro da equipe (C-007).
- **Como validar:** teste: `execAssign` atualiza `analystName` e `version`; `execCloseOrder` em O.S. que exige aprovação → `SKIPPED` com motivo.
- **Lote 3 (04/11):** `execAssign` exige membro ativo da equipe e grava nome, versão e histórico; `execEscalate` grava versão e histórico; `execCloseOrder` aplica a regra de aprovação, controle de versão, auditoria `OS_CLOSE`, sincronização da ocorrência e CSAT; `execTaskService` usa o protocolo da sequência e `parentOrderId`.
- **Status:** Corrigido (sem commit; já em execução)

### C-038 · Retry do evento `order_closed` reexecuta todas as regras, inclusive as que já deram certo
- **Severidade:** Média
- **Área / item do plano:** 1.6 · Processos v2
- **Onde:** `operational-processes.service.ts:~1060-1110` (fila `serviceProcessEvent`: se qualquer `workflowExecutionLog` FAILED aparecer depois do início, o evento todo volta para FAILED e é reprocessado)
- **O problema:** com duas regras para `order_closed` (uma cria tarefa, outra chama um webhook que está fora do ar), cada nova tentativa cria outra tarefa e reenvia as notificações já enviadas. A verificação de falha também pega falhas de outras execuções da mesma O.S. no mesmo período.
- **Impacto:** O.S. derivadas duplicadas e notificações repetidas.
- **Correção proposta:** idempotência por evento + regra + nó (registrar o que já teve sucesso e pular no retry), e ligar a verificação de falha ao id da execução, não à O.S.
- **Como validar:** teste: com uma regra falhando, a nova tentativa não recria a tarefa da outra regra.
- **Lote 3 (04/11):** `executeForEvent` recebe a chave do evento: regra já concluída sem falha (`__done__`) é pulada na nova tentativa; a detecção de falha olha só a execução daquele evento.
- **Status:** Corrigido (sem commit; já em execução)

### C-039 · Fechamento pelo motor de processos não aplica a regra de aprovação
- **Severidade:** Média
- **Área / item do plano:** 1.6 · Processos v2; 1.5 · Aprovação
- **Onde:** `operational-processes.service.ts:~978-1015` (grava `status: 'FECHADA'` direto quando o fluxo termina)
- **O problema:** a aprovação gerencial de fechamento atrasado (C-003) só existe em `transition`. Uma O.S. ALTA/CRÍTICA atrasada que termina pelo fluxo fecha sem aprovação. Na prática o fluxo v2 também é o caminho de quase toda O.S. nova.
- **Correção proposta:** resolvida pelo serviço único (C-013). Até lá: o motor deve parar na última etapa com "aguardando aprovação gerencial" quando a regra se aplicar.
- **Como validar:** teste do motor com O.S. crítica atrasada.
- **Lote 2 (04/11):** o motor v2 aplica a mesma regra: alta/crítica atrasada que exige aprovação fica RESOLVIDA com aviso; a transição manual passa a ser permitida em O.S. com processo sem etapa ativa, para a gestão fechar depois de aprovar.
- **Status:** Corrigido (sem commit; já em execução)

> Observação: o motor v2 está bem protegido contra concorrência (versão do fluxo e da O.S.,
> `SELECT … FOR UPDATE`) e restringe `cancel`, `retry` e `reopen` a gestores. A análise detalhada de
> todas as regras de definição (`operational-definition.ts`) ficou parcial; ver o plano, item 1.6.

---

## Fase 1.7 a 1.9 — Visão gerencial, analista e portal

> Verificado e correto: o **portal do cliente vinculado** (`customer-portal.controller.ts`) filtra por
> `occurrence.customerId = req.auth.customerId`, só O.S. visíveis ao cliente, campos públicos e
> paginação com limite 100. O guard limita a conta vinculada às rotas do portal. O problema de
> isolamento é só o da conta **sem** vínculo (C-019).

### C-040 · Indicadores por analista agrupam pelo nome em texto e carregam o período inteiro na memória
- **Severidade:** Média
- **Área / item do plano:** 1.7 · Relatórios
- **Onde:** `apps/api/src/reports/reports.service.ts:getManagerKPIs` (agrupa por `order.analystName || 'Unassigned'`; `findMany` sem limite, `daysBack` até 3650); `getOperationalHealth` e `getServiceTypes` no mesmo padrão
- **O problema:** (a) se o nome do analista mudar, ou se o workflow trocar o `assigneeUserId` sem atualizar o nome (C-037), a produtividade se divide em duas linhas ou vai para a pessoa errada; (b) "violações de SLA" conta só as O.S. **ainda abertas** e vencidas: uma O.S. que fechou atrasada não entra nesse número (só no percentual); (c) o TMR é em horas corridas, não úteis, sem dizer isso na tela; (d) com 10 anos de período, a API carrega todas as O.S. na memória.
- **Impacto:** ranking de analistas e números de SLA diferentes do que o gerente imagina; lentidão.
- **Correção proposta:** agrupar por `assigneeUserId` (nome só para exibir); separar "violações em aberto" de "fechadas fora do prazo"; nomear o TMR como "corrido" ou calcular em horas úteis; fazer a agregação no banco (`groupBy`/SQL) e limitar o período máximo.
- **Como validar:** teste: duas O.S. do mesmo `assigneeUserId` com `analystName` diferente → uma linha só.
- **Lote 5 (04/11):** indicadores por analista agrupam pelo id do responsável (nome só para exibir); "Fechadas fora do prazo" por analista e no geral, além das "Vencidas em aberto"; o rótulo da resolução média diz "horas corridas". Pendente: agregação no banco e limite de período (a consulta ainda carrega as O.S. do período na memória); TMR em horas úteis.
- **Lote 6, fechamento (05/11):** período dos indicadores limitado a 366 dias (as telas usam no máximo 90); a consulta já trazia só as colunas usadas. TMR continua em horas corridas, identificado como tal na tela.
- **Status:** Corrigido (sem commit; já em execução)

### C-041 · Listagem de O.S. sem limite padrão
- **Severidade:** Média
- **Área / item do plano:** 1.7 · Listagem; 7 · Desempenho
- **Onde:** `service-orders.service.ts:list` (`take` só se `limit` vier), igual à listagem de ocorrências (C-022)
- **O problema:** `GET /service-orders` sem `limit` devolve todas as O.S. do workspace com ocorrência, dono e responsável. Qualquer tela ou integração que esqueça o parâmetro traz tudo.
- **Correção proposta:** limite padrão (50) e máximo (200, como o schema já impõe quando o parâmetro vem); devolver `total`.
- **Como validar:** `GET /service-orders` sem parâmetros devolve no máximo 50.
- **Lote 5 (04/11):** lista de O.S. com teto de 200 (padrão e máximo), em linha com o máximo que o schema já aceitava.
- **Status:** Corrigido (sem commit; já em execução)

### C-042 · "Concluídas" no resumo e nos relatórios inclui O.S. só resolvidas
- **Severidade:** Baixa
- **Área / item do plano:** 1.7 · Resumo
- **Onde:** `service-orders.service.ts:summary` (`closed` = FECHADA + RESOLVIDA); `buildWhere` (`situation: 'completed'`); `reports.service.ts` (`isClosed`); portal (`closed`)
- **O problema:** RESOLVIDA ainda pode voltar para EM_ANALISE e, nas O.S. que exigem aprovação, ainda depende do gerente. Somar com FECHADA mostra mais concluídas do que há e esconde a fila de "aguardando fechamento".
- **Correção proposta:** mostrar "Resolvidas (aguardando fechamento)" separado de "Fechadas", ou documentar na tela que "concluídas" inclui as resolvidas.
- **Lote 5 (04/11):** `overview.resolvedAwaitingClosure` e `summary.resolvedAwaiting` separam as resolvidas aguardando fechamento; os rótulos das telas de gestão passaram a "Resolvidas + fechadas", "Resolvidas aguardando fechamento", "Vencidas em aberto" e "Fechadas fora do prazo". O resumo do portal do cliente continua somando as duas.
- **Status:** Corrigido (sem commit; já em execução)

---

## Fase 1.11 — Entradas automáticas de chamados

### C-043 · Integração de chat (`/webhooks/chat/incoming`) sempre falha
- **Severidade:** Alta
- **Área / item do plano:** 1.11 · Webhook genérico
- **Onde:** `apps/api/src/integrations/webhook.controller.ts:handleIncomingChat` chama `serviceOrders.create(...)` **sem `occurrenceId`**; `service-orders.service.ts:create` recusa esse caso ("Use Novo atendimento para criar a ocorrência junto com a primeira O.S.")
- **O problema:** depois que a criação de O.S. passou a exigir ocorrência, a integração de chat não foi atualizada. Toda mensagem do bot devolve 400 e nenhum chamado é aberto.
- **Impacto:** chamados vindos do chat são perdidos (o remetente recebe erro, que nem sempre é tratado).
- **Correção proposta:** a integração deve chamar `createOccurrenceWithFirstOrder` com o provedor identificado (por `requester` → cadastro de cliente, ou por um `customerId` no payload), ou anexar a uma ocorrência aberta do mesmo provedor. Adicionar teste de ponta a ponta do webhook com o serviço real.
- **Como validar:** teste de integração: `POST /webhooks/chat/incoming` válido → 201 com ocorrência e O.S.
- **Lote 3 (04/11):** o chat abre ocorrência + primeira O.S. (`createOccurrenceWithFirstOrder`) para o provedor de `customerId` ou do nome em `requester`; provedor desconhecido → 422 com explicação. Abertura sem ator humano não inicia fluxo. Teste de integração com o serviço real no banco descartável.
- **Status:** Corrigido (sem commit; já em execução)

### C-044 · Alerta do Zabbix abre um chamado novo a cada disparo, sem deduplicar nem fechar na recuperação
- **Severidade:** Alta
- **Área / item do plano:** 1.11 · Monitoramento
- **Onde:** `apps/api/src/integrations/monitoring/monitoring.controller.ts:handleZabbixWebhook`
- **O problema:**
  1. **Sem deduplicação:** o Zabbix repete o alerta enquanto o problema existe e cada chamada cria uma ocorrência e uma O.S. novas (`ZBX-<timestamp>`/`MNT-<timestamp>`). Não há uso do id do evento nem do host.
  2. **Sem recuperação:** o evento de "resolvido" do Zabbix também vira chamado novo, em vez de resolver o existente.
  3. **Fora do padrão:** a ocorrência não tem `customerId` (provedor "NOC / ZABBIX"), não inicia processo, não dispara workflow nem auditoria; `sourceSystem` é `ERP`, apesar de existir `WEBHOOK`; o evento em tempo real se chama `order_created`, enquanto as telas ouvem `service_order.created`.
  4. **Um token para todos:** um único `MONITORING_WEBHOOK_TOKEN` global, e o tenant é escolhido pelo cabeçalho `x-tenant-slug`. Quem tem o token cria chamados em qualquer tenant. Não há limite de taxa.
- **Impacto:** inundação da fila em qualquer queda real (justamente quando a equipe mais precisa da fila limpa); SLA e relatórios inflados; chamados sem provedor.
- **Correção proposta:** chave de deduplicação (`tenantId + sourceSystem + externalId` = id do evento/trigger do Zabbix, usando o `@@unique` que já existe em `Occurrence`); evento de recuperação resolve a O.S. aberta; mapear host → provedor (cadastro); usar o fluxo normal de criação (C-010); token por tenant (ou chave de API, como o chat) e rate limit.
- **Como validar:** teste: dois POST com o mesmo id de evento → uma O.S.; POST de recuperação → O.S. resolvida.
- **Lote 3 (04/11):** deduplicação por `eventId`/`triggerId` (`externalId zabbix:<id>`, origem `WEBHOOK`); recuperação (`status` OK/RESOLVED) resolve as O.S. da ocorrência; provedor encontrado pelo host cadastrado no cofre; abertura pelo fluxo normal (auditoria, eventos, workflow). Pendente: token por tenant e limite de taxa (o guard de limite existente só funciona com usuário autenticado); problema que volta depois de a ocorrência encerrar abre ocorrência nova sem deduplicação.
- **Conclusão (05/11):** chave de API do próprio tenant autentica sem `x-tenant-slug`; limite de 120 alertas/min por tenant (`MONITORING_WEBHOOK_PER_MINUTE`); problema que volta após encerrar mantém a deduplicação (a ocorrência antiga recebe chave arquivada).
- **Status:** Corrigido (em execução)

### C-045 · Webhook do IXC muda o status por fora da máquina de estados e cria O.S. sem ocorrência
- **Severidade:** Alta
- **Área / item do plano:** 1.11 · IXC
- **Onde:** `apps/api/src/integrations/ixc/ixc.service.ts:applyWebhookToOrder`
- **O problema:**
  1. Atualiza `status` para o que vier do IXC (por exemplo, FECHADA → ABERTA ou ABERTA → FECHADA) sem validar a transição, sem datas (`closedAt`/`resolvedAt`), sem aprovação, sem `version`, sem evento de status, sem auditoria e sem sincronizar a ocorrência.
  2. Cria O.S. nova **sem ocorrência e sem provedor**, que não aparece nas telas de ocorrência nem no portal, e com `sourceSystem: 'SGP'` (a origem é o IXC).
  3. A assinatura HMAC não tem carimbo de tempo e o `payloadHash` é gravado mas não é verificado: o mesmo corpo assinado pode ser reenviado indefinidamente (replay).
- **Impacto:** O.S. que fecham ou reabrem "sozinhas" sem rastro; chamados órfãos; integração vulnerável a reenvio.
- **Correção proposta:** passar pelo serviço de ciclo de vida (C-013) com um ator "Integração IXC"; vincular a O.S. à ocorrência e ao provedor do cliente IXC; origem `WEBHOOK`/`IXC`; recusar `payloadHash` repetido em uma janela e, se o IXC permitir, exigir carimbo de tempo assinado.
- **Como validar:** testes: webhook com status inválido para a transição → registrado como conflito (`SyncStatus.CONFLICT`), O.S. intacta; reenvio do mesmo corpo → ignorado.
- **Lote 3 (04/11):** status do IXC passa pela tabela de transições (fechar/resolver a partir de etapa ativa é aceito; reabrir não), regra de aprovação, datas, versão, evento de status e efeitos do ciclo de vida; O.S. nova vira atendimento completo com o provedor de `payload.customerId`/`payload.provider`; reenvio do mesmo corpo em 24 h é ignorado; origem `WEBHOOK`.
- **Status:** Corrigido (sem commit; já em execução)

---

## Fase 2 — Segurança e partes críticas da plataforma

> Contexto verificado em 04/11 (só leitura): **este servidor é o host público 168.194.13.18**. A
> aplicação roda em modo de desenvolvimento (`pnpm dev` / `tsx watch`, como root dentro dos contêineres),
> com `NODE_ENV=development` no `.env`. Não consegui ver o firewall (exige root). Os valores dos
> segredos **não** foram lidos nem copiados, só o tamanho e o formato.

### C-046 · Banco, Redis, pgAdmin, API e worker publicados em todas as interfaces do servidor público
- **Severidade:** Crítica (se o firewall não bloquear; confirmar)
- **Área / item do plano:** 2.3 · Borda; 6 · Infraestrutura
- **Onde:** `docker-compose.yml` (`ports`: `8071` API, `8072` Postgres, `8073` Redis, `8076` worker, `8077` pgAdmin com `PGADMIN_DEFAULT_EMAIL: admin@example.com` / `PGADMIN_DEFAULT_PASSWORD: admin123`); `ss -ltn` mostra todas em `0.0.0.0`
- **O problema:** o Redis responde `PONG` **sem senha** (teste local de leitura). O Postgres e o pgAdmin ficam expostos com credenciais de formato padrão (ver C-047). A API e o worker podem ser chamados direto, sem passar pelo BFF. Portas publicadas pelo Docker costumam **ignorar as regras do ufw**, porque o Docker escreve as próprias regras de iptables.
- **Como acontece:** de qualquer lugar da internet: `redis-cli -h 168.194.13.18 -p 8073` (lê e apaga chaves de sessão e rate limit, ou usa `CONFIG SET` para gravar arquivos); `psql -h 168.194.13.18 -p 8072` com a senha fraca; pgAdmin em `:8077` com `admin123`.
- **Impacto:** controle total dos dados (cofre de credenciais criptografado, O.S., usuários) e possivelmente do servidor.
- **Correção proposta (urgente, sem esperar o fim da análise):** (1) no `docker-compose.yml`, publicar Postgres, Redis, pgAdmin e worker só em `127.0.0.1:` (ou não publicar), e a API também, se o BFF for a única porta de entrada; (2) remover o pgAdmin do compose ou exigir credenciais fortes e acesso por túnel SSH; (3) `requirepass` no Redis; (4) conferir o firewall do provedor (fora da máquina); (5) rodar o compose de produção (`docker-compose.prod.yml`) em vez do de desenvolvimento.
- **Atenção:** pôr senha no Redis exige corrigir antes C-065 (o worker não lê a senha da URL e pararia de processar as filas).
- **Como validar:** de fora do servidor, `nc -zv 168.194.13.18 8072 8073 8076 8077` recusado; `redis-cli` sem senha → `NOAUTH`.
- **Andamento (04/11):** `docker-compose.yml`: Postgres, Redis, API, worker e Loki só em `127.0.0.1`; web em `${WEB_BIND:-127.0.0.1}` (fica `0.0.0.0` até o HTTPS existir); pgAdmin removido; Redis com `requirepass`. Aplicação por `scripts/lote0-aplicar.sh`. O firewall do provedor e o projeto vizinho `ajust_erp-pre-redesign` (portas 8071 e 8091 públicas) ficam fora deste lote.
- **Aplicado (04/11, 16:26):** `scripts/lote0-aplicar.sh` rodou: Postgres, Redis, API, worker e Loki escutam só em `127.0.0.1`; pgAdmin removido; Redis responde `NOAUTH` sem senha. A porta 8070 (web) continua pública até C-075. Pendente: firewall do provedor e o projeto `ajust_erp-pre-redesign` (8071/8091).
- **Status:** Corrigido em parte (aplicado; web ainda pública até o HTTPS)

### C-047 · Instância pública usando segredos de desenvolvimento e sem os segredos obrigatórios
- **Severidade:** Crítica
- **Área / item do plano:** 2.6 · Segredos e configuração
- **Onde:** `.env` (`NODE_ENV=development`; `JWT_ACCESS_SECRET` com 17 caracteres e `JWT_REFRESH_SECRET` com 18, tamanhos exatos de `dev-access-secret`/`dev-refresh-secret`, ambos na lista de inseguros de `secrets-validation.service.ts`; `POSTGRES_PASSWORD` com 8 caracteres e formato padrão; `JWT_RESET_SECRET`, `WORKER_API_TOKEN`, `MONITORING_WEBHOOK_TOKEN` e `CHAT_WEBHOOK_TOKEN` vazios); `apps/api/src/config/secrets-validation.service.ts` (fora de produção só avisa)
- **O problema:** com o segredo do JWT conhecido, qualquer pessoa assina um token de acesso. O guard ainda exige uma sessão válida (`sid`), mas o `sessionId` aparece nos metadados do `AuditLog` de LOGIN e na listagem de sessões. Assim, quem lê a auditoria (gerente) ou o banco forja um token como qualquer usuário, inclusive super_admin. Sem `JWT_RESET_SECRET`, a recuperação de senha quebra (lança erro). Sem `WORKER_API_TOKEN`, ver Fase 4.
- **Impacto:** personificação de qualquer conta; banco acessível com senha fraca (C-046).
- **Também (visto na Fase 6):** `SECRETS_ENCRYPTION_KEY` tem o tamanho do padrão público `change-this-secret-key-in-production`, e o `docker-compose.yml` lê `.env.example` como `env_file`. Trocar só o `.env` não basta (ver C-078). Depois de trocar `SECRETS_ENCRYPTION_KEY`, é preciso recriptografar os segredos de 2FA, IXC e topologias.
- **Correção proposta (urgente):** gerar segredos fortes (32+ bytes aleatórios) para todas as variáveis, trocar a senha do Postgres, invalidar todas as sessões, rodar com `NODE_ENV=production`; fazer a validação **falhar** sempre que o host não for localhost, não só em produção; tirar `sessionId` dos metadados de auditoria (ou guardar só um hash).
- **Como validar:** a API não sobe com segredo da lista de inseguros; `GET /auth/sessions` e `AuditLog` não expõem o `sid` reutilizável.
- **Andamento (04/11):** segredos novos (32 bytes aleatórios cada) em `/home/app/backups/ajust_erp/novos-segredos.env` e `.env` candidato em `env.novo` (ambos `0600`); o compose agora falha se faltar um segredo (`${VAR:?}`); a aplicação revoga todas as sessões e troca a senha do Postgres. `NODE_ENV` continua `development` até a troca para o compose de produção (C-078), porque o modo dev do Next exige isso e os cookies `Secure` dependem do HTTPS.
- **Aplicado (04/11, 16:26):** segredos novos em uso; senha do Postgres trocada; todas as sessões revogadas (0 ativas depois); 170 topologias recriptografadas e conferidas com a chave nova. Login real confirmado pelo usuário depois da aplicação.
- **Status:** Corrigido (aplicado)

### C-048 · Troca de e-mail da própria conta sem confirmar a senha atual
- **Severidade:** Alta
- **Área / item do plano:** 2.1 · Autenticação
- **Onde:** `apps/api/src/auth/auth.controller.ts:UpdateMeSchema` (exige `currentPassword` só quando há `newPassword`); `auth.service.ts:updateMe`
- **O problema:** com uma sessão roubada (computador destravado, XSS, cookie vazado), basta `PATCH /auth/me { email }` para trocar o e-mail e depois "esqueci a senha" para tomar a conta de forma permanente. Não há confirmação no e-mail novo nem aviso no antigo, e as outras sessões não são revogadas.
- **Correção proposta:** exigir `currentPassword` para trocar e-mail; enviar confirmação ao novo endereço e aviso ao antigo; revogar as outras sessões.
- **Como validar:** teste: `PATCH /auth/me { email }` sem senha → 400.
- **Lote 1 (04/11):** `updateMe` exige a senha atual quando o e-mail muda (reenviar o mesmo e-mail não exige), e revoga as outras sessões; campo "Senha atual" no formulário de perfil. Testes novos.
- **Status:** Corrigido (sem commit; já em execução)

### C-049 · Rate limit de login usa o IP do proxy e permite bloquear a conta de outra pessoa
- **Severidade:** Média
- **Área / item do plano:** 2.1 · Rate limits
- **Onde:** `apps/api/src/auth/rate-limit.guard.ts` (chave `ip + identificador`, 5 tentativas, bloqueio de 15 min; `request.ip` sem `trust proxy`); `apps/web/lib/bff/forward.ts:187` e `app/api/public/[...path]/route.ts` (repassam o `x-forwarded-for` recebido do navegador)
- **O problema:** todo login passa pelo BFF, então para a API todos têm o mesmo IP (o do contêiner web). Na prática a chave é só o identificador: 6 tentativas erradas com o e-mail do gerente bloqueiam o login **dele** por 15 minutos, repetível sem fim. Ao mesmo tempo, o identificador aceita e-mail, nome e prefixo do e-mail, então há vários "baldes" para o mesmo usuário. Ligar `trust proxy` sem cuidado faria valer o `x-forwarded-for` que o próprio navegador envia (falsificável).
- **Correção proposta:** o BFF define o `x-forwarded-for` a partir do IP real da conexão (não repassa o do cliente); a API confia só no BFF (`trust proxy` com o IP dele); limite por IP real **e** por conta resolvida (`userId`), com atraso progressivo em vez de bloqueio total da conta.
- **Como validar:** teste: 6 falhas de um IP não impedem o dono de entrar de outro IP.
- **Lote 1 (04/11):** API com `trust proxy` só para redes internas (`request.ip` agora é o IP do usuário, conferido na auditoria); teto de 20 tentativas por conta de qualquer IP, sem bloqueio total da conta. **Enquanto a porta 8070 ficar exposta direto, o IP pode ser forjado pelo cabeçalho `X-Forwarded-For`**; isso some com o acesso pelo Caddy (C-075), que descarta o cabeçalho vindo de fora.
- **Status:** Corrigido em parte (proxy/implantação pendentes)
- **Continuação do lote 7 (04/11):** Incremento e expiração do limitador agora são atômicos no Redis, inclusive para chaves novas/sem TTL. Fallback local respeita janela fixa e só é permitido fora de produção; produção falha fechada sem Redis. Demais limites do achado e implantação permanecem separados.
- **Fechamento de pendências (04/11):** Removido bloqueio global por conta: acima do limiar há atraso progressivo limitado a 1,5 s, mantendo bloqueio por IP+conta. Teste confirma que tentativas distribuídas não impedem outro IP de autenticar. Redis continua atômico e falha fechado. Pendente: configuração confiável do proxy/IP na implantação.

### C-050 · Login por nome ou prefixo do e-mail é ambíguo; login por CNPJ procura no tenant
- **Severidade:** Média
- **Área / item do plano:** 2.1 · Login
- **Onde:** `auth.service.ts:login` (`findFirst` por `name equals` ou `email startsWith '<x>@'`; fallback por `Tenant.taxId` escolhendo o primeiro usuário cliente)
- **O problema:** (a) dois usuários com o mesmo nome, ou com e-mails `joao@ajust` e `joao@provedor`, fazem o login cair em quem o banco devolver primeiro; o outro nunca entra por nome; (b) o fallback por CNPJ procura o CNPJ do **tenant** (a Ajust), não do provedor (`Customer.taxId`), e escolhe "o primeiro usuário cliente" do tenant. No modelo atual (vários provedores num workspace), digitar o CNPJ da Ajust tenta logar num cliente qualquer.
- **Correção proposta:** aceitar só e-mail (ou um `username` único); para clientes, resolver CNPJ → `Customer` → usuário vinculado; se houver mais de um, pedir o e-mail.
- **Status:** Corrigido no código (implantação pendente)
- **Fechamento de pendências (04/11):** Login não resolve nome nem prefixo. Documento resolve Customer → UserTenant ativo → usuário; nunca o CNPJ do Tenant. Mais de um candidato é recusado. Primeiro acesso usa CNPJ+e-mail no pedido/validação de OTP e no login imediato, incluindo encaminhamento no BFF. E-mail completo mantém login normal. Testes cobrem ambiguidade e inconsistência de tenant.

### C-051 · 2FA não é obrigatório para super_admin e o código TOTP pode ser reutilizado
- **Severidade:** Média
- **Área / item do plano:** 2.1 · 2FA
- **Onde:** `auth.service.ts:login` (super_admin sem 2FA só gera log "pending_setup"); `verify2FA` (não guarda o último passo TOTP usado)
- **O problema:** a conta mais poderosa entra só com senha. Um código de 6 dígitos observado pode ser reusado dentro da janela de validade.
- **Correção proposta:** exigir 2FA para super_admin e gerente (bloquear o login até configurar, com fluxo guiado); guardar o último contador TOTP aceito por usuário e recusar repetição.
- **Lote 1 (04/11):** `REQUIRE_2FA_ROLES` (padrão `super_admin`): perfil obrigado e sem 2FA só acessa a configuração do 2FA, `GET /auth/me` e logout. O único super admin já usa 2FA. **Os 2 gerentes ainda não usam**: depois que configurarem, colocar `REQUIRE_2FA_ROLES=super_admin,gerente` no `.env`. Reuso do código TOTP continua pendente.
- **Status:** Corrigido no código (migration e implantação pendentes)
- **Fechamento de pendências (04/11):** User.twoFactorLastCounter armazena o passo TOTP aceito. Consumo do passo, remoção condicional da sessão temporária e criação da sessão completa ocorrem em uma transação. Confirmação de configuração também consome o passo e usa atualização condicional. Padrão exige super_admin/gerente; compose de produção explicita ambos. Login de perfil ainda sem 2FA sinaliza configuração obrigatória e BFF redireciona a Segurança/2FA. Teste PostgreSQL prova uma única vitória em verificações concorrentes e rejeição de reuso em outra sessão pendente.

### C-052 · Reuso do refresh token não é detectado
- **Severidade:** Baixa
- **Área / item do plano:** 2.1 · Sessão
- **Onde:** `auth.service.ts:refresh` (hash diferente → 401, mas a sessão continua válida; a atualização do hash não é condicional)
- **O problema:** se um refresh antigo (roubado) for apresentado depois da rotação, isso indica vazamento, mas a sessão segue viva para quem tem o token novo. Duas renovações simultâneas com o mesmo token também passam.
- **Correção proposta:** reuso de refresh antigo revoga a sessão; atualização com `updateMany where refreshTokenHash = antigo`.
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** Refresh token assinado, mas já substituído, revoga a sessão. Rotação usa comparação atômica do hash anterior; concorrência perdedora revoga a sessão e não emite novo access token.

### C-053 · WebSocket: conexões continuam recebendo eventos depois de revogar a sessão ou remover o usuário
- **Severidade:** Média
- **Área / item do plano:** 2.3 · WebSocket
- **Onde:** `apps/api/src/events.gateway.ts` (a sessão só é validada no `handleConnection`; `disconnectTenant` só existe para tenant desativado; todos os membros entram na sala `tenant:<id>`, inclusive `cliente`)
- **O problema:** depois de logout, revogação de sessão, troca de papel ou remoção do tenant, o socket aberto continua recebendo os eventos do workspace (protocolos, provedores, aprovações) até a pessoa fechar a página. Um `cliente` sem vínculo (C-019) também recebe eventos de todos os provedores.
- **Correção proposta:** desconectar os sockets da sessão ao revogá-la (sala por `sid`/`userId`); salas por papel (equipe × cliente por `customerId`) e emitir para clientes só eventos do próprio provedor; revalidar a sessão periodicamente.
- **Como validar:** teste: revogar a sessão → o socket recebe `disconnect`.
- **Lote 1 (04/11):** contas cliente não abrem mais socket (Lote 1). Desconectar o socket ao revogar a sessão continua pendente.
- **Status:** Corrigido no código (não implantado nesta continuação)
- **Continuação do lote 7 (04/11):** Sessão, usuário, associação e papel são revalidados antes de cada envio de evento, na assinatura da sala e a cada 30 segundos. Revogação, remoção, troca de papel e falha de banco bloqueiam a entrega; clientes continuam fora da sala geral do tenant.

### C-054 · Cofre: qualquer analista revela qualquer senha, sem motivo, sem reautenticação e sem limite
- **Severidade:** Média
- **Área / item do plano:** 2.4 · Cofre
- **Onde:** `apps/api/src/knowledge/knowledge.service.ts:revealCredential` (só confere o papel); `common/vault.crypto.ts` (chave em `uploads/.keys/vault.key`, criada **automaticamente** se não existir)
- **O problema:** (a) a revelação é auditada (bom), mas não exige motivo nem O.S. vinculada, não pede a senha de novo nem 2FA, e não tem limite: um analista pode revelar todas as credenciais de todos os provedores em minutos; (b) se o volume de uploads for perdido ou trocado, `encryptVaultSecret` cria uma chave **nova** sem avisar: as credenciais antigas ficam ilegíveis e as novas passam a usar outra chave; (c) a chave fica no mesmo volume dos anexos, e quem copia o volume leva os dois.
- **Correção proposta:** revelar exige motivo (ou O.S.) e, para gerente/super_admin, reautenticação recente; limite por hora com alerta à gestão; nunca criar chave automaticamente fora da primeira instalação (falhar com erro claro); guardar a chave fora do volume de uploads (segredo do orquestrador) e documentar o backup dela.
- **Como validar:** teste: `reveal` sem motivo → 400; sem a chave → a API não sobe.
- **Lote 6 (04/11):** limite de revelações por pessoa e hora (`VAULT_REVEALS_PER_HOUR`, padrão 30; gerente o dobro), motivo opcional gravado no histórico, e em produção a chave do cofre não é mais criada sozinha (`VAULT_KEY_AUTOCREATE=true` só na instalação). Pendente: motivo obrigatório na tela, reautenticação, chave fora do volume de uploads.
- **Continuação do lote 6 (04/11):** Motivo obrigatório e senha atual para senha, dados adicionais e TOTP, com diálogo na interface. TOTP deixa de renovar sem nova confirmação. Limite por pessoa/hora inclui TOTP e usa trava transacional no PostgreSQL para contar e auditar atomicamente entre instâncias. O teste com duas consultas concorrentes comprova uma única liberação quando resta uma vaga. Em produção, a API valida a chave no início, fora de uploads, e nunca a recria, mesmo com o antigo `VAULT_KEY_AUTOCREATE`. Compose preparado para montagem somente leitura da chave existente. Falta executar a mudança física da chave no servidor; nenhuma chave real foi movida ou substituída.
- **Status:** Corrigido no código (implantação pendente)

### C-055 · Proteção contra SSRF pode ser contornada por redirecionamento e por IPv6
- **Severidade:** Média
- **Área / item do plano:** 2.6 · SSRF
- **Onde:** `apps/api/src/common/ssrf-guard.ts` e `apps/worker/src/common/ssrf-guard.ts` (resolvem o DNS e checam faixas IPv4; o `fetch` posterior segue redirecionamentos, pois nenhum dos 12 usos passa `redirect: 'manual'`, e resolve o DNS de novo)
- **O problema:** um webhook configurado para `https://externo.exemplo/r`, que responde `302 → http://172.18.0.x:6379` ou `http://127.0.0.1:3002`, faz a API ou o worker chamarem serviços internos. Faixas IPv6 privadas (`fc00::/7`, `fe80::/10`) não estão na lista, e há janela de DNS rebinding entre a checagem e o `fetch`.
- **Impacto:** acesso a serviços internos (worker, Redis via HTTP, painéis) a partir de quem configura webhooks (gerente).
- **Correção proposta:** `redirect: 'manual'` (ou seguir manualmente revalidando cada destino); conectar no IP já validado (agente HTTP com `lookup` fixo); incluir faixas IPv6 privadas.
- **Continuação do lote 6 (04/11):** `safeFetch` na API e worker conecta ao IPv4 público já validado, mantendo hostname para Host/TLS e sem nova consulta DNS na conexão. Recusa redirecionamentos, credenciais na URL, respostas maiores que 10 MB e faixas internas/reservadas. IPv6 permanece bloqueado por inteiro (inclusive endereços públicos), política conservadora já existente; não é anunciado suporte IPv6. Testes cobrem IPv6 mapeado, DNS misto/vazio, fixação de IP e HTTP 302. Notificações, workflows e reconciliação IXC usam o transporte protegido.
- **Status:** Corrigido no código (não implantado)

### C-056 · Auditoria: IP falsificável, falhas não registradas e ações genéricas
- **Severidade:** Baixa
- **Área / item do plano:** 2.5 · Auditoria
- **Onde:** `apps/api/src/audit/audit.interceptor.ts` (`clientIp = ip || headers['x-forwarded-for']`; só registra respostas de sucesso); vários serviços usam `OS_UPDATE` para ações que não são de O.S. (remoção de usuário, catálogo, cofre)
- **O problema:** o IP registrado é o do BFF ou o que o navegador mandar; tentativas negadas (403/409) não ficam na trilha; filtrar a auditoria por tipo de ação não funciona porque quase tudo é `OS_UPDATE`. A redação de campos sensíveis no corpo está correta.
- **Correção proposta:** IP real vindo do BFF (C-049); registrar também negações de acesso em rotas sensíveis; ações específicas (`USER_REMOVE`, `CATALOG_UPDATE`, `CREDENTIAL_UPDATE`…).
- **Continuação do lote 6 (04/11):** Auditoria usa `req.ip` calculado pelo proxy confiável, sem fallback para cabeçalho livre. Middleware registra 401/403/409/429 inclusive quando originados nos guards; não armazena corpo nem query string nas negações. Novas ações `ACCESS_DENIED`, `RESOURCE_CREATE`, `RESOURCE_UPDATE`, `RESOURCE_DELETE`; remoção de usuário usa `DELETE_USER`, mutações do cofre deixam de se confundir com revelação. Migration `20261104180000_audit_resource_actions` validada em banco descartável. Eventos históricos não foram reescritos.
- **Status:** Corrigido no código (não implantado)

### C-057 · `/monitoring/metrics` sem autenticação fora de produção
- **Severidade:** Baixa
- **Área / item do plano:** 2.6 · Proteções gerais
- **Onde:** `apps/api/src/monitoring/metrics.controller.ts` (`if (process.env.NODE_ENV === 'production')` protege; staging e esta instância, com `NODE_ENV=development`, ficam abertos)
- **O problema:** as métricas incluem contagens por tenant (violações de SLA, isolamento) e ficam abertas no staging e aqui, onde a API está publicada (C-046).
- **Correção proposta:** exigir token sempre, exceto em `localhost`.
- **Continuação do lote 6 (04/11):** Métricas exigem Bearer, sessão ativa e perfil administrativo em todos os ambientes, inclusive localhost. Testes em production/development/test/staging recusam acesso anônimo. O smoke aceita `API_METRICS_TOKEN`; health/ready seguem disponíveis sem token.
- **Status:** Corrigido no código (não implantado)

### C-058 · Backup do banco com leitura para qualquer usuário do servidor
- **Severidade:** Baixa
- **Área / item do plano:** 2.6 · Segredos; 6 · Backups
- **Onde:** `backups/ajust_erp_20261016_190444.dump` (`-rw-rw-r--`)
- **O problema:** o dump completo (hashes de senha, credenciais criptografadas, dados de clientes) pode ser lido por qualquer conta do servidor. A chave do cofre está corretamente em `0600`.
- **Correção proposta:** `chmod 600` nos dumps e `umask 077` no `scripts/db-backup.sh`; guardar os backups fora da árvore do projeto, criptografados.
- **Conclusão (05/11):** pasta `backups/` do projeto em `700` e dumps em `600`; o backup novo (`scripts/backup-completo.sh`) grava em `/home/app/backups/ajust_erp/auto` com pastas `700` e arquivos `600`.
- **Status:** Corrigido

> Verificado e correto na Fase 2: guard de autenticação (exige `typ: 'access'`, sessão válida, papel
> lido do banco a cada requisição); token temporário de 2FA não serve como acesso; recuperação de senha
> vinculada à senha atual (o link morre ao trocar a senha) e revoga sessões; OTP de primeiro acesso
> (6 dígitos com `randomInt`, hash, limite de tentativas, um ativo por vez); cookies HttpOnly e
> `SameSite=Lax`; BFF com allowlist de rotas e bloqueio de mutação de outra origem; chaves de API com
> hash SHA-256, expiração e gestão só por gerente; criptografia AES-256-GCM com IV aleatório;
> redação de senhas e tokens no corpo auditado; `TenantIsolationGuard` recusa `tenantId` em query e body.

---
- **Fechamento de pendências (04/11):** Dump citado na auditoria ajustado para 0600. Script usa umask 077, diretório 0700, temporário 0600 e publicação por rename só após pg_dump bem-sucedido; remove parcial em falha. Dois testes isolados com docker simulado verificam permissões e falha. Criptografia e cópia externa permanecem operacionais, sem destino definido pelo usuário.

## Fase 3 — Demais módulos

> Verificado e correto: em knowledge, agenda, plantão, relatórios de turno, topologias, CMDB, mudanças,
> horas, notificações e CSAT, **toda gravação por id é precedida de uma busca com `tenantId`**
> (varredura automática + leitura dos casos). Anexos dos relatórios de turno conferem extensão × tipo e
> gravam caminho relativo (modelo a seguir para C-023). Topologias têm controle de versão otimista,
> histórico e XML criptografado. O logo do tenant é validado pela assinatura do arquivo. O vínculo
> ativo ↔ O.S. no CMDB confere o tenant dos dois lados.

### C-059 · Plantão e escala são dois cadastros separados e nenhum conversa com o atendimento
- **Severidade:** Média
- **Área / item do plano:** 3.3 · Plantão e escala; 1.8 · Analista
- **Onde:** `apps/api/src/on-call/on-call.service.ts` (`OnCallSchedule`); `team-roster.service.ts` (`TeamRosterPolicy`/`TeamRosterDay`); nenhum outro módulo da API ou do worker consulta plantão ou escala
- **O problema:** (a) "quem está de plantão" (`/on-call/current`) e a escala da equipe são modelos diferentes, que podem dizer coisas diferentes; (b) alertas de SLA, Zabbix e workflows não usam o plantonista para notificar nem atribuir; (c) o cadastro de plantão não impede sobreposição nem buracos de cobertura, aceita qualquer membro do tenant (inclusive `cliente`) e `currentOnCall` devolve só um, quando dois se sobrepõem.
- **Impacto:** de madrugada um alerta crítico não chega a ninguém automaticamente; a gestão mantém dois cadastros.
- **Correção proposta:** decidir uma fonte única (sugestão: a escala gera os plantões); validar sobreposição e papel de equipe; expor "plantonista atual" para notificações e para a ação de workflow "atribuir ao plantão".
- **Lote 4 (04/11):** decisão D-4: o cadastro de Plantão é a fonte. Plantão só aceita membro ativo da equipe e recusa sobreposição; alertas de 90% e de violação em O.S. alta/crítica levam o plantonista atual no payload e na mensagem e vão por e-mail para ele (com SMTP configurado). Pendente: a escala (team-roster) continua separada, e workflows ainda não têm a ação "atribuir ao plantão".
- **Conclusão (05/11):** o cadastro de Plantão é a fonte única de "quem está de plantão"; a escala continua como planejamento da equipe. A ação de workflow "atribuir" deixou de existir com a decisão D-2 (workflows só com efeitos).
- **Status:** Resolvido por decisão (D-4)

### C-060 · Qualquer membro lista todos os usuários com e-mail; analista cria eventos na agenda de colegas
- **Severidade:** Baixa
- **Área / item do plano:** 3.2 · Agenda
- **Onde:** `apps/api/src/calendar/calendar.controller.ts` (`GET /calendar/users` sem checagem de papel); `calendar.service.ts:listTenantUsers` (devolve `email`, papel e status); `create` aceita `assigneeId` de outra pessoa para qualquer papel
- **O problema:** o cliente sem vínculo (C-019) ou qualquer analista obtém a lista completa da equipe com e-mails. Um analista pode lotar a agenda de outro, o que afeta a checagem de conflito dele.
- **Correção proposta:** restringir `/calendar/users` à equipe e sem e-mail para analistas; só gerente atribui evento a outra pessoa (ou exigir aceite).
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** Clientes não listam membros pela agenda. Analistas recebem nomes/IDs sem e-mails e não criam/remanejam eventos para colegas nem criam eventos globais. Gerentes preservam a gestão da agenda.

### C-061 · Notas pessoais podem ser editadas e apagadas pelo gerente sem que ele as veja
- **Severidade:** Baixa
- **Área / item do plano:** 3.10 · Notas
- **Onde:** `apps/api/src/knowledge/knowledge.service.ts` → `listNotes` (só as do próprio autor), `updateNote`/`deleteNote` (`canEditAnyNote` para super_admin e gerente)
- **O problema:** a listagem trata a nota como privada, mas a edição e a exclusão permitem que o gerente altere ou apague a nota de qualquer pessoa, inclusive de clientes, pelo id. É uma regra incoerente e invisível ao dono.
- **Correção proposta:** notas pessoais só pelo autor; se a gestão precisar, criar notas compartilhadas explícitas.
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** Somente o autor pode editar ou excluir nota pessoal, inclusive quando o solicitante é gerente ou super_admin.

### C-062 · Apontamento de horas aceita data futura, O.S. encerrada e lista sem paginação
- **Severidade:** Baixa
- **Área / item do plano:** 3.8 · Horas
- **Onde:** `apps/api/src/time-tracking/time-tracking.service.ts` → `create` (`loggedAt` livre; não olha o status da O.S.), `listByTenant` (sem limite; todos os analistas veem as horas de todos)
- **Correção proposta:** recusar `loggedAt` no futuro e muito no passado (sem gerente); apontar em O.S. fechada/cancelada só com gerente; paginação; analista vê as próprias horas e o total da O.S.
- **Status:** Corrigido no código (implantação pendente)
- **Continuação do lote 7 (04/11):** Datas futuras são recusadas; analista não registra há mais de 30 dias nem em O.S. fechada/cancelada. Gerente pode registrar histórico. Listas aceitam limit/offset (padrão 50, máximo 200), e analista só consulta seus apontamentos/resumo. Pendente: total agregado da O.S. sem expor apontamentos dos colegas e navegação de páginas na interface; resposta permanece array compatível.
- **Fechamento de pendências (04/11):** Complementada paginação visual, ordenação estável por loggedAt/id, resumo agregado no banco e endpoint de total da O.S. isolado por tenant. Tela da O.S. mostra somente o total da equipe; detalhes continuam limitados ao próprio analista. Testes conferem agregação, escopo e recusa de O.S. de outro tenant/excluída.

### C-063 · Transição de RFC sem controle de versão, sem auditoria própria e com autoaprovação
- **Severidade:** Baixa
- **Área / item do plano:** 3.7 · Mudanças
- **Onde:** `apps/api/src/change-management/change.service.ts:transition` (atualiza por `id` sem `version`; registra `approvedById` igual ao solicitante, se ele for gerente)
- **O problema:** dois gerentes aprovando e rejeitando ao mesmo tempo: vale o último. O gerente que pediu a mudança aprova a própria RFC. O histórico das transições fica só no interceptor genérico.
- **Correção proposta:** versão otimista; aprovador diferente do solicitante (ou registro explícito de autoaprovação); evento de histórico por transição.
- **Status:** Corrigido no código (migration e implantação pendentes)
- **Continuação do lote 7 (04/11):** RFC exige expectedVersion no backend e na tela; transição usa compare-and-swap, incrementa version e grava auditoria na mesma transação. Solicitante não aprova a própria RFC. Concorrência obsoleta retorna conflito.

### C-064 · Topologias guardam todas as revisões completas, criptografadas com a chave fraca do ambiente
- **Severidade:** Baixa
- **Área / item do plano:** 3.5 · Topologias
- **Onde:** `apps/api/src/network-topologies/network-topologies.controller.ts:save` (cada salvamento grava o XML inteiro em `NetworkTopologyRevision`, sem limite) e usa `encryptSecret` (`SECRETS_ENCRYPTION_KEY`), não a chave dedicada do cofre
- **O problema:** o banco cresce sem limite com diagramas grandes; a proteção do XML depende de `SECRETS_ENCRYPTION_KEY`, que tem formato de valor padrão nesta instância (C-047).
- **Correção proposta:** política de retenção (ex.: últimas 50 revisões + uma por mês); trocar `SECRETS_ENCRYPTION_KEY` e recriptografar (junto com 2FA e IXC, que usam a mesma chave).
- **Conclusão (05/11):** retenção de revisões ligada ao salvamento de topologias e em execução.
- **Status:** Corrigido (em execução)

---
- **Continuação do lote 7 (04/11):** Cada salvamento conserva as 50 versões mais novas e uma por mês dos últimos 24 meses; limpeza ocorre na transação do salvamento, ordenando por versão. Não foi executada limpeza retroativa nem rotação/recriptografia de chaves reais.

## Fase 4 — Worker e tarefas agendadas

> Verificado e correto: agendamento pelo `upsertJobScheduler` do BullMQ (não duplica com mais de uma
> instância); `concurrency: 1` e tentativas com backoff em todas as filas; rotas operacionais do worker
> protegidas por `WORKER_API_TOKEN` com comparação em tempo constante e **fechadas** quando o token está
> vazio (caso desta instância); retenção de exportações valida o caminho antes de apagar; arquivamento de
> auditoria em lotes com `ON CONFLICT DO NOTHING`.

### C-065 · O worker ignora senha, banco e TLS do `REDIS_URL` (e isso bloqueia a correção de C-046)
- **Severidade:** Alta
- **Área / item do plano:** 4 · Worker; ligação direta com C-046
- **Onde:** o mesmo trecho copiado em 6 arquivos: `apps/worker/src/queues/queue-scheduler.service.ts` e `queues/processors/{sla-monitoring,ixc-reconciliation,monthly-report,export-retention,audit-archiving}.processor.ts` (`host`/`port` extraídos por `replace('redis://','').split(':')`)
- **O problema:** com `REDIS_URL=redis://:senha@redis:6379/0`, o "host" vira `:senha@redis` e a porta vira `senha@redis`. O worker para de agendar e processar **todas** as filas (SLA, IXC, retenção, auditoria, relatório). `rediss://` (TLS) e o número do banco também são ignorados. A API (`common/redis.service.ts`) e o `SlaMonitoringService` usam a URL inteira e funcionariam, então o problema só aparece no agendador.
- **Impacto:** ao corrigir C-046 (senha no Redis), o monitor de SLA e as demais tarefas param em silêncio.
- **Correção proposta:** uma função única `redisConnectionFromUrl()` com `new URL(...)` (usuário, senha, banco, TLS), ou passar uma instância `IORedis` criada a partir da URL, usada pelos 6 lugares. **Fazer junto com C-046.**
- **Como validar:** teste da função com `redis://:s3nha@redis:6379/2` e `rediss://…`; worker sobe e processa com Redis protegido por senha.
- **Andamento (04/11):** `apps/worker/src/common/redis-connection.ts` (`redisConnectionFromUrl`, com senha, usuário, banco e TLS) substitui as 6 cópias; 5 testes novos; worker com typecheck, lint e 36 testes ok.
- **Aplicado (04/11, 16:26):** worker processando o SLA a cada minuto com o Redis protegido por senha.
- **Status:** Corrigido (sem commit; em produção)

### C-066 · Reconciliação periódica do IXC repete os problemas do webhook e chama a URL configurada sem proteção
- **Severidade:** Média
- **Área / item do plano:** 4 · Processadores; 1.11 · IXC
- **Onde:** `apps/worker/src/integrations/ixc-reconciliation.service.ts` → `applyDelta` (status livre, sem datas, sem versão, sem ocorrência, `sourceSystem: 'SGP'`), `fetchDelta` (`fetch(baseUrl + '/api/v1/tickets/delta')` com o token do IXC no cabeçalho, sem `assertSafeUrl`)
- **O problema:** além do que está em C-045, (a) a decisão de sobrescrever compara o `updatedAt` do IXC com o `updatedAt` local, relógios de sistemas diferentes, e qualquer edição local (até uma anotação) muda o `updatedAt`; (b) o `baseUrl` configurado pelo gerente é chamado sem checagem de endereço interno e leva o token do IXC no cabeçalho.
- **Correção proposta:** tratar junto com C-045 (mesmo serviço de domínio); guardar `externalUpdatedAt` próprio para a idempotência; `assertSafeUrl` + `redirect: 'manual'` (C-055).
- **Lote 3 (04/11):** a reconciliação não reabre O.S. concluída, grava datas, versão e evento de status, usa origem `POLLING` e chama o IXC só em endereço público e sem seguir redirecionamento. Pendente: O.S. nova da reconciliação ainda nasce sem ocorrência (o worker não tem o serviço de O.S.); hoje a reconciliação está em modo simulado (`IXC_MOCK_RECONCILE`).
- **Conclusão (05/11):** a reconciliação entrega os deltas à API (`/integrations/ixc/internal/delta`), que aplica as regras do ERP e cria atendimento completo; em execução.
- **Status:** Corrigido (em execução)
- **Continuação sem nova autorização (04/11):** Worker deixa de escrever O.S. diretamente e envia cada delta a endpoint interno autenticado com WORKER_API_TOKEN. API reutiliza o mesmo atendimento do IXC, com ocorrência e processo para novas ordens, SLA, regras de aprovação e efeitos. Data externa ixcUpdatedAt é guardada separadamente das edições locais; deltas antigos/repetidos com data são ignorados. Atendimento concluído não é reaberto pelo polling. Removida do worker a cópia do cálculo de SLA e do gerador de protocolos. Persistem as limitações de atomicidade do ingresso IXC descritas em C-013/C-035 e validação real do contrato do provedor.

### C-067 · Três geradores de protocolo diferentes; o worker cria objetos no banco fora das migrations
- **Severidade:** Média
- **Área / item do plano:** 4 · Processadores; 1.1 · Protocolo; 5 · Banco
- **Onde:** `apps/api/src/service-orders/service-orders.service.ts:buildProtocol` (maior do ano, a partir de 100001, corrigido em C-003); `apps/api/src/integrations/ixc/ixc.service.ts:buildProtocol` (ainda a **contagem antiga**); `apps/worker/src/integrations/ixc-reconciliation.service.ts:buildProtocol` (`CREATE SEQUENCE IF NOT EXISTS "os_seq_<tenant>"` em tempo de execução, começando em 1, sem reinício anual); mais os prefixos `WF-`, `MNT-`, `DEMO-`, `FLUXO-`, `PROC-`, `SGP-`
- **O problema:** a numeração depende de qual caminho criou a O.S. O gerador do IXC na API pode colidir com o da API principal (e recai no retry). A sequência do worker gera `2026000001…`; quando passar de 100000, entra na faixa da API. Uma sequência criada pela aplicação não aparece nas migrations nem nos backups de schema.
- **Correção proposta:** um único gerador compartilhado (`packages/shared` ou serviço da API chamado pelo worker), baseado numa tabela/sequência criada por migration, com reinício anual; usar prefixo só para origem, se necessário, em campo separado.
- **Lote 3 (04/11):** gerador único `order-protocol.ts` (`nextOrderProtocol`/`withFreshProtocol`) usado pela API, pelo IXC, pelos workflows e pelos modelos de O.S.; o worker usa a mesma consulta e não cria mais `SEQUENCE`. Os prefixos `MNT-`/`WF-` deixam de ser gerados. Pendente: `DEMO-`/`FLUXO-`/`PROC-` dos fluxos de demonstração e importação.
- **Conclusão (05/11):** O.S. de etapas do motor usam a sequência normal (`nextOrderProtocolInTransaction`, com trava por tenant). Restam só prefixos legítimos: `SGP-` (importação, guarda o número de origem), `DEMO-` (demonstração) e `PROC-` (motor v1 aposentado).
- **Status:** Corrigido (em execução)

### C-068 · A trilha de auditoria some da tela depois de 90 dias
- **Severidade:** Baixa
- **Área / item do plano:** 4 · Arquivamento; 2.5 · Auditoria
- **Onde:** `apps/worker/src/queues/processors/audit-archiving.processor.ts` (move para `ArchivedAuditLog` o que tem mais de `AUDIT_ARCHIVE_AFTER_DAYS`, padrão 90); nenhum endpoint da API lê `ArchivedAuditLog`
- **O problema:** depois de 90 dias, quem revelou uma senha ou fechou uma O.S. deixa de aparecer na tela de auditoria, e não há como consultar o arquivo a não ser pelo banco. A cópia e a exclusão também não estão numa transação (seguro por causa do `ON CONFLICT`, mas pode deixar registros duplicados entre as tabelas por um tempo).
- **Correção proposta:** consulta de auditoria que busca também no arquivo (ou filtro "incluir arquivados"); transação por lote.
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** Consulta paginada e isolada por tenant aceita archive=archived; tela oferece Recentes/Arquivados. Autor removido não impede consultar o histórico. Arquivamento faz cópia e exclusão na mesma transação por lote. Métricas e exportação continuam consultando a tabela ativa.

### C-069 · Worker: varredura completa de SLA a cada minuto, CORS aberto e validação de ambiente só em produção
- **Severidade:** Baixa
- **Área / item do plano:** 4 · Worker; 7 · Desempenho
- **Onde:** `apps/worker/src/sla/sla-monitoring.service.ts` (todas as O.S. abertas de todos os tenants a cada 60 s, com 2 a 5 consultas por O.S. que passa do limiar); `apps/worker/src/main.ts` (`app.enableCors()` sem origem; `validateEnv()` retorna cedo fora de produção, caso desta instância, C-047)
- **Correção proposta:** filtrar no banco só as O.S. que cruzaram um limiar desde a última execução; CORS desligado (o worker não é chamado pelo navegador); validação de ambiente sempre que não for localhost.
- **Conclusão (05/11):** sem CORS, validação de ambiente fora de loopback e varredura paginada (500 por vez); em execução. Seleção só de limiares recém-cruzados não é necessária no volume atual.
- **Status:** Corrigido (em execução)

---
- **Continuação do lote 7 (04/11):** CORS removido e ambiente validado também fora de produção quando WORKER_HOST não é loopback explícito. Monitor de SLA percorre páginas de 500 por cursor, sem carregar todas as ordens em memória. Pendente: selecionar somente os limiares recém-cruzados sem ignorar calendários/pausas.

## Fase 5 — Banco de dados

> Verificado e correto: as 39 migrations da pasta estão aplicadas no banco local, sem falha nem
> reversão; não há `DROP` destrutivo (só uma limpeza controlada de papéis antigos); o filtro de exclusão
> lógica (`deletedAt: null`) é aplicado de forma consistente; `AuditLog` usa `SetNull` (não perde
> auditoria ao apagar usuário ou tenant); as unicidades de protocolo, número de ocorrência e ids externos
> existem.
>
> **Limite desta verificação:** a base local tem 68 O.S., 66 delas de demonstração (`DEMO-`). As consultas
> de consistência deram zero em quase tudo, mas isso diz pouco sobre a base real. As mesmas consultas estão
> em [`consultas-consistencia.sql`](./consultas-consistencia.sql) para rodar na produção (só leitura).

### C-070 · Responsáveis, provedor, setor e origem gravados como texto, não como referência
- **Severidade:** Média
- **Área / item do plano:** 5 · Campos só texto
- **Onde:** `prisma/schema.prisma` → `Occurrence.provider`, `analystResponsible`, `openedByName`, `sector`, `origin`; `ServiceOrder.requester`, `ownerName`, `analystName`, `sector`, `origin` (existem `customerId`, `assigneeUserId`, `ownerUserId` e a tabela `TenantSector`, mas o texto é o que as telas, filtros e relatórios usam)
- **O problema:** renomear um analista, um provedor ou um setor não atualiza o histórico; filtros por provedor (`buildWhere`, `listOccurrences`) e relatórios por analista (C-040) comparam texto; workflows trocam o id sem trocar o nome (C-037). É a raiz de C-008, C-040 e parte de C-037.
- **Correção proposta:** usar as chaves (`customerId`, `assigneeUserId`, `ownerUserId`, `sectorId`, `originId`) como fonte de verdade e manter o texto só como "foto" histórica para exibição; migrar filtros e relatórios para as chaves; adicionar `analystResponsibleUserId` em `Occurrence`.
- **Conclusão (05/11):** migration `history_integrity` aplicada no banco em 05/11 (`openedByUserId`, `analystResponsibleUserId`).
- **Status:** Corrigido (em execução)
- **Continuação do lote 7 (04/11):** Novas ocorrências gravam openedByUserId e analystResponsibleUserId quando disponíveis. Listas e link do cadastro de clientes usam customerId e priorizam a chave sobre o nome. Sem backfill por nomes ambíguos. Permanecem setor/origem em texto, normalização dos fluxos legados e atualização integral dos relatórios.

### C-071 · Faltam índices para "Meu trabalho", portal e notas
- **Severidade:** Baixa
- **Área / item do plano:** 5 · Índices
- **Onde:** `ServiceOrder` não tem índice com `assigneeUserId` nem `ownerUserId` (usados por `scope=mine`); `Occurrence` não tem índice em `customerId` (usado pelo portal e pela contagem de ocorrências abertas por provedor); `Note` não tem índice em `authorUserId` (toda listagem filtra por ele)
- **Impacto:** hoje irrelevante (volume pequeno); vira lentidão com o histórico importado do SGP.
- **Correção proposta:** `@@index([tenantId, assigneeUserId, status])`, `@@index([tenantId, ownerUserId])`, `Occurrence @@index([tenantId, customerId, status])`, `Note @@index([tenantId, authorUserId, updatedAt])`.
- **Status:** Corrigido no código (migration pendente)
- **Continuação do lote 7 (04/11):** Migration history_integrity adiciona índices para responsável, proprietário, cliente da ocorrência e autor da nota, além de índices de expiração/revogação de sessões.

### C-072 · Três migrations e a mudança do schema estão fora do git
- **Severidade:** Média
- **Área / item do plano:** 5 · Migrations
- **Onde:** `prisma/migrations/20261024182000_customer_optional_document/`, `20261024210000_team_roster/`, `20261024223000_shift_report_attachments/` (não versionadas); `prisma/schema.prisma` modificado sem commit
- **O problema:** o banco local já tem essas migrations aplicadas, mas elas só existem nesta máquina. Um deploy a partir do repositório, ou a perda deste disco, gera um banco sem escala da equipe nem anexos de relatório de turno, e o código atual quebra.
- **Correção proposta:** commitar as migrations junto com o schema e o código que as usa (faz parte de organizar o trabalho pendente).
- **Commit (05/11):** migrations, schema e todo o trabalho pendente versionados na branch `auditoria/correcoes-lotes-0-6` (10 commits por área).
- **Status:** Corrigido (na branch, sem push)

### C-073 · Sessões expiradas nunca são removidas
- **Severidade:** Baixa
- **Área / item do plano:** 5 · Banco; 2.1 · Sessão
- **Onde:** nenhum job apaga `Session` expirada (só os OTPs têm limpeza); na base local, 337 das 481 sessões estão expiradas e não revogadas
- **Correção proposta:** tarefa diária no worker apagando sessões expiradas ou revogadas há mais de N dias (mantendo o registro de login na auditoria).
- **Status:** Corrigido no código (não implantado)
- **Continuação do lote 7 (04/11):** Job diário às 02:30 remove em lotes de 500 sessões expiradas/revogadas há mais de SESSION_RETENTION_DAYS (padrão 30). Revalida o predicado na exclusão para não remover sessão renovada entre leitura e escrita; auditoria permanece.

### C-074 · Algumas exclusões em cascata apagam histórico que deveria ficar
- **Severidade:** Baixa
- **Área / item do plano:** 5 · `onDelete`
- **Onde:** `TimeEntry.user` (`Cascade`: apagar o usuário apaga as horas trabalhadas, inclusive faturáveis); `NetworkTopology.customer` (`Cascade`: apagar o provedor apaga a topologia e todas as revisões); `SatisfactionResponse.order` e `TimeEntry.order` (`Cascade` com a O.S.)
- **O problema:** hoje usuários e O.S. são excluídos de forma lógica, então o risco é baixo, mas qualquer exclusão física (script, limpeza de demonstração como `scripts/clean-nonproduction-os-fixtures.ts`) leva junto histórico de faturamento e de rede.
- **Correção proposta:** `Restrict` (ou `SetNull` com nome guardado) para horas e topologias; revisar os scripts de limpeza para não tocar em dados reais (ver Fase 6).
- **Status:** Corrigido no código (migration pendente)

---
- **Continuação do lote 7 (04/11):** Migration troca Cascade por Restrict em TimeEntry.order/user, NetworkTopology.customer e SatisfactionResponse.order. Exclusão lógica permanece disponível; exclusão física com histórico falha. Teste em PostgreSQL confirma preservação de horas e topologia.

## Fase 6 — Infraestrutura e operação

> Contexto verificado em 04/11 (só leitura): o ERP roda neste host pelo `docker-compose.yml` de
> desenvolvimento (`pnpm dev`). O nginx do host (portas 80/443, com certificado) atende **outro** sistema
> (`portaldocliente.ajustconsulting.com.br` → portas 8010/8011/8110/8111), não o ERP. Não há `crontab`
> para o usuário da aplicação. O único backup existente é de 16/10/2026.
>
> Verificado e correto: `start-api.sh` usa `prisma migrate deploy` (não `db push`); `.env` nunca foi
> versionado e os `.env.*.example` não contêm segredos reais; o compose de produção não publica Postgres
> nem Redis, tem healthchecks e limites de recursos; `db-restore.sh` e `db-rollback.sh` pedem para digitar
> o nome do banco antes de apagar.

### C-075 · O ERP é acessado por HTTP puro, sem TLS
- **Severidade:** Alta
- **Área / item do plano:** 6 · Infraestrutura; 2.3 · Borda
- **Onde:** acesso direto em `http://168.194.13.18:8070` (`docker-compose.yml`, `web` publicado em `0.0.0.0:8070`); fallback `PUBLIC_APP_URL || 'http://168.194.13.18:8070'` em `notifications.service.ts`; `docker-compose.prod.yml` publica `web` em `80:3000`, também sem TLS; o nginx do host não tem site para o ERP
- **O problema:** login, senha, cookies de sessão, senhas reveladas do cofre e dados dos provedores trafegam em texto claro pela internet. Como `NODE_ENV=development`, os cookies também saem sem `Secure`. Em produção (`NODE_ENV=production`), os cookies passariam a ser `Secure` e o login **pararia de funcionar** em HTTP, a menos que se use `COOKIE_INSECURE=true` (que desliga a proteção).
- **Impacto:** qualquer rede no caminho (Wi-Fi público, provedor) lê as credenciais da equipe e do cofre.
- **Correção proposta:** publicar o ERP atrás do Caddy que já termina o HTTPS do host (novo arquivo em `sites/`), com `web` em `127.0.0.1:8070`; redirecionar HTTP → HTTPS; `NODE_ENV=production` e cookies `Secure`; `PUBLIC_APP_URL`/`WEB_BASE_URL` com o domínio HTTPS.
- **Como validar:** `curl -I http://<domínio>` → 301 para HTTPS; a porta 8070 não responde de fora.
- **Andamento (04/11):** a borda HTTPS do servidor é o **Caddy** (`edge_caddy`, `/home/app/infra/caddy`), não o nginx (desativado em 26/10). Site pronto em `/home/app/infra/caddy/sites/ajust-erp.caddy.exemplo`, com roteamento de `/socket.io` para a API; falta um domínio com DNS apontando para o servidor.
- **Status:** Em correção (preparado; falta o domínio)

### C-076 · Backups: sem agendamento, só do banco, sem a chave do cofre e no mesmo disco
- **Severidade:** Alta
- **Área / item do plano:** 6 · Backups e restauração
- **Onde:** `scripts/db-backup.sh` (só `pg_dump`; grava em `./backups`; apaga com mais de 30 dias); nenhum cron no host; `uploads/` (anexos, relatórios de turno, logos) e `uploads/.keys/vault.key` fora de qualquer backup; `scripts/db-restore.sh` (apaga e recria o banco **antes** de validar o dump e não faz uma cópia de segurança do estado atual)
- **O problema:**
  1. O último backup tem 19 dias; nada roda automaticamente.
  2. Sem `vault.key`, um backup do banco restaurado em outro servidor tem **todas as senhas do cofre ilegíveis** (C-054: a aplicação ainda criaria uma chave nova sem avisar).
  3. Backup e dados estão no mesmo disco e no mesmo servidor exposto (C-046): uma perda de disco ou um ataque leva os dois.
  4. Um dump corrompido só é descoberto depois de o banco já ter sido apagado.
- **Impacto:** perda de dados e do cofre inteiro em caso de falha do servidor.
- **Correção proposta:** agendamento diário (cron ou serviço no compose) do banco **e** de `uploads/` (inclusive a chave, guardada separada e criptografada); cópia para fora do servidor (outro host ou armazenamento de objetos), com retenção diária, semanal e mensal; no restore, `pg_restore --list` antes de apagar e dump automático do estado atual; teste de restauração mensal documentado.
- **Como validar:** existe backup de hoje fora do servidor; o restore num ambiente limpo abre uma credencial do cofre.
- **Andamento (04/11):** backup completo feito e validado em `/home/app/backups/ajust_erp/20261104_160913/` (banco, `uploads/`, `vault.key`, `.env` antigo, `SHA256SUMS`; pasta `0700`). **Falta:** copiar para fora do servidor e agendar a rotina diária.
- **Conclusão (05/11):** `scripts/backup-completo.sh`: banco validado, uploads com a chave do cofre, `.env` e hashes, retenção de 14 dias, e cópia externa por rsync assim que existir `destino.conf`. Executado com sucesso em 05/11. O agendamento no crontab foi bloqueado pelas permissões do assistente e precisa ser instalado pelo usuário.
- **Status:** Em correção (parcial; falta destino externo e agendamento)

### C-077 · Redis de produção descarta chaves das filas e do rate limit quando enche
- **Severidade:** Média
- **Área / item do plano:** 6 · Infraestrutura; 4 · Worker
- **Onde:** `docker-compose.prod.yml` (`--maxmemory 256mb --maxmemory-policy allkeys-lru`, sem `requirepass`); `docker-compose.yml` (`volatile-lru`)
- **O problema:** o BullMQ exige `noeviction`. Com `allkeys-lru`, quando a memória enche, o Redis apaga qualquer chave: jobs agendados (SLA, IXC, retenção), travas de idempotência dos alertas de SLA (C-028) e bloqueios de login (C-049). As tarefas somem sem erro. O Redis de produção também não tem senha (no prod ele não está publicado, mas fica acessível a qualquer contêiner da rede).
- **Correção proposta:** `--maxmemory-policy noeviction` (e memória dimensionada), ou separar o Redis das filas do de cache; `requirepass` (depois de C-065).
- **Andamento (04/11):** `noeviction` no `docker-compose.yml`. Falta o mesmo no `docker-compose.prod.yml`.
- **Aplicado (04/11, 16:26):** Redis recriado com `noeviction`.
- **Status:** Corrigido nos arquivos de compose (produção pendente)
- **Fechamento de pendências (04/11):** Complemento da continuação anterior: compose de produção também usa noeviction, autenticação e AOF. Não foi reiniciado Redis nesta etapa.

### C-078 · O servidor roda a configuração de desenvolvimento, que lê `.env.example` e monta o repositório inteiro
- **Severidade:** Média
- **Área / item do plano:** 6 · Variáveis por ambiente; 2.6 · Segredos
- **Onde:** `docker-compose.yml` (`env_file: .env.example` em `web`, `api` e `worker`; padrões `ajust123`, `dev-access-secret`, `dev-refresh-secret`, `change-this-secret-key-in-production`; `volumes: ./:/workspace` com leitura e escrita; `IXC_MOCK_RECONCILE` padrão `true`; tudo como root); `Dockerfile` (as imagens finais rodam como root, sem `USER node`; o `builder` faz `COPY . .` e o `.dockerignore` não exclui `backups/` nem `uploads/`, então dumps e `vault.key` entram nas camadas de build quando a imagem é gerada nesta máquina); `docker-compose.prod.yml` (API publicada em `3001:3001`, imagens `:latest` por padrão)
- **O problema:** (a) a API não carrega `.env` sozinha (não usa dotenv): o que vale dentro do contêiner é o `.env.example` mais os padrões do compose. Por isso trocar só o `.env` **não corrige** C-047; variáveis como `JWT_RESET_SECRET` vêm do exemplo. (b) O valor de `SECRETS_ENCRYPTION_KEY` que protege 2FA, tokens do IXC e topologias é, pelo tamanho, o padrão público `change-this-secret-key-in-production`, que está no próprio repositório. (c) Um processo comprometido dentro do contêiner escreve no código-fonte, no `.env` e nos backups do host. (d) A reconciliação do IXC está em modo simulado por padrão.
- **Correção proposta:** rodar o servidor com o compose de produção (imagens construídas, sem montar o repositório); se o de desenvolvimento continuar sendo usado aqui, trocar `env_file` para `.env` e remover os padrões inseguros (falhar se a variável faltar: `${VAR:?obrigatória}`); `USER node` no Dockerfile; incluir `backups/`, `uploads/` e `*.dump` no `.dockerignore`; API sem porta pública em produção; tags de imagem fixas.
- **Como validar:** `docker compose config` não mostra nenhum valor padrão inseguro; dentro do contêiner, `id -u` ≠ 0.
- **Andamento (04/11):** `env_file` passa a ser `.env.example` e depois `.env` (o `.env` vence); padrões inseguros removidos; `.dockerignore` exclui `backups/`, `uploads/`, `*.dump` e `.env.*`. Pendente: rodar o compose de produção, `USER node`, tags fixas.
- **Status:** Em correção (parcial)

### C-079 · Scripts de manutenção que apagam ou reescrevem dados não têm trava de ambiente
- **Severidade:** Média
- **Área / item do plano:** 6 · Scripts
- **Onde:** `scripts/` (70 arquivos; ao menos 16 gravam no banco sem nenhuma checagem de ambiente, confirmação ou modo de simulação), por exemplo `replace-ajustpedia-knowledge.cjs` (`knowledgeArticle.deleteMany({ where: { tenantId } })`, apaga **todos** os artigos do tenant), `analyst-review-fixture.ts`, `provision-manager-review.cjs`, `finalize-meganet-vault.ts`, `backfill-sgp-links.ts`; alguns têm trava (`reset-sgp-imports-for-demo.ts` exige `AJUST_SGP_PURGE_BACKUP_VERIFIED`)
- **O problema:** todos usam o `DATABASE_URL` do ambiente, que neste servidor aponta para o banco em uso. Rodar o script errado, ou o certo duas vezes, apaga dados reais sem volta, e o backup tem 19 dias (C-076).
- **Correção proposta:** um padrão único para scripts que escrevem: `--dry-run` por padrão, `--apply` explícito, confirmação com o nome do banco, recusa se `NODE_ENV=production` sem `ALLOW_DATA_SCRIPT=1`, backup antes; mover os scripts de demonstração/fixture para uma pasta separada que não roda fora de desenvolvimento.
- **Continuação do lote 6 (04/11):** `scripts/data-script-guard.cjs` aplicado aos entrypoints de manutenção/importação identificados: sem `--apply` encerra antes de conectar; com aplicação exige `NODE_ENV` explícito, `--confirm-database=NOME`, `DATA_SCRIPT_BACKUP_VERIFIED=1` e, em produção, `ALLOW_DATA_SCRIPT=1`. Fixtures exigem development. O modo padrão é uma pré-verificação sem execução, não uma simulação das diferenças no banco. Rotação preserva a simulação existente e o chamador do lote 0 verifica as novas travas antes de parar serviços. Quatro testes do guard passam. Scripts de restauração/rollback conservam seus mecanismos próprios; padronização destes e simulação detalhada por script continuam pendentes.
- **Conclusão (05/11):** trava `data-script-guard` em 34 scripts que gravam no banco; em vigor.
- **Status:** Corrigido (em execução)

---

## Fase 7 — Qualidade transversal

> Linha de base rodada em 04/11 sobre o working tree atual (com o trabalho pendente):
>
> | Verificação | Resultado |
> | --- | --- |
> | Typecheck API / worker | 0 erros |
> | Typecheck web | 7 erros, todos de C-001 (`dashboard.tsx`, `monitor-pages.tsx`) |
> | Testes API (Jest) | 560 passam, **1 falha (C-002)**, 13 pulados (5 suítes de integração com banco, ver C-081) |
> | Testes worker | 31 de 31 passam |
> | Lint back-end | 0 erros, 1 aviso (`no-unused-vars`) |
> | Lint web | 0 erros, 10 avisos (`react-hooks/exhaustive-deps`, `no-location-assign-relative-destination`, `no-img-element`…) |
>
> Higiene boa: 7 `console.log` no back-end, 7 arquivos com `as any`, nenhum `eslint-disable`, um único
> `catch` vazio. Desempenho: os pontos relevantes já estão em C-022, C-040, C-041, C-069 e C-071.

### C-080 · Mensagens de erro da API em inglês chegam à tela
- **Severidade:** Média
- **Área / item do plano:** 7 · Consistência de UX
- **Onde:** cerca de 124 das 453 mensagens `throw new …Exception('…')` da API estão em inglês ("Service order not found.", "Transition ABERTA -> FECHADA is not allowed.", "Role is not allowed to…", "Closing delayed ALTA/CRITICA order requires explicit approval before FECHADA."); `apps/web/lib/bff/server.ts:upstreamErrorMessage` repassa o texto como veio; as mensagens padrão do Zod também saem em inglês ("Required", "Expected string…")
- **O problema:** o usuário vê mensagens técnicas em inglês nos pontos de maior tensão (fechar, aprovar, transicionar). É parte da "ansiedade" relatada na abertura do atendimento.
- **Correção proposta:** padronizar as mensagens da API em português claro e acionável (o que aconteceu + o que fazer); mapa de erros Zod em português (`z.setErrorMap`); códigos estáveis (`code: 'TRANSITION_NOT_ALLOWED'`) para a tela poder dar texto próprio.
- **Como validar:** `grep` sem mensagens em inglês nos `throw` da API; teste do `upstreamErrorMessage` com erro Zod.
- **Lote 5 (04/11):** tradução na saída (filtro global): `error-messages-pt.ts` com ~90 mensagens exatas e padrões (permissão, anexos, transição) e erros do Zod em português ("Preencha campo", "Formato inválido…"); mensagens que já estavam em português passam sem alteração. O código e os testes continuam com o texto original. Pendente: nomes de campo nos erros de validação ainda saem como no schema (`identifier`, `password`) e ~60 mensagens menos comuns.
- **Lote 6, fechamento (05/11):** nomes de campo traduzidos nos erros de validação ("Preencha senha.", "Valor curto demais em e-mail ou usuário."); campos sem tradução saem como no schema.
- **Status:** Corrigido (sem commit; já em execução)

### C-081 · Os testes de integração com banco nunca rodam no CI
- **Severidade:** Média
- **Área / item do plano:** 7 · Testes
- **Onde:** `apps/api/src/service-orders/order-operations.integration.spec.ts`, `service-processes/service-processes.integration.spec.ts`, `service-processes/operational-processes.integration.spec.ts`, `customers/import-sgp-registry.integration.spec.ts`, `network-topologies/network-topologies.integration.spec.ts` (`process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip`); `.github/workflows/ci.yml` sobe um Postgres e roda `migrate deploy`, mas **não** define `PROCESS_DB_TESTS`
- **O problema:** justamente os testes que exercitam o motor de processos, as operações do analista e a sincronização da ocorrência com banco real ficam pulados em todo lugar. O CI fica verde sem testar o fluxo principal de atendimento.
- **Correção proposta:** `PROCESS_DB_TESTS: '1'` no job que já tem Postgres; documentar como rodar localmente.
- **Como validar:** o log do CI mostra as 5 suítes executadas.
- **Lote 2 (04/11):** `scripts/test-db.sh` roda as 5 suítes com banco num Postgres descartável restaurado do backup (50 testes passando). Ligar no CI exige um seed mínimo (tenant, papéis, usuários, modelos de fluxo), que ainda não existe.
- **Continuação do lote 6 (04/11):** CI passa a executar as suítes com `PROCESS_DB_TESTS=1` e `REGISTRY_DB_TESTS=1`, após seed mínimo restrito a banco local vazio `ajust_ci`. `scripts/test-db.sh` cria um PostgreSQL novo, aplica todas as migrations, carrega o seed e remove o contêiner ao terminar. Não usa backup nem dados reais. O teste de atendimento agora prepara `AJUST_SIMPLES` dentro da própria transação. Resultado local: 61 testes em 12 suítes de integração passam. A execução remota do GitHub Actions ainda depende de publicar os commits.
- **Status:** Corrigido no código (CI remoto pendente)

### C-082 · Lacunas de teste exatamente onde estão os achados críticos e altos
- **Severidade:** Média
- **Área / item do plano:** 7 · Cobertura das regras críticas
- **Onde:** nenhum teste para `iam.service` (`createUser`, `updateUserInTenant`, `removeUserFromTenant`: C-020, C-021), `auth.service.updateMe` (C-048), feriado no motor de SLA (C-026), `dispatchWhatsAppOrder` (C-033); o teste do webhook de chat mocka `ServiceOrdersService` e por isso não percebeu que a integração sempre falha (C-043); o web não tem testes de componente (só 3 arquivos e2e com Playwright)
- **Correção proposta:** cada correção dos lotes 1 a 4 entra com o teste que falharia antes (já indicado em "Como validar" de cada achado); para integrações, ao menos um teste com o serviço real e Prisma mockado no nível do banco; testes de componente para o formulário de abertura e a tela de transição.
- **Continuação do lote 6 (04/11):** Regressões do lote 6 cobrem SSRF nos dois serviços, métricas sem autenticação, motivo/senha do cofre, concorrência real no limite, chave ausente em produção, negações na auditoria, conteúdo/quota/visibilidade dos anexos e trava dos scripts. Cobertura das suítes API/worker acima dos mínimos configurados. Testes de componente/navegador dos fluxos de abertura, transição e confirmação do cofre continuam pendentes.
- **Status:** Corrigido em parte

### C-083 · Cópia antiga do front-end e arquivos compactados versionados dentro de `docs/`
- **Severidade:** Baixa
- **Área / item do plano:** 7 · Código morto e duplicado
- **Onde:** `docs/redeisgn-front-end/` (109 arquivos, ~1 MB, cópia de componentes como `order-contract-form.tsx` com o modal antigo); `docs/redesign-front-end/` (vazia); `docs/unificacao-do-ajust-erp2.zip` (268 KB) no git
- **O problema:** quem busca um componente no repositório encontra duas versões; correções são aplicadas na cópia errada; buscas por texto (como a do aviso de troca de serviço) devolvem resultados falsos.
- **Correção proposta:** remover as cópias do repositório (o histórico do git preserva) ou movê-las para um repositório de referência; manter em `docs/` só documentos.
- **Continuação do lote 6 (04/11):** Removidas as cópias versionadas em `docs/redeisgn-front-end/` e o ZIP `docs/unificacao-do-ajust-erp2.zip`. Conteúdo preservado no histórico Git. Nenhuma cópia foi promovida a código de produção.
- **Status:** Corrigido no repositório (sem commit)

### C-084 · Arquivos muito grandes e módulos declarados dentro de controllers
- **Severidade:** Baixa
- **Área / item do plano:** 7 · Manutenibilidade
- **Onde:** `service-orders.service.ts` (2.390 linhas), `operational-workflows.tsx` (1.515), `credentials-vault.tsx` (1.438), `operational-processes.service.ts` (1.136), `team-roster.tsx` (1.108), `knowledge.service.ts` (1.107), `auth.service.ts` (1.082), `orders.tsx` (1.032); `ShiftReportsModule`, `NetworkTopologiesModule`, `CustomersModule` e `CustomerPortalModule` definidos dentro de `*.controller.ts`
- **O problema:** revisões difíceis e conflitos frequentes; é onde os caminhos duplicados de C-013/C-035 se esconderam.
- **Correção proposta:** a divisão sai naturalmente do Lote 2 (o serviço de ciclo de vida tira boa parte do `service-orders.service.ts`); mover os módulos para `*.module.ts`.
- **Continuação do lote 6 (04/11):** CustomersModule, CustomerPortalModule, ShiftReportsModule e NetworkTopologiesModule movidos para `*.module.ts`, com imports atualizados. Validação dos anexos e diálogo de confirmação do cofre extraídos para arquivos próprios; serviço de ciclo de vida dos lotes anteriores preservado. A divisão dos demais arquivos grandes permanece como refatoração posterior.
- **Status:** Corrigido em parte

### C-085 · Avisos de lint pendentes no web e no back-end
- **Severidade:** Baixa
- **Área / item do plano:** 7 · Estado atual
- **Onde:** 10 avisos no web (2 `react-hooks/exhaustive-deps`, que podem causar dados desatualizados na tela; 2 `no-location-assign-relative-destination`; `no-img-element`…), 1 no back-end (`no-unused-vars`)
- **Correção proposta:** resolver junto com C-001 e transformar avisos em erro no CI, para não voltarem.
- **Continuação do lote 6 (04/11):** Avisos corrigidos sem desativar regras: dependências/limpeza dos efeitos, estado inicial de relógio, navegação pelo router, hidratação e imagem do logo. Lint agora executa com `--max-warnings=0` em todos os pacotes. Formatação pendente normalizada; arquivos locais de sessão Playwright excluídos do formatador.
- **Status:** Corrigido no código (sem commit)


## Continuação do lote 6 — 04/11/2026

Alterações implementadas e verificadas no working tree. Nenhum deploy, reinício de serviço,
consulta ao banco de produção, troca de chave ou execução de script de manutenção foi realizado
nesta continuação. O banco usado nos testes era novo e descartável.

### Implantação e pendências

- **Antes de iniciar a API atualizada:** aplicar a migration `20261104180000_audit_resource_actions` junto com as migrations anteriores e gerar o cliente Prisma.
- **Cofre em produção:** copiar com segurança a chave **existente** para fora de uploads, conferir a integridade e o backup, definir `VAULT_KEY_HOST_FILE` no compose de produção. O contêiner recebe o arquivo em `/run/secrets/vault.key`, somente leitura. Para dados existentes, nunca gerar outra chave. A API recusa iniciar com chave ausente, inválida ou dentro de uploads.
- **Métricas:** configurar Bearer administrativo ativo no coletor; o teste de smoke lê `API_METRICS_TOKEN`. Não basta estar em localhost.
- **Manutenção:** exportar o ambiente e usar `--apply --confirm-database=NOME` somente após verificar o backup; a variável `DATA_SCRIPT_BACKUP_VERIFIED=1` é declaração do operador, não comprovação automática de restauração.
- **C-072 / C-003:** organização e commit do trabalho anterior e desta continuação permanecem pendentes. O working tree já continha alterações extensas de outros lotes. As migrations foram aplicadas com sucesso em uma base vazia, mas isso não equivale a estarem publicadas no Git.
- **C-079 / C-082 / C-084:** pendências específicas mantidas nos respectivos achados; não foram marcados como integralmente resolvidos.

Para reproduzir os testes de banco: `bash scripts/test-db.sh` (Docker disponível). A limpeza do
contêiner é automática, inclusive se uma suíte falhar. Para as travas dos scripts:
`node --test scripts/data-script-guard.test.cjs`.


### Validação local desta continuação

| Verificação | Resultado |
| --- | --- |
| Typecheck API, web, worker e shared | Sem erros |
| Lint dos pacotes (`--max-warnings=0`) | Sem erros ou avisos |
| `format:check` | Passou |
| API com cobertura | 640 testes passaram; 15 casos de banco pulados nesta execução unitária |
| Worker com cobertura | 54 testes passaram |
| Suítes de integração em PostgreSQL descartável | 61 testes passaram, 12 suítes; flags de banco ativadas |
| Travas de scripts (`node --test`) | 4 testes passaram |
| `git diff --check` | Sem erros |

Os grupos unitário e de integração têm alguns testes em comum; os números não devem ser somados
como casos únicos. Os limites mínimos de cobertura configurados passaram. As telas novas foram
verificadas por TypeScript/lint; não foi executado teste de navegador nesta continuação.


## Continuação do lote 7 e pendências dos lotes 0/1 — 04/11/2026

Implementações desta continuação estão no working tree, sem implantação nem alteração de dados reais.
Os registros anteriores de “já em execução” descrevem o trabalho anterior; não significam que estas novas alterações estão publicadas.

### Preparação de infraestrutura (C-046, C-047, C-078)

O compose de produção publica web/API somente em loopback (8070/8071), exige segredos e URLs
explícitos e configura Redis autenticado, AOF e noeviction. API recebe WORKER_API_TOKEN.
Dockerfile gera Prisma no build e usa o usuário node nos três runtimes. O CI fornece valores
fictícios explícitos para validar o compose. Configuração validada com docker compose config,
sem subir serviços. Imagens não foram construídas nesta continuação.

Antes de implantar: aplicar todas as migrations, incluindo `20261104190000_history_integrity`,
gerar Prisma, conferir o proxy HTTPS para as portas internas e conceder ao UID 1000 acesso
adequado aos volumes e à chave existente do cofre. Redis exige REDIS_PASSWORD e REDIS_URL
coerentes; caracteres especiais da senha precisam ser codificados na URL. Não foi alterada
permissão de volumes reais. Tags imutáveis, TLS/domínio e backup externo continuam pendentes.

### Pendências preservadas

- C-018 / D-5: decisão sobre assumir O.S. de colega solicitada; nenhuma restrição nova aplicada sem resposta.
- C-062: total agregado da O.S. e paginação visual; C-064: rotação/recriptografia operacional.
- C-069: filtro incremental dos limiares; C-070: normalização completa e migração segura dos registros antigos.
- C-072: commits/publicação de todo o trabalho acumulado. Não foi criado commit abrangendo alterações anteriores.
- Demais achados abertos/parciais, incluindo decisões D-2/D-6 e operação de produção, permanecem na tabela.

### Validação desta continuação

| Verificação | Resultado |
| --- | --- |
| Typecheck API, web, worker e shared | Passou; API revalidada após os últimos testes |
| Lint dos pacotes (`--max-warnings=0`) | Passou; arquivo de testes adicional revalidado |
| Formatação e `git diff --check` | Passaram |
| API com cobertura | 660 testes passaram; 16 casos de banco pulados nessa execução |
| Worker com cobertura | 55 testes passaram |
| Suíte direcionada após inclusão dos dois casos de abertura manual | 5 testes passaram (3 existentes + 2 novos) |
| Integração PostgreSQL descartável | 62 testes passaram em 13 suítes; migrations aplicadas com sucesso |
| Compose de produção | Configuração válida com variáveis fictícias; publicação local e Redis autenticado conferidos |

Limites de cobertura configurados passaram. Os grupos se sobrepõem e não devem ser somados como
casos únicos. Testes de banco usam PostgreSQL descartável e não acessam a base da aplicação.
Imagens Docker e interface em navegador não foram validadas por execução nesta continuação.


## Fechamento adicional de pendências — 04/11/2026

### Decisões confirmadas pelo usuário

- **D-2:** processos v2 oficiais e workflows para efeitos; retirar os mecanismos antigos após conferir o legado.
- **D-5:** colaboração permitida sem assumir a O.S.; histórico deve identificar o ator.
- **Infraestrutura:** usuário ainda não tem domínio nem destino externo de backup. C-075/C-076 permanecem pendentes, sem inventar uma configuração.

### Evidência e limites desta etapa

Consultas no PostgreSQL da aplicação foram executadas em transação `READ ONLY`, somente para
inventário de motores. Resultado: 35 processos v2 ativos e 30 concluídos, nenhum processo v1,
nenhum modelo de processo v1 ou modelo antigo de O.S.; consulta de ações de WorkflowRule sem linhas.
Não houve migração ou escrita de dados nessa base. A única alteração operacional local foi
reduzir para 0600 a permissão do dump já citado em C-058. Nenhum comando de deploy ou reinício foi executado.

Novas migrations: `20261104200000_totp_replay_protection` e
`20261104201000_operational_engine_cutover`, além das anteriores pendentes. A segunda é uma
pré-condição: aborta se encontrar legado ativo/configurado incompatível, em vez de abandoná-lo.
As migrations foram aplicadas apenas no banco descartável dos testes. Implantar código que usa
o contador TOTP exige aplicar a migration e gerar Prisma antes de iniciar a API atualizada.

As telas de autenticação, histórico legado e apontamentos passaram por tipos/lint; teste visual
em navegador ainda não foi executado. O CI agora executa também os testes de proteção de scripts
(guard e backup). Nenhum envio de e-mail/webhook real foi feito durante esta validação.

### Pendências que continuam abertas

C-013/C-016/C-035 (unificação transacional), complementos de integrações/relatórios/plantão,
C-064 (rotação/recriptografia), C-069 (monitor incremental), C-070 (normalização completa),
C-072 (organização e publicação do trabalho acumulado), partes de C-079/C-082/C-084 e implantação.
C-075/C-076 dependem do domínio/destino que o usuário informou ainda não possuir.
Esta etapa não equivale ao encerramento de todos os achados da auditoria.

### Validação final do fechamento adicional

| Verificação | Resultado |
| --- | --- |
| Typecheck dos quatro pacotes | Passou; API revalidada após os últimos ajustes |
| Lint com zero avisos | Passou; últimos arquivos alterados revalidados |
| Formatação e `git diff --check` | Passaram |
| API com cobertura | 666 testes passaram; 17 testes de banco pulados na execução unitária |
| Worker com cobertura | 55 testes passaram |
| Integração PostgreSQL descartável | 63 testes passaram em 14 suítes; inclui concorrência/reuso de TOTP e migrations |
| Guard de manutenção + backup simulado | 6 testes passaram |

Limites configurados de cobertura passaram. Os grupos de testes se sobrepõem. O E2E de segurança
foi adaptado para recusar reuso do código usado na configuração do 2FA e usar o passo seguinte
para autenticar; foi verificado por tipos/lint, sem executá-lo contra o servidor real.
Nenhum teste visual em navegador nem build de imagens foi executado nesta etapa.

## Continuação autorizada — atomicidade de O.S. e SLA (04/11/2026)

HTTPS e backup externo ficam fora da execução atual por solicitação do usuário; as demais
pendências continuam autorizadas, sem necessidade de nova confirmação.

Corrigida uma lacuna transacional em `ServiceOrdersService.updateOrder` e `transition`:
a atualização da O.S., seu histórico embutido e o evento de SLA agora são gravados na mesma
transação. Falha ao registrar mudança de prazo, pausa ou retomada desfaz a alteração da O.S.
O fechamento manual também revalida a aprovação dentro da transação. Efeitos externos continuam
posteriores à confirmação da gravação.

Dois testes novos em PostgreSQL provocam uma falha depois de inserir o evento de SLA e confirmam
rollback de prazo/status/pausa, versão e históricos. Validação: 666 testes API com cobertura;
65 testes de integração em 15 suítes no PostgreSQL descartável; typecheck API, lint API,
formatação do projeto e `git diff --check` aprovados. Os grupos se sobrepõem.
Nenhuma migration ou gravação foi executada na base da aplicação nesta continuação.

A unificação completa C-013/C-016/C-035 e os demais itens ainda parciais permanecem em andamento;
a correção acima não encerra esses achados inteiros.


## Continuação — conclusão conjunta, reconciliação e autoria (04/11/2026)

Trabalho retomado sem pedir nova autorização. C-016 e C-007 concluídos no código; C-066 avança
para a autoridade da API. Dados reais não foram alterados por comandos de manutenção ou testes.
HTTPS e backup externo continuam fora do escopo atual por determinação do usuário.

Validação: 669 testes API com cobertura, 49 worker com cobertura, 68 testes nas 16 suítes de
integração em PostgreSQL descartável. Typecheck dos quatro pacotes, lint sem avisos, formatação
e git diff --check passaram. Testes antigos do cálculo duplicado de SLA do worker foram retirados
junto com esse código; substituídos por testes do encaminhamento à API e da fronteira interna.
Os grupos de testes se sobrepõem. Sem teste de navegador nem implantação nesta continuação.

Implantação deve atualizar API e worker juntos: polling depende de
POST /integrations/ixc/internal/delta e de WORKER_API_TOKEN coerente entre ambos; API_INTERNAL_URL
no worker aponta à API interna (padrão http://api:3001). Endpoint não foi adicionado à allowlist
do BFF e recusa token ausente ou inválido. Nenhum pedido real ao IXC foi enviado nos testes.

---

## Achados durante as correções

### C-086 · Worker ficou 22 horas parado porque a validação de ambiente exigia SMTP
- **Severidade:** Alta (regressão introduzida ao corrigir C-069)
- **Área / item do plano:** 4 · Worker; 6 · Operação
- **Onde:** `apps/worker/src/main.ts:validateEnv` (a validação passou a valer fora de `localhost` e tratava `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS` como obrigatórios; o servidor não tem SMTP)
- **O que aconteceu:** de 04/11 às 18:11 até 05/11 às 16:09 o worker abortava a cada reinício ("Variáveis inseguras em produção: SMTP_HOST, SMTP_USER, SMTP_PASS"). O contêiner ficou `unhealthy` e nada rodou: monitor de SLA, alertas, reconciliação do IXC, retenção de exportações e arquivamento de auditoria.
- **Correção aplicada (05/11):** SMTP é opcional (sem ele o worker só não envia e-mail e registra aviso); só é validado quando `SMTP_HOST` está definido. Segredo, banco e token do worker continuam obrigatórios. Teste novo `apps/worker/src/main-env.spec.ts`. Depois da correção: worker `healthy`, SLA avaliado a cada minuto, sem reenvio dos alertas já emitidos (35 O.S. vencidas, 0 alertas repetidos).
- **Lição:** toda mudança de validação de ambiente precisa de um teste que suba o processo com a configuração real do servidor, e o healthcheck `unhealthy` deveria gerar alerta (não há ninguém olhando o `docker ps`).
- **Status:** Corrigido (sem commit; já em execução)

### C-087 · Código em execução dependia de 4 migrations não aplicadas: login fora do ar
- **Severidade:** Crítica (incidente)
- **Área / item do plano:** 5 · Migrations; 6 · Operação
- **Onde:** `prisma/migrations/20261104180000_audit_resource_actions`, `20261104190000_history_integrity`, `20261104200000_totp_replay_protection`, `20261104201000_operational_engine_cutover` (criadas no repositório, não aplicadas no banco); o servidor roda em modo `watch`, então o código novo entrou em execução sozinho
- **O que aconteceu:** o cliente Prisma passou a ler `User.twoFactorLastCounter`, `Occurrence.analystResponsibleUserId` e `ChangeRequest.version`. Todo login respondia 500 (P2022) e a leitura de ocorrências e RFCs falhava.
- **Correção aplicada (05/11):** backup validado (`/home/app/backups/ajust_erp/20261105_162753`), conferência da trava de corte (nenhum legado ativo) e `prisma migrate deploy`. Depois: 43 migrations aplicadas, login respondendo 401 normal para credencial errada, leituras ok, nenhum P2022 no log.
- **Lição:** com o servidor em modo `watch`, toda migration nova precisa ser aplicada junto com o código; o caminho certo é o deploy de produção (`start-api.sh` roda `migrate deploy` antes de subir), ver C-078.
- **Status:** Corrigido (aplicado)
