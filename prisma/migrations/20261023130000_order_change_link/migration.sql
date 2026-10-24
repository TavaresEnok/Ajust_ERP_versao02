ALTER TABLE "ServiceOrder" ADD COLUMN "changeRequestId" TEXT;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
