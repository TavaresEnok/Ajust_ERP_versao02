ALTER TABLE "Occurrence" ADD COLUMN "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP',
ADD COLUMN "externalId" TEXT, ADD COLUMN "sourceMetadata" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "closedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Occurrence_tenantId_sourceSystem_externalId_key" ON "Occurrence"("tenantId", "sourceSystem", "externalId");
ALTER TABLE "ServiceOrder" ADD COLUMN "sourceMetadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "processInstanceId" TEXT, ADD COLUMN "processNodeId" TEXT, ADD COLUMN "slaEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ServiceOrderOccurrence" ADD COLUMN "externalId" TEXT, ADD COLUMN "sourceAuthorName" TEXT;
CREATE UNIQUE INDEX "ServiceOrderOccurrence_serviceOrderId_sourceSystem_externalId_key" ON "ServiceOrderOccurrence"("serviceOrderId", "sourceSystem", "externalId");
CREATE TABLE "ServiceProcessInstance" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "occurrenceId" TEXT NOT NULL,
 "templateCode" TEXT NOT NULL, "templateVersion" INTEGER NOT NULL,
 "definition" JSONB NOT NULL, "state" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3),
 CONSTRAINT "ServiceProcessInstance_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceProcessInstance_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceProcessInstance_tenantId_occurrenceId_key" ON "ServiceProcessInstance"("tenantId", "occurrenceId");
CREATE INDEX "ServiceProcessInstance_tenantId_status_createdAt_idx" ON "ServiceProcessInstance"("tenantId", "status", "createdAt");
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_processInstanceId_fkey" FOREIGN KEY ("processInstanceId") REFERENCES "ServiceProcessInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ServiceProcessTemplate" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "code" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "definition" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ServiceProcessTemplate_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceProcessTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceProcessTemplate_tenantId_code_key" ON "ServiceProcessTemplate"("tenantId", "code");
