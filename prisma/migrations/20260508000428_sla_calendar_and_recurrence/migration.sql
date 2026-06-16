-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "changeRequestId" TEXT,
ADD COLUMN     "occurrenceId" TEXT,
ADD COLUMN     "parentEventId" TEXT,
ADD COLUMN     "recurrenceEnd" TIMESTAMP(3),
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "serviceOrderId" TEXT;

-- CreateTable
CREATE TABLE "BusinessCalendar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "isWorkDay" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BusinessCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCalendarException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isWorkDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,

    CONSTRAINT "BusinessCalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCalendar_tenantId_dayOfWeek_key" ON "BusinessCalendar"("tenantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCalendarException_tenantId_date_key" ON "BusinessCalendarException"("tenantId", "date");

-- CreateIndex
CREATE INDEX "SlaAuditEvent_tenantId_orderId_idx" ON "SlaAuditEvent"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "SlaAuditEvent_tenantId_createdAt_idx" ON "SlaAuditEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessCalendar" ADD CONSTRAINT "BusinessCalendar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCalendarException" ADD CONSTRAINT "BusinessCalendarException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaAuditEvent" ADD CONSTRAINT "SlaAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaAuditEvent" ADD CONSTRAINT "SlaAuditEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
