ALTER TABLE "KnowledgeCredential"
  ADD COLUMN "equipmentType" TEXT NOT NULL DEFAULT 'OUTROS',
  ADD COLUMN "equipmentName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "KnowledgeCredential_tenantId_provider_equipmentType_environment_idx"
  ON "KnowledgeCredential"("tenantId", "provider", "equipmentType", "environment");
