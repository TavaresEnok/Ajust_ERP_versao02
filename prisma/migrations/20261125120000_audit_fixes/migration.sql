-- Correções da auditoria de 25/11/2026.

-- 1. O snapshot da O.S. no outbox não levava o responsável: regras como "sem analista"
--    (cond_no_analyst) avaliavam O.S. atribuídas como se não tivessem ninguém.
CREATE OR REPLACE FUNCTION order_lifecycle_snapshot(o "ServiceOrder") RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('id', o."id", 'tenantId', o."tenantId", 'protocol', o."protocol",
    'type', o."type", 'priority', o."priority", 'status', o."status", 'title', o."title",
    'requester', o."requester", 'sector', o."sector", 'analystName', o."analystName",
    'assigneeUserId', o."assigneeUserId",
    'deadlineAt', o."deadlineAt", 'occurrenceId', o."occurrenceId",
    'processInstanceId', o."processInstanceId", 'approvalCompleted', o."approvalCompleted",
    'changeRequestId', o."changeRequestId", 'version', o."version");
$$;

-- 2. O monitor de SLA do worker busca retomadas/reaberturas por O.S. a cada minuto.
CREATE INDEX "SlaAuditEvent_orderId_eventType_idx" ON "SlaAuditEvent"("orderId", "eventType");

-- 3. Snapshots de configuração (CMDB): a tabela está no schema.prisma mas nenhuma migration a
--    criava (o banco atual a recebeu por db push). Cria só onde falta, idêntica à existente.
CREATE TABLE IF NOT EXISTS "AssetConfigSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "notes" TEXT,
    "checksum" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetConfigSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssetConfigSnapshot_assetId_createdAt_idx" ON "AssetConfigSnapshot"("assetId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssetConfigSnapshot_tenantId_assetId_idx" ON "AssetConfigSnapshot"("tenantId", "assetId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetConfigSnapshot_tenantId_fkey') THEN
    ALTER TABLE "AssetConfigSnapshot" ADD CONSTRAINT "AssetConfigSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetConfigSnapshot_assetId_fkey') THEN
    ALTER TABLE "AssetConfigSnapshot" ADD CONSTRAINT "AssetConfigSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetConfigSnapshot_createdById_fkey') THEN
    ALTER TABLE "AssetConfigSnapshot" ADD CONSTRAINT "AssetConfigSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Duas gravações simultâneas de snapshot de configuração geravam a mesma versão.
CREATE UNIQUE INDEX "AssetConfigSnapshot_assetId_version_key" ON "AssetConfigSnapshot"("assetId", "version");
