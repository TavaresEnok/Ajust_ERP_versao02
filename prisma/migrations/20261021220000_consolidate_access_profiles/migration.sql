BEGIN;

-- Do not silently grant operational access to an unidentified read-only user.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "UserTenant" m JOIN "Role" r ON r.id = m."roleId" WHERE r.code = 'leitura') THEN
    RAISE EXCEPTION 'Review read-only account destinations before consolidating profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM "UserTenant" m JOIN "Role" r ON r.id = m."roleId" WHERE r.code = 'tecnico' AND m."customerId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Customer-linked technician accounts require manual review';
  END IF;
  IF EXISTS (SELECT 1 FROM "Role" WHERE code = 'tecnico') AND NOT EXISTS (SELECT 1 FROM "Role" WHERE code = 'analista') THEN
    RAISE EXCEPTION 'Seed the analyst profile before consolidating technician accounts';
  END IF;
END $$;

CREATE TEMP TABLE migrated_access_profiles ON COMMIT DROP AS
SELECT m.id, m."userId", m."tenantId", m."roleId" AS "previousRoleId"
FROM "UserTenant" m JOIN "Role" r ON r.id = m."roleId" WHERE r.code = 'tecnico';

UPDATE "UserTenant" m
SET "roleId" = (SELECT id FROM "Role" WHERE code = 'analista'), "updatedAt" = NOW()
FROM migrated_access_profiles changed WHERE changed.id = m.id;

INSERT INTO "AuditLog" (id, "tenantId", "actorUserId", action, "resourceType", "resourceId", metadata, "createdAt")
SELECT gen_random_uuid()::text, "tenantId", NULL, 'ROLE_CHANGE', 'access_profile_consolidation', "userId",
jsonb_build_object('from', 'tecnico', 'to', 'analista', 'membershipId', id, 'passwordChanged', false, 'userStatusChanged', false, 'reason', 'Profiles removed at owner request'), NOW()
FROM migrated_access_profiles;

-- Refreshing/reusing an old session must not keep a retired profile alive.
UPDATE "Session" s SET "revokedAt" = NOW()
FROM migrated_access_profiles changed
WHERE s."userId" = changed."userId" AND s."tenantId" = changed."tenantId" AND s."revokedAt" IS NULL;

DELETE FROM "Role" WHERE code IN ('tecnico', 'leitura');
ALTER TABLE "Role" ADD CONSTRAINT "Role_active_code_check"
CHECK (code IN ('super_admin', 'gerente', 'analista', 'cliente'));

COMMIT;
