ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROSTER_UPDATE';

CREATE TABLE "TeamRosterPolicy" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "effectiveFrom" TEXT NOT NULL,
  "dayUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "nightUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamRosterPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamRosterPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamRosterPolicy_tenantId_effectiveFrom_key" ON "TeamRosterPolicy"("tenantId", "effectiveFrom");

CREATE TABLE "TeamRosterDay" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "userIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "holidayName" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamRosterDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamRosterDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamRosterDay_tenantId_date_key" ON "TeamRosterDay"("tenantId", "date");
