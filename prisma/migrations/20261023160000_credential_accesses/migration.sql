ALTER TABLE "KnowledgeCredential" ADD COLUMN "parentCredentialId" TEXT,
 ADD COLUMN "accessMethod" TEXT NOT NULL DEFAULT 'OUTROS';
CREATE INDEX "KnowledgeCredential_parentCredentialId_idx" ON "KnowledgeCredential"("parentCredentialId");
ALTER TABLE "KnowledgeCredential" ADD CONSTRAINT "KnowledgeCredential_parentCredentialId_fkey" FOREIGN KEY ("parentCredentialId") REFERENCES "KnowledgeCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
