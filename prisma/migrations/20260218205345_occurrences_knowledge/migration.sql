-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('ABERTA', 'EM_EXECUCAO', 'PENDENTE', 'ENCERRADA');

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "analystName" TEXT,
ADD COLUMN     "occurrenceId" TEXT,
ADD COLUMN     "ownerName" TEXT;

-- CreateTable
CREATE TABLE "Occurrence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'ABERTA',
    "sector" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "analystResponsible" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Occurrence_tenantId_provider_createdAt_idx" ON "Occurrence"("tenantId", "provider", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Occurrence_tenantId_status_createdAt_idx" ON "Occurrence"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Occurrence_tenantId_number_key" ON "Occurrence"("tenantId", "number");

-- CreateIndex
CREATE INDEX "KnowledgeCredential_tenantId_provider_createdAt_idx" ON "KnowledgeCredential"("tenantId", "provider", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_occurrenceId_createdAt_idx" ON "ServiceOrder"("tenantId", "occurrenceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCredential" ADD CONSTRAINT "KnowledgeCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCredential" ADD CONSTRAINT "KnowledgeCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
