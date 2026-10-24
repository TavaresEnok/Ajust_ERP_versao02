-- Match Prisma's identifier shortening to PostgreSQL's 63-byte limit.
ALTER INDEX "ServiceOrderOccurrence_serviceOrderId_sourceSystem_externalId_k"
RENAME TO "ServiceOrderOccurrence_serviceOrderId_sourceSystem_external_key";
