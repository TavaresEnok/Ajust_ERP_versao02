-- Audit Log Archiving Strategy
-- Records older than 90 days are moved from AuditLog to ArchivedAuditLog.
-- ArchivedAuditLog is a separate table without foreign key constraints,
-- allowing user/tenant deletion without cascading issues on historical data.

CREATE TABLE IF NOT EXISTS "ArchivedAuditLog" (
    "id"           TEXT         NOT NULL,
    "tenantId"     TEXT,
    "actorUserId"  TEXT,
    "action"       TEXT         NOT NULL,
    "resourceType" TEXT         NOT NULL,
    "resourceId"   TEXT,
    "metadata"     JSONB,
    "ip"           TEXT,
    "userAgent"    TEXT,
    "createdAt"    TIMESTAMPTZ  NOT NULL,
    "archivedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "ArchivedAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for querying archived data
CREATE INDEX IF NOT EXISTS "ArchivedAuditLog_tenantId_createdAt_idx"
    ON "ArchivedAuditLog" ("tenantId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ArchivedAuditLog_archivedAt_idx"
    ON "ArchivedAuditLog" ("archivedAt" DESC);
