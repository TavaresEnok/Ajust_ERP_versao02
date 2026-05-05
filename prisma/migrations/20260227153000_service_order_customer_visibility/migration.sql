-- Add customer visibility controls for service orders and notes.
ALTER TABLE "ServiceOrder"
ADD COLUMN "isCustomerVisible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ServiceOrderOccurrence"
ADD COLUMN "isCustomerVisible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OccurrenceAnnotation"
ADD COLUMN "isCustomerVisible" BOOLEAN NOT NULL DEFAULT true;
