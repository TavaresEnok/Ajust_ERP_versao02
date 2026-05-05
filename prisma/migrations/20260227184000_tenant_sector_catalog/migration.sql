-- Tenant-level sector catalog used by manager settings and analyst O.S forms.
CREATE TABLE "TenantSector" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantSector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSector_tenantId_name_key" ON "TenantSector"("tenantId", "name");
CREATE INDEX "TenantSector_tenantId_idx" ON "TenantSector"("tenantId");

ALTER TABLE "TenantSector"
ADD CONSTRAINT "TenantSector_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TenantSector" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t."id" || s."name") AS "id",
  t."id" AS "tenantId",
  s."name" AS "name",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('SAC'),
    ('SUPORTE Tecnico'),
    ('NOC'),
    ('CGR'),
    ('SOC'),
    ('INFRAESTRUTURA')
) AS s("name")
WHERE t."deletedAt" IS NULL
ON CONFLICT ("tenantId", "name") DO NOTHING;
