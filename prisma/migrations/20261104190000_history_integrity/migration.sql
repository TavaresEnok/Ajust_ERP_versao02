ALTER TABLE "ChangeRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "ServiceOrder_tenantId_assigneeUserId_status_idx" ON "ServiceOrder"("tenantId", "assigneeUserId", "status");
CREATE INDEX "ServiceOrder_tenantId_ownerUserId_idx" ON "ServiceOrder"("tenantId", "ownerUserId");
CREATE INDEX "Occurrence_tenantId_customerId_status_idx" ON "Occurrence"("tenantId", "customerId", "status");
CREATE INDEX "Note_tenantId_authorUserId_updatedAt_idx" ON "Note"("tenantId", "authorUserId", "updatedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_orderId_fkey", DROP CONSTRAINT "TimeEntry_userId_fkey";
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NetworkTopology" DROP CONSTRAINT "NetworkTopology_customerId_fkey";
ALTER TABLE "NetworkTopology" ADD CONSTRAINT "NetworkTopology_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SatisfactionResponse" DROP CONSTRAINT "SatisfactionResponse_orderId_fkey";
ALTER TABLE "SatisfactionResponse" ADD CONSTRAINT "SatisfactionResponse_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Occurrence" ADD COLUMN "analystResponsibleUserId" TEXT, ADD COLUMN "openedByUserId" TEXT;
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_analystResponsibleUserId_fkey" FOREIGN KEY ("analystResponsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Occurrence_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
