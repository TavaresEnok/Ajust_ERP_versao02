-- CreateTable
CREATE TABLE "OccurrenceAnnotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccurrenceAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OccurrenceAnnotation_tenantId_occurrenceId_createdAt_idx" ON "OccurrenceAnnotation"("tenantId", "occurrenceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OccurrenceAnnotation" ADD CONSTRAINT "OccurrenceAnnotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceAnnotation" ADD CONSTRAINT "OccurrenceAnnotation_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceAnnotation" ADD CONSTRAINT "OccurrenceAnnotation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
