-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('REUNIAO', 'REUNIAO_ONLINE', 'PLANTAO', 'FERIADO', 'LEMBRETE', 'OUTRO');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL DEFAULT 'OUTRO',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "meetingLink" TEXT,
    "location" TEXT,
    "color" TEXT DEFAULT '#3b82f6',
    "createdById" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_startAt_idx" ON "CalendarEvent"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_assigneeId_startAt_idx" ON "CalendarEvent"("tenantId", "assigneeId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_isGlobal_startAt_idx" ON "CalendarEvent"("tenantId", "isGlobal", "startAt");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "KnowledgeCredential_tenantId_provider_equipmentType_environment" RENAME TO "KnowledgeCredential_tenantId_provider_equipmentType_environ_idx";
