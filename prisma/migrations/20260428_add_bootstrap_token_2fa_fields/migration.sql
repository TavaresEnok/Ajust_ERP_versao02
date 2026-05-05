-- AlterTable
ALTER TABLE "User" ADD COLUMN "bootstrapTokenHash" TEXT,
ADD COLUMN "bootstrapTokenExpiresAt" TIMESTAMP(3);
