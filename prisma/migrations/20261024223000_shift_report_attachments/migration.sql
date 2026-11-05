CREATE TABLE "ShiftReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftReportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftReportAttachment_reportId_uploadedAt_idx"
ON "ShiftReportAttachment"("reportId", "uploadedAt" DESC);

ALTER TABLE "ShiftReportAttachment"
ADD CONSTRAINT "ShiftReportAttachment_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "ShiftReport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
