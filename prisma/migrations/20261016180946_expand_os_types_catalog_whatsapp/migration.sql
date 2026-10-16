-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceOrderType" ADD VALUE 'DNS';
ALTER TYPE "ServiceOrderType" ADD VALUE 'PROXMOX';
ALTER TYPE "ServiceOrderType" ADD VALUE 'FIREWALL';
ALTER TYPE "ServiceOrderType" ADD VALUE 'ROTEAMENTO_CGNAT';
ALTER TYPE "ServiceOrderType" ADD VALUE 'INFRAESTRUTURA';
ALTER TYPE "ServiceOrderType" ADD VALUE 'CONSULTORIA_GERAL';
ALTER TYPE "ServiceOrderType" ADD VALUE 'OUTRO';

-- AlterTable
ALTER TABLE "ArchivedAuditLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceOrderType" NOT NULL DEFAULT 'AUDITORIA',
    "description" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 120,
    "defaultPriority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_tenantId_active_idx" ON "ServiceCatalogItem"("tenantId", "active");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_tenantId_category_idx" ON "ServiceCatalogItem"("tenantId", "category");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_requester_idx" ON "ServiceOrder"("tenantId", "requester");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_resolvedAt_idx" ON "ServiceOrder"("tenantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_closedAt_idx" ON "ServiceOrder"("tenantId", "closedAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_createdAt_idx" ON "ServiceOrder"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceCatalogItem" ADD CONSTRAINT "ServiceCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
