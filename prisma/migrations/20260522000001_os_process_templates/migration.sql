-- CreateTable
CREATE TABLE "OsProcessTemplate" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "enabled"        BOOLEAN NOT NULL DEFAULT true,
    "triggerOsTypes" JSONB NOT NULL,
    "definition"     JSONB NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsProcessTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OsProcessTemplate_tenantId_enabled_idx" ON "OsProcessTemplate"("tenantId", "enabled");

-- AddForeignKey
ALTER TABLE "OsProcessTemplate" ADD CONSTRAINT "OsProcessTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
