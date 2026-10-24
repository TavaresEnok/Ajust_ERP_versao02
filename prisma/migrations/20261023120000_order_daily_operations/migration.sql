ALTER TABLE "ServiceOrder"
 ADD COLUMN "originalDeadlineAt" TIMESTAMP(3),
 ADD COLUMN "pausedAt" TIMESTAMP(3),
 ADD COLUMN "pauseReason" TEXT,
 ADD COLUMN "scheduledAt" TIMESTAMP(3),
 ADD COLUMN "scheduleStartedAt" TIMESTAMP(3),
 ADD COLUMN "handoffNotes" TEXT;
ALTER TABLE "ServiceCatalogItem" ADD COLUMN "workflowTemplateCode" TEXT;
