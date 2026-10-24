-- A provider is a customer of Ajust, never a separate tenant.
ALTER TABLE "UserTenant" ADD COLUMN "customerId" TEXT;
CREATE INDEX "UserTenant_tenantId_customerId_idx" ON "UserTenant"("tenantId", "customerId");
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
