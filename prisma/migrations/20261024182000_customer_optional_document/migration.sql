-- Imported provider documentation can identify a commercial name before its
-- legal registration is confirmed. NULL preserves that absence without fake IDs.
ALTER TABLE "Customer" ALTER COLUMN "taxId" DROP NOT NULL;
