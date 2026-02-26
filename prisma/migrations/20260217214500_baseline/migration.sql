-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "ServiceOrderType" AS ENUM ('ROMPIMENTO', 'LENTIDAO', 'CONFIGURACAO_ONU', 'TROCA_SENHA', 'CANCELAMENTO', 'AUDITORIA', 'INSTALACAO', 'BGP');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('ERP', 'SGP', 'WEBHOOK', 'POLLING');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'OS_CREATE', 'OS_UPDATE', 'OS_CLOSE', 'OS_REOPEN', 'OS_CANCEL', 'SLA_CHANGE', 'ROLE_CHANGE', 'CREDENTIAL_ACCESS', 'EXPORT', 'SYNC');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "techContactName" TEXT NOT NULL,
    "techContactEmail" TEXT NOT NULL,
    "techContactPhone" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretEnc" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTenant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "device" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "externalProtocol" TEXT,
    "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP',
    "type" "ServiceOrderType" NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'ABERTA',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "assigneeUserId" TEXT,
    "requester" TEXT,
    "sector" TEXT,
    "origin" TEXT,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderOccurrence" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'ERP',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderAttachment" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderApproval" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceOrderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "serviceOrderType" "ServiceOrderType",
    "hours" INTEGER NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "breachedAt" TIMESTAMP(3),
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "snapshotStatus" "ServiceOrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'IXC',
    "baseUrl" TEXT NOT NULL,
    "webhookSecretEnc" TEXT,
    "apiTokenEnc" TEXT,
    "status" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT,
    "source" "SourceSystem" NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "reportType" TEXT NOT NULL,
    "filters" JSONB,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "authorUserId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticleTag" (
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeArticleTag_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "authorUserId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_taxId_key" ON "Tenant"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserTenant_tenantId_roleId_idx" ON "UserTenant"("tenantId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTenant_userId_tenantId_key" ON "UserTenant"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_status_priority_deadlineAt_idx" ON "ServiceOrder"("tenantId", "status", "priority", "deadlineAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_type_createdAt_idx" ON "ServiceOrder"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_tenantId_protocol_key" ON "ServiceOrder"("tenantId", "protocol");

-- CreateIndex
CREATE INDEX "ServiceOrderOccurrence_serviceOrderId_createdAt_idx" ON "ServiceOrderOccurrence"("serviceOrderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceOrderAttachment_serviceOrderId_uploadedAt_idx" ON "ServiceOrderAttachment"("serviceOrderId", "uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceOrderApproval_serviceOrderId_status_idx" ON "ServiceOrderApproval"("serviceOrderId", "status");

-- CreateIndex
CREATE INDEX "SlaPolicy_tenantId_priority_active_idx" ON "SlaPolicy"("tenantId", "priority", "active");

-- CreateIndex
CREATE INDEX "SlaPolicy_tenantId_serviceOrderType_active_idx" ON "SlaPolicy"("tenantId", "serviceOrderType", "active");

-- CreateIndex
CREATE INDEX "SlaEvent_tenantId_createdAt_idx" ON "SlaEvent"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SlaEvent_serviceOrderId_createdAt_idx" ON "SlaEvent"("serviceOrderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProviderIntegration_tenantId_status_idx" ON "ProviderIntegration"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SyncEvent_tenantId_source_receivedAt_idx" ON "SyncEvent"("tenantId", "source", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "SyncEvent_status_receivedAt_idx" ON "SyncEvent"("status", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportExport_createdAt_idx" ON "ReportExport"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "KnowledgeArticle_tenantId_isPublished_idx" ON "KnowledgeArticle"("tenantId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_tenantId_slug_key" ON "KnowledgeArticle"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_name_key" ON "KnowledgeTag"("name");

-- CreateIndex
CREATE INDEX "Note_tenantId_updatedAt_idx" ON "Note"("tenantId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderOccurrence" ADD CONSTRAINT "ServiceOrderOccurrence_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderOccurrence" ADD CONSTRAINT "ServiceOrderOccurrence_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderAttachment" ADD CONSTRAINT "ServiceOrderAttachment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApproval" ADD CONSTRAINT "ServiceOrderApproval_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApproval" ADD CONSTRAINT "ServiceOrderApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApproval" ADD CONSTRAINT "ServiceOrderApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaEvent" ADD CONSTRAINT "SlaEvent_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIntegration" ADD CONSTRAINT "ProviderIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleTag" ADD CONSTRAINT "KnowledgeArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleTag" ADD CONSTRAINT "KnowledgeArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

