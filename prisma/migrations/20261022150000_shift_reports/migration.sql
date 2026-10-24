CREATE TABLE "ShiftReport" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
 "authorUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "authorName" TEXT NOT NULL, "shift" TEXT NOT NULL CHECK ("shift" IN ('DAY','NIGHT')),
 "referenceDate" TEXT NOT NULL, "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL,
 "content" TEXT NOT NULL, "orderIds" JSONB NOT NULL DEFAULT '[]', "publishedAt" TIMESTAMP(3),
 "version" INTEGER NOT NULL DEFAULT 1, "revisions" JSONB NOT NULL DEFAULT '[]',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ("endAt" > "startAt")
);
CREATE INDEX "ShiftReport_tenantId_referenceDate_shift_idx" ON "ShiftReport"("tenantId","referenceDate","shift");
CREATE INDEX "ShiftReport_tenantId_authorUserId_idx" ON "ShiftReport"("tenantId","authorUserId");
