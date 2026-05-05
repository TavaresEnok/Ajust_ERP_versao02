-- Add optional sector classification for tenant memberships (NOC/SOC/INFRA/ATENDIMENTO).
ALTER TABLE "UserTenant"
ADD COLUMN "sector" TEXT;
