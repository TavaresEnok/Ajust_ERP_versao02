ALTER TABLE "User" ADD COLUMN "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP',
ADD COLUMN "externalId" TEXT,
ADD COLUMN "sourceMetadata" JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "User_sourceSystem_externalId_key" ON "User"("sourceSystem", "externalId");

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT NOT NULL,
  "taxId" TEXT NOT NULL,
  "personType" TEXT NOT NULL,
  "address" JSONB NOT NULL DEFAULT '{}',
  "contacts" JSONB NOT NULL DEFAULT '{}',
  "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP',
  "externalId" TEXT,
  "sourceMetadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Customer_tenantId_taxId_key" ON "Customer"("tenantId", "taxId");
CREATE UNIQUE INDEX "Customer_tenantId_sourceSystem_externalId_key" ON "Customer"("tenantId", "sourceSystem", "externalId");
CREATE INDEX "Customer_tenantId_tradeName_idx" ON "Customer"("tenantId", "tradeName");
