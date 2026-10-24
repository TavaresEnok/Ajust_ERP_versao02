BEGIN;
DROP INDEX "ServiceProcessInstance_tenantId_occurrenceId_key";
ALTER TABLE "Occurrence" ADD COLUMN "customerId" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "parentOrderId" TEXT, ADD COLUMN "rootOrderId" TEXT;
ALTER TABLE "ServiceProcessInstance" ADD COLUMN "engineVersion" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "rootOrderId" TEXT;
ALTER TABLE "ServiceProcessTemplate" ADD COLUMN "draft" JSONB, ADD COLUMN "publishedAt" TIMESTAMP(3);
CREATE TABLE "ServiceProcessStep" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "instanceId" TEXT NOT NULL, "nodeId" TEXT NOT NULL,
 "attempt" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "orderId" TEXT, "outcome" TEXT,
 "evidence" JSONB NOT NULL DEFAULT '{}', "actorId" TEXT, "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "dueAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3)
);
CREATE TABLE "ServiceProcessOrderLink" (
 "id" TEXT PRIMARY KEY, "instanceId" TEXT NOT NULL, "orderKey" TEXT NOT NULL, "orderId" TEXT NOT NULL
);
CREATE TABLE "ServiceProcessEvent" (
 "id" TEXT PRIMARY KEY, "instanceId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventKey" TEXT NOT NULL,
 "type" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "claimedAt" TIMESTAMP(3)
);
CREATE INDEX "ServiceProcessStep_tenantId_instanceId_status_idx" ON "ServiceProcessStep"("tenantId", "instanceId", "status");
CREATE UNIQUE INDEX "ServiceProcessStep_instanceId_nodeId_attempt_key" ON "ServiceProcessStep"("instanceId", "nodeId", "attempt");
CREATE UNIQUE INDEX "ServiceProcessOrderLink_instanceId_orderKey_key" ON "ServiceProcessOrderLink"("instanceId", "orderKey");
CREATE UNIQUE INDEX "ServiceProcessEvent_eventKey_key" ON "ServiceProcessEvent"("eventKey");
CREATE INDEX "ServiceProcessEvent_status_createdAt_idx" ON "ServiceProcessEvent"("status", "createdAt");
CREATE INDEX "ServiceProcessInstance_tenantId_occurrenceId_idx" ON "ServiceProcessInstance"("tenantId", "occurrenceId");
CREATE UNIQUE INDEX "ServiceProcessInstance_tenantId_rootOrderId_key" ON "ServiceProcessInstance"("tenantId", "rootOrderId");
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_rootOrderId_fkey" FOREIGN KEY ("rootOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceProcessStep" ADD CONSTRAINT "ServiceProcessStep_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ServiceProcessInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceProcessStep" ADD CONSTRAINT "ServiceProcessStep_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceProcessOrderLink" ADD CONSTRAINT "ServiceProcessOrderLink_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ServiceProcessInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceProcessOrderLink" ADD CONSTRAINT "ServiceProcessOrderLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceProcessEvent" ADD CONSTRAINT "ServiceProcessEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ServiceProcessInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
