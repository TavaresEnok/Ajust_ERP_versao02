-- CreateTable "BootstrapOtp"
CREATE TABLE "BootstrapOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "validatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BootstrapOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BootstrapOtp_userId_expiresAt_idx" ON "BootstrapOtp"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "BootstrapOtp_userId_validatedAt_idx" ON "BootstrapOtp"("userId", "validatedAt");

-- AddForeignKey
ALTER TABLE "BootstrapOtp" ADD CONSTRAINT "BootstrapOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
