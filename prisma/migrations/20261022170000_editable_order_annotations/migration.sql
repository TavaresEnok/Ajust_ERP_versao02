ALTER TABLE "ServiceOrderOccurrence" ADD COLUMN "editable" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "editedAt" TIMESTAMP(3),
 ADD COLUMN "mirroredAnnotationId" TEXT REFERENCES "OccurrenceAnnotation"("id") ON DELETE SET NULL;
