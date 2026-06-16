CREATE UNIQUE INDEX "ServiceOrder_tenantId_externalProtocol_key"
ON "ServiceOrder"("tenantId", "externalProtocol");
