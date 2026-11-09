# Desempenho com volume sintético — listagem, painel, exportação e outbox

- **Projeto:** Ajust ERP
- **Branch / commit:** `auditoria/correcoes-lotes-0-6` / `9803ac1`
- **Data da medição:** 2026-11-09
- **Ambiente:** descartável — contêiner Docker `perf-pg` com PostgreSQL 16, banco `ajust_perf`, schema aplicado por `prisma migrate deploy` (44 migrations, 58 tabelas)
- **Escopo:** somente leitura. Nenhum índice foi aplicado no repositório ou em produção, e nenhum commit foi feito.

---

## 1. Resumo executivo

Com **20.000 O.S.**, **5.000 ocorrências**, **200.000 eventos de histórico**, **50.000 anotações** e **241.350 eventos de outbox**:

- **Nenhuma consulta SQL isolada passou de 300 ms.** A maior foi a busca textual por `fibra` (43,1 ms de execução no PostgreSQL); a busca por protocolo ficou em 42,4 ms.
- **Dois fluxos passaram de 300 ms:**
  - **Exportação CSV de ~10 mil linhas:** **817,7 ms** de wall no Prisma, mas apenas **27,7 ms** dentro do banco. O custo está na materialização/transporte de 9.902 linhas (2,72 MiB de CSV).
  - **Dashboard em modo operação:** **1.344,7 ms**, porque o frontend busca 50 páginas de 200 linhas (9.902 registros) antes de calcular os indicadores.
- **Melhores ganhos de índice (medidos):**
  - Outbox pendente: **42,8 → 1,6 ms** (**−96,2%**)
  - `topAssignees` do resumo: **11,4 → 2,2 ms** (**−80,8%**)
  - `byType`: **8,7 → 2,2 ms** (**−75,2%**)
  - `byStatus`: **8,6 → 2,4 ms** (**−72,4%**)
  - `byPriority`: **8,6 → 2,7 ms** (**−68,7%**)
- **Busca textual não ganhou com trigram.** O `OR` da busca inclui `Occurrence.provider`, então o predicado é aplicado como filtro de *join*, e nenhum índice GIN foi usado pelo planejador. Índices trigram só fazem sentido depois de reescrever a consulta ou criar uma coluna de busca denormalizada.
- **O loop do dashboard é o risco estrutural.** O tenant A tem 9.902 O.S. não excluídas — está a 98 linhas do limite de 10.000 em que `useOperationalOrders` lança erro em vez de exibir o painel.

---

## 2. Massa sintética

| Entidade | Volume | Observação |
|---|---:|---|
| Tenants | 3 | A: 10.000 O.S.; B: 6.000; C: 4.000 |
| Usuários | 300 | 100 por tenant (2 gerentes, 88 analistas, 10 clientes) |
| Clientes | 600 | 200 por tenant |
| Ocorrências | 5.000 | 2.500 / 1.500 / 1.000 por tenant |
| Ordens de serviço | 20.000 | 1% com `deletedAt` preenchido |
| Eventos de status | 200.000 | 10 por O.S. |
| Anotações de O.S. (`ServiceOrderOccurrence`) | 50.000 | espelhadas em `OccurrenceAnnotation` |
| Anotações de ocorrência | 50.000 | — |
| Notas de conhecimento | 50.000 | — |
| Eventos de outbox | **241.350** | 50.000 sintéticos + 20.000 `created` + 171.350 `status` gerados por triggers |

O outbox ficou maior que os 50.000 pedidos porque os triggers `order_created_outbox` e `order_status_outbox` enfileiram eventos adicionais durante o seed. Desses 241.350, **64.617 estavam pendentes** (`processedAt IS NULL`).

Distribuição usada para a busca textual no tenant A (9.902 O.S. vivas): `cliente` casa 5.479 linhas (55%), `fibra` casa 103 (1,0%) e `20261000` casa 97 (1,0%).

Tamanho das tabelas ao final do seed:

| Tabela | Linhas | Tamanho total |
|---|---:|---:|
| `ServiceOrderLifecycleEvent` (outbox) | 241.350 | 230 MB |
| `ServiceOrderStatusEvent` | 200.000 | 85 MB |
| `ServiceOrderOccurrence` | 50.000 | 24 MB |
| `ServiceOrder` | 20.000 | 25 MB |
| `Occurrence` | 5.000 | 4,6 MB |

---

## 3. Metodologia

1. **Postgres separado.** `docker run --name perf-pg -e POSTGRES_PASSWORD=*** -p 127.0.0.1:55432:5432 -d postgres:16`; banco `ajust_perf` criado do zero; schema aplicado com `prisma migrate deploy`. O script de medição aborta se `current_database()` não for `ajust_perf`.
2. **Prisma Client real do projeto** (6.19.3), com log de queries habilitado. As consultas foram reproduzidas a partir de:
   - `apps/api/src/service-orders/service-orders.service.ts` (`list`, `summary`, `exportCsv`, `buildWhere`);
   - `apps/api/src/service-orders/lifecycle-outbox.service.ts` (pendentes do outbox);
   - `apps/web/lib/erp/use-operational-orders.ts` (loop de 200 em 200 até 10.000).
3. **`EXPLAIN (ANALYZE, BUFFERS)`** para cada consulta SQL capturada, com mediana de 3 execuções (exportação: 2; outbox: 5). Os parâmetros foram **substituídos literalmente** no texto do `EXPLAIN`, porque o PostgreSQL rejeitou o `EXPLAIN` com parâmetros vinculados (`operator does not exist: timestamp without time zone < text`). Os valores literais são exatamente os enviados pelo Prisma.
4. **Três camadas de tempo**, sempre separadas no relatório:
   - `exec`: tempo de execução dentro do PostgreSQL (do `EXPLAIN`);
   - `wall`: tempo total da chamada no Prisma, incluindo transporte, montagem do resultado e das relações;
   - `fluxo`: tempo do loop completo do frontend (várias requisições).
5. **Ambiente único, cache aquecido e sem concorrência.** Os valores absolutos tendem a ser menores que em produção sob carga; o que importa aqui são as **proporções** e os planos.
6. Comparações de índice foram feitas em **pares** (antes/depois na mesma execução), criando o índice, rodando `ANALYZE` e repetindo a mesma consulta; depois o índice era removido. Para confirmar que o Prisma realmente usa cada índice, foi feito um A/B adicional com 8 execuções de aquecimento + 9 medições e leitura de `pg_stat_user_indexes`.

Limitações: massa sintética com distribuição fixa; cache quente; um único nó; sem usuários simultâneos; PostgreSQL com parâmetros padrão. Números de outro ambiente não devem ser comparados diretamente.

---

## 4. Baseline

### 4.1 Listagem de O.S.

Tempo de banco é o da consulta principal (a que busca as O.S.); o wall inclui as consultas de `occurrence`, `owner` e `assignee`.

| Cenário | Linhas | Wall Prisma | Execução no banco | Plano principal |
|---|---:|---:|---:|---|
| Sem filtro (`list_default`) | 200 | 23,0 ms | 0,57 ms | `Index Scan Backward` em `ServiceOrder_tenantId_createdAt_idx` |
| `status=ABERTA` | 200 | 20,5 ms | 1,01 ms | `Index Scan` em `tenantId_createdAt_idx` + filtro |
| Responsável (`scope=mine`) | 136 | 13,9 ms | 0,45 ms | `Bitmap Heap Scan` |
| Prazo vencido (`overdue`) | 200 | 21,4 ms | 1,52 ms | `Index Scan Backward` em `tenantId_createdAt_idx` |
| Busca `fibra` | 103 | 49,0 ms | **43,11 ms** | `Seq Scan` + `Hash Left Join` com filtro |
| Busca `cliente` | 200 | 33,6 ms | 2,76 ms | `Index Scan Backward` + filtro (para após 200) |
| Busca `20261000` | 97 | **101,2 ms** | **42,44 ms** | `Seq Scan` + `Hash Left Join` com filtro |

Observações:

- A listagem padrão já é atendida pelo índice `(tenantId, createdAt)`. O filtro de status também usa esse índice e aplica o filtro depois; não há índice por status na ordem de `createdAt`.
- Nas buscas seletivas (`fibra`, `20261000`), o planejador varre as 9.902 O.S. do tenant e só depois aplica o `OR` no *join* com `Occurrence`. É por isso que 1% de seletividade ainda custa ~43 ms.
- Em `cliente` (55% de seletividade), o índice de `createdAt` para cedo, ao completar 200 linhas, e a consulta fica rápida.
- O wall de `20261000` (101,2 ms) ficou 2,4× acima do tempo de banco (42,4 ms), por incluir as três consultas de relação e a montagem no Prisma.

### 4.2 Resumo do painel (`summary`)

O `summary` dispara **11 consultas em paralelo**. O lote completo levou **21,1 ms** de wall.

| Consulta | Wall Prisma | Execução no banco | Plano |
|---|---:|---:|---|
| `total` | 10,3 ms | 9,00 ms | `Seq Scan` (9.902 linhas) |
| `active` | 12,9 ms | 7,00 ms | `Bitmap Heap Scan` |
| `closed` | 4,5 ms | 2,57 ms | `Bitmap Heap Scan` |
| `resolvedAwaiting` | 3,6 ms | 1,84 ms | `Bitmap Heap Scan` |
| `overdueActive` | 3,3 ms | 1,87 ms | `Bitmap Heap Scan` |
| `risk2h` | 2,2 ms | 0,73 ms | `Index Scan` em `(tenantId, status, priority, deadlineAt)` |
| `criticalOverdue` | 1,9 ms | 0,35 ms | `Index Scan` em `(tenantId, status, priority, deadlineAt)` |
| `byStatus` | 10,6 ms | 8,44 ms | `Seq Scan` + `HashAggregate` |
| `byPriority` | 9,2 ms | 6,98 ms | `Seq Scan` + `HashAggregate` |
| `byType` | 8,9 ms | 9,20 ms | `Seq Scan` + `HashAggregate` |
| `topAssignees` | 9,8 ms | 7,55 ms | `Seq Scan` + `Sort` + `Limit` |
| `summary_filtered_overdue` (11 consultas) | 10,1 ms | — | misto |

O índice existente `(tenantId, status, priority, deadlineAt)` já resolve bem `risk2h` e `criticalOverdue`. As contagens totais e os quatro `groupBy` fazem varredura completa porque não há índice cobrindo `(tenantId, status)`, `(tenantId, priority)`, `(tenantId, type)` nem `(tenantId, assigneeUserId)`.

### 4.3 Exportação CSV

| Métrica | Valor |
|---|---:|
| Linhas exportadas | 9.902 |
| Wall no Prisma | **817,7 ms** |
| Execução no banco (consulta principal) | **27,7 ms** |
| Montagem do CSV em Node | 52,1 ms |
| Tamanho do CSV | 2.853.807 bytes (2,72 MiB) |
| Consultas SQL | 3 (principal + `owner` + `assignee`) |
| Buffers | 10.215 shared hits |

A consulta usa `Index Scan Backward` em `tenantId_createdAt_idx` e `Incremental Sort`; não há `Seq Scan` nem ordenação cara no banco.

### 4.4 Pendentes do outbox

| Métrica | Valor |
|---|---:|
| Linhas retornadas | 20 |
| Wall no Prisma | 40,7 ms |
| Execução no banco | **37,3 ms** |
| Plano | `Parallel Seq Scan` em 241.350 linhas (64.617 pendentes) |
| Buffers | 8.372 hits + 16.920 reads (~132 MB lidos) |

A consulta ordena por `createdAt, id`, filtra `processedAt IS NULL`, `availableAt <= now` e `claimedAt IS NULL OR claimedAt < now-5min`. Sem índice parcial, ela varre todo o outbox pendente a cada poll.

### 4.5 Fluxos do frontend

| Fluxo | Requisições | Linhas | Wall |
|---|---:|---:|---:|
| “Meu trabalho” (`scope=mine`) | 1 | 136 | 20,0 ms |
| Dashboard modo operação (`scope=operation`) | **50** | 9.902 | **1.344,7 ms** |

O modo operação faz 50 requisições de 200 linhas (≈26,9 ms por requisição) e depois processa tudo no cliente. O tenant A, com 9.902 O.S. vivas, está a 98 linhas do limite de 10.000; ao ultrapassar, `useOperationalOrders` lança `O recorte excedeu 10.000 O.S.` em vez de renderizar o painel.

---

## 5. Consultas acima de 300 ms

Nenhuma consulta SQL isolada ultrapassou 300 ms. As duas ocorrências acima do limite são de fluxo:

### 5.1 Exportação CSV — 817,7 ms

| Etapa | Tempo | Participação |
|---|---:|---:|
| Execução no PostgreSQL | 27,7 ms | 3,4% |
| Montagem do CSV em Node | 52,1 ms | 6,4% |
| Prisma/transporte/materialização de 9.902 linhas | ~737,9 ms | 90,2% |
| **Total** | **817,7 ms** | 100% |

O gargalo não é a consulta: é buscar 9.902 linhas com 45 colunas e materializá-las no Prisma antes de gerar o CSV. Um endpoint de exportação com cursor/stream, ou uma consulta `COPY`/`$queryRaw` paginada, tende a reduzir mais que qualquer índice.

### 5.2 Dashboard modo operação — 1.344,7 ms

| Etapa | Tempo |
|---|---:|
| 50 requisições HTTP de 200 linhas | ~1.344,7 ms |
| Média por requisição | ~26,9 ms |
| Consultas SQL por requisição | 4 (principal + `occurrence` + `owner` + `assignee`) |
| Total aproximado de round-trips | ~200 |

O custo cresce linearmente com o volume do tenant. A correção estrutural é trocar o loop por uma consulta agregada no servidor (ou paginação por cursor para a tabela) e limitar os indicadores a uma janela/período.

### 5.3 Maiores consultas isoladas (referência)

| Consulta | Execução no banco |
|---|---:|
| Busca `fibra` | 43,1 ms |
| Busca `20261000` | 42,4 ms |
| `summary_byType` | 9,2 ms |
| `summary_byStatus` | 8,4 ms |
| `summary_topAssignees` | 7,6 ms |

---

## 6. Índices sugeridos

### 6.1 Migration

Sugestão de migration (não aplicada):

```sql
-- 20261109180000_perf_indexes_volume/migration.sql

-- Listagem por status, mantendo a ordem padrão (createdAt DESC, id ASC).
CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_status_createdAt_id_idx"
  ON "ServiceOrder" ("tenantId", "status", "createdAt" DESC, "id" ASC)
  WHERE "deletedAt" IS NULL;

-- Contagens e agrupamentos do summary.
CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_status_partial_idx"
  ON "ServiceOrder" ("tenantId", "status")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_priority_partial_idx"
  ON "ServiceOrder" ("tenantId", "priority")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_type_partial_idx"
  ON "ServiceOrder" ("tenantId", "type")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_assignee_partial_idx"
  ON "ServiceOrder" ("tenantId", "assigneeUserId")
  WHERE "deletedAt" IS NULL AND "assigneeUserId" IS NOT NULL;

-- Poll de pendentes do outbox: cobre o ORDER BY createdAt, id
-- e evita varrer os eventos já processados.
CREATE INDEX IF NOT EXISTS "ServiceOrderLifecycleEvent_pending_createdAt_id_idx"
  ON "ServiceOrderLifecycleEvent" ("createdAt", "id")
  WHERE "processedAt" IS NULL;
```

Os índices parciais dependem de `deletedAt IS NULL` (e, no caso de `assigneeUserId`, de `assigneeUserId IS NOT NULL`). Se uma consulta futura não incluir essas condições, o índice não será usado.

### 6.2 Ganho medido de cada índice

Comparação pareada: mesma consulta, mesmo banco, mediana de 3 execuções, índice criado e `ANALYZE` antes da segunda medição. `exec` é o tempo dentro do PostgreSQL.

| Índice | Consulta | Antes | Depois | Ganho |
|---|---|---:|---:|---:|
| `ServiceOrder_tenantId_status_createdAt_id_idx` | `list_status_aberta` | 2,1 ms | 1,5 ms | **28,5%** |
| `ServiceOrder_tenantId_status_partial_idx` | `summary_byStatus` | 8,6 ms | 2,4 ms | **72,4%** |
| `ServiceOrder_tenantId_priority_partial_idx` | `summary_byPriority` | 8,6 ms | 2,7 ms | **68,7%** |
| `ServiceOrder_tenantId_type_partial_idx` | `summary_byType` | 8,7 ms | 2,2 ms | **75,2%** |
| `ServiceOrder_tenantId_assignee_partial_idx` | `summary_topAssignees` | 11,4 ms | 2,2 ms | **80,8%** |
| `ServiceOrderLifecycleEvent_pending_createdAt_id_idx` | `outbox_pending` | 42,8 ms | 1,6 ms | **96,2%** |

Detalhe dos tempos de execução no banco:

| Índice | Exec antes | Exec depois |
|---|---:|---:|
| `status_createdAt_id` | 0,943 ms | 0,324 ms |
| `status_partial` | 7,745 ms | 1,116 ms |
| `priority_partial` | 8,287 ms | 1,773 ms |
| `type_partial` | 7,472 ms | 1,171 ms |
| `assignee_partial` | 9,472 ms | 0,924 ms |
| `outbox_pending_createdAt_id` | 41,709 ms | 0,062 ms |

A/B adicional com o **Prisma real** (8 aquecimentos + 9 medições, mediana), para confirmar que os índices são usados com parâmetros vinculados:

| Consulta | Sem índice | Com índice | Ganho no wall |
|---|---:|---:|---:|
| `summary_byStatus` | 5,91 ms | 2,02 ms | **−65,8%** |
| `summary_byPriority` | 5,52 ms | 2,24 ms | **−59,4%** |
| `summary_byType` | 5,95 ms | 1,76 ms | **−70,4%** |
| `summary_topAssignees` | 5,19 ms | 2,23 ms | **−57,0%** |
| `outbox_pending` | 42,93 ms | 2,09 ms | **−95,1%** |
| `list_status_aberta` | 13,69 ms | 17,30 ms | ruído (13–19 ms nos dois lados) |

`pg_stat_user_indexes` confirmou uso efetivo dos seis índices: em 17 execuções de cada consulta, as leituras de tuplas bateram com o volume esperado (ex.: 9.902 × 17 para os `groupBy`; 20 × 17 para o outbox).

O `summary_parallel` completo não caiu na mesma proporção porque as contagens `total` e `active` continuam fazendo varredura completa; o lote é limitado pelas consultas mais lentas.

### 6.3 Índice opcional para prazo

O índice abaixo não entrou na migration principal porque o ganho é menor e há sobreposição com `(tenantId, status, priority, deadlineAt)`:

```sql
CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_status_deadlineAt_idx"
  ON "ServiceOrder" ("tenantId", "status", "deadlineAt")
  WHERE "deletedAt" IS NULL;
```

Medição pareada com `EXPLAIN` (mesma metodologia da seção 6.2):

| Consulta | Antes | Depois | Ganho |
|---|---:|---:|---:|
| `summary_overdueActive` | 3,3 ms | 2,8 ms | 14,0% |
| `summary_filtered_overdue` | 5,2 ms | 2,8 ms | 46,0% |
| `list_deadline_overdue` | 2,6 ms | 2,7 ms | sem ganho (−6,5%) |

Recomendação: só criar se as contagens de vencidos crescerem e passarem a pesar no painel.

### 6.4 Candidatos testados e não recomendados

| Candidato | Resultado | Motivo |
|---|---|---|
| `(tenantId, assigneeUserId, createdAt, id)` e `(tenantId, ownerUserId, createdAt, id)` para “Meu trabalho” | −0,4% e −7,1% | A consulta já resolve 136 linhas em ~1,6 ms; o `OR` entre owner e assignee não usa um índice composto. |
| `(availableAt, createdAt, id) WHERE processedAt IS NULL` no outbox | −3,3% | O `ORDER BY createdAt` faz o índice por `availableAt` não ser escolhido. |
| `(availableAt, createdAt, id) WHERE processedAt IS NULL AND claimedAt IS NULL` | +7,3%, mas plano continuou `Seq Scan` | O `OR` de `claimedAt` impede o uso do índice parcial; o ganho é ruído. |
| GIN trigram em `title`, `description`, `protocol`, `externalProtocol`, `requester` e `Occurrence.provider` | Sem ganho consistente (variação de +15% a −30%) | O planejador **nunca usou** os índices GIN. O `OR` inclui `j0.provider`, então o filtro é aplicado no `Hash Left Join`, não na varredura de `ServiceOrder`. |

### 6.5 Busca textual: por que o trigram não funcionou

O SQL gerado pelo Prisma é:

```sql
... FROM "ServiceOrder"
LEFT JOIN "Occurrence" AS "j0" ON "j0"."id" = "ServiceOrder"."occurrenceId"
WHERE "tenantId" = $1
  AND "deletedAt" IS NULL
  AND (
    "protocol" ILIKE $2 OR "title" ILIKE $3 OR "description" ILIKE $4
    OR "externalProtocol" ILIKE $5 OR "requester" ILIKE $6
    OR ("j0"."provider" ILIKE $7 AND "j0"."id" IS NOT NULL)
  )
ORDER BY "createdAt" DESC, "id" ASC
LIMIT $8 OFFSET $9
```

Como o `OR` mistura colunas de `ServiceOrder` com `j0.provider`, o PostgreSQL aplica o predicado no *join*, depois de varrer `ServiceOrder`. Para usar índice, é preciso separar as origens. Duas alternativas (ambas exigem mudança de código, não só migration):

1. **Subconsulta para o provedor:**
   ```sql
   ... AND (
     protocol ILIKE $2 OR title ILIKE $3 OR description ILIKE $4
     OR "externalProtocol" ILIKE $5 OR requester ILIKE $6
     OR "occurrenceId" IN (
       SELECT id FROM "Occurrence"
       WHERE "tenantId" = $1 AND provider ILIKE $7
     )
   )
   ```
   Com isso, os índices GIN locais podem ser combinados por `BitmapOr`. Ainda é necessário medir: a massa tem apenas 103 linhas com `fibra`, e o ganho depende do termo.

2. **Coluna de busca denormalizada:**
   ```sql
   ALTER TABLE "ServiceOrder" ADD COLUMN "searchText" text
     GENERATED ALWAYS AS (
       coalesce(protocol,'') || ' ' || coalesce(title,'') || ' ' ||
       coalesce(description,'') || ' ' || coalesce("externalProtocol",'') || ' ' ||
       coalesce(requester,'')
     ) STORED;

   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX "ServiceOrder_searchText_trgm_idx"
     ON "ServiceOrder" USING gin ("searchText" gin_trgm_ops);
   ```
   A consulta passaria a usar um único `searchText ILIKE $n`, e o índice GIN seria elegível. A coluna precisa ser mantida em sincronia se `Occurrence.provider` também fizer parte da busca (aí o caminho é uma view/materialized view ou um trigger).

Sem uma dessas mudanças, **não vale a pena criar os índices trigram**: eles ocupam espaço e não são usados.

### 6.6 Como aplicar em produção

- A migration acima usa `IF NOT EXISTS` para permitir aplicação idempotente.
- Em tabelas grandes, `CREATE INDEX` comum bloqueia escritas. O padrão seguro é rodar `CREATE INDEX CONCURRENTLY` fora da transação da migration, antes do deploy, e deixar a migration como no-op (`IF NOT EXISTS`). Prisma Migrate executa cada migration em transação no PostgreSQL, então `CONCURRENTLY` não pode ir dentro do arquivo da migration.
- Nesta massa (20.000 O.S. / 241.350 eventos), a criação dos seis índices levou segundos.
- Rollback:
  ```sql
  DROP INDEX IF EXISTS "ServiceOrder_tenantId_status_createdAt_id_idx";
  DROP INDEX IF EXISTS "ServiceOrder_tenantId_status_partial_idx";
  DROP INDEX IF EXISTS "ServiceOrder_tenantId_priority_partial_idx";
  DROP INDEX IF EXISTS "ServiceOrder_tenantId_type_partial_idx";
  DROP INDEX IF EXISTS "ServiceOrder_tenantId_assignee_partial_idx";
  DROP INDEX IF EXISTS "ServiceOrderLifecycleEvent_pending_createdAt_id_idx";
  ```

---

## 7. Recomendações além dos índices

1. **Exportação:** trocar `findMany` + montagem em memória por cursor/stream ou `COPY`. O banco responde em 27,7 ms; o custo está nos ~738 ms de materialização no Prisma/Node.
2. **Dashboard:** eliminar o loop de 50 × 200. Levar os indicadores para uma consulta agregada no servidor e paginar a tabela por cursor. O limite atual de 10.000 O.S. já é atingido pelo tenant A (9.902) e faz a tela lançar erro.
3. **Resumo:** as 11 consultas em paralelo levam 21,1 ms nesta massa. Em volumes maiores, `total`, `active`, `byStatus`, `byPriority`, `byType` e `topAssignees` passam a dominar; os índices parciais resolvem os quatro `groupBy`, mas `total` e `active` continuam proporcionais ao volume do tenant. Avaliar uma única consulta com `COUNT(*) FILTER (WHERE ...)` ou uma tabela de agregados.
4. **Busca:** reescrever o `OR` antes de indexar (seção 6.5). Enquanto o `j0.provider` estiver no mesmo `OR`, nenhum índice textual será usado.
5. **Outbox:** o índice parcial reduz o poll de ~43 ms para ~2 ms. Se houver mais de um worker, confirmar o uso de `FOR UPDATE SKIP LOCKED` (não alterado nesta análise).

---

## 8. Reprodução

O harness foi executado no servidor, fora do repositório, com o Prisma Client do próprio projeto:

```bash
docker run --name perf-pg -e POSTGRES_PASSWORD=*** \
  -p 127.0.0.1:55432:5432 -d postgres:16

export DATABASE_URL='postgresql://postgres:***@127.0.0.1:55432/ajust_perf?schema=public'
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

# seed sintético e medições (scripts descartáveis em /tmp)
node /tmp/perf-seed.cjs
node /tmp/perf-run.cjs baseline
node /tmp/perf-index.cjs
```

O relatório foi gerado a partir de `/tmp/perf-baseline.json`, `/tmp/perf-indexes.json` e dos A/B em `/tmp/perf-probe-with.txt` e `/tmp/perf-probe-without.txt`. O contêiner `perf-pg` e o banco `ajust_perf` foram removidos ao final; nada foi aplicado no banco `ajust_erp`, nos contêineres `ajust_erp-*` ou no repositório.

---

## 9. Conclusão

Nesta escala (20 mil O.S.), o banco responde bem: nenhuma consulta isolada chega a 300 ms. O que estoura o limite são os fluxos — a exportação materializa 9.902 linhas no Prisma (817,7 ms) e o dashboard operacional faz 50 requisições para montar os indicadores no cliente (1.344,7 ms).

Os índices de maior retorno são os parciais do `summary` e o índice de pendentes do outbox: juntos, derrubam de 69% a 96% o tempo das consultas correspondentes. O índice de status na ordem de `createdAt` ajuda no banco, mas o ganho de wall fica dentro do ruído. A busca textual **não** deve receber índices trigram antes de uma reescrita: o `OR` com `Occurrence.provider` transforma o predicado em filtro de *join* e anula o índice.

Antes de aplicar qualquer coisa em produção, vale reproduzir as medições com uma cópia anonimizada do banco real e com concorrência, porque a distribuição e a seletividade dos termos de busca podem mudar bastante as escolhas do planejador.
