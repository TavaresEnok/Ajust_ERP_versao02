-- Índices medidos em volume sintético (docs/analises/desempenho-volume.md, 20 mil O.S.).
-- Parciais: os filtros do sistema sempre incluem "deletedAt" IS NULL.

-- Listagem por status na ordem padrão (createdAt DESC, id ASC); também atende contagem por status.
CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_status_createdAt_id_idx"
  ON "ServiceOrder" ("tenantId", "status", "createdAt" DESC, "id" ASC)
  WHERE "deletedAt" IS NULL;

-- Agrupamentos do resumo do painel.
CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_priority_partial_idx"
  ON "ServiceOrder" ("tenantId", "priority")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_type_partial_idx"
  ON "ServiceOrder" ("tenantId", "type")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ServiceOrder_tenantId_assignee_partial_idx"
  ON "ServiceOrder" ("tenantId", "assigneeUserId")
  WHERE "deletedAt" IS NULL AND "assigneeUserId" IS NOT NULL;

-- Busca de pendentes do outbox (ORDER BY createdAt, id) sem varrer os já processados: -96% medido.
CREATE INDEX IF NOT EXISTS "ServiceOrderLifecycleEvent_pending_createdAt_id_idx"
  ON "ServiceOrderLifecycleEvent" ("createdAt", "id")
  WHERE "processedAt" IS NULL;
