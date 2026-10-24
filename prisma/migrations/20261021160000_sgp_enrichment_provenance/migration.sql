BEGIN;
ALTER TABLE "KnowledgeCredential" ADD COLUMN "sourceNoteEnc" TEXT, ADD COLUMN "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP', ADD COLUMN "externalId" TEXT, ADD COLUMN "sourceMetadata" JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "KnowledgeCredential_tenantId_sourceSystem_externalId_key" ON "KnowledgeCredential"("tenantId","sourceSystem","externalId");
ALTER TABLE "ServiceCatalogItem" ALTER COLUMN "estimatedMinutes" DROP NOT NULL;
CREATE TABLE "ExternalImportLink" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "kind" TEXT NOT NULL, "externalKey" TEXT NOT NULL,
 "localId" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ExternalImportLink_tenantId_kind_externalKey_key" ON "ExternalImportLink"("tenantId","kind","externalKey");
CREATE INDEX "ExternalImportLink_tenantId_kind_localId_idx" ON "ExternalImportLink"("tenantId","kind","localId");
COMMIT;
