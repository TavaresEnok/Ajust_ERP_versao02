CREATE TABLE "NetworkTopology" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "xmlEnc" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT NOT NULL,
  "updatedByName" TEXT NOT NULL,
  "sourceFileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NetworkTopology_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NetworkTopologyRevision" (
  "id" TEXT NOT NULL,
  "topologyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "xmlEnc" TEXT NOT NULL,
  "savedByUserId" TEXT NOT NULL,
  "savedByName" TEXT NOT NULL,
  "sourceFileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NetworkTopologyRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkTopology_customerId_key" ON "NetworkTopology"("customerId");
CREATE INDEX "NetworkTopology_tenantId_updatedAt_idx" ON "NetworkTopology"("tenantId", "updatedAt");
CREATE UNIQUE INDEX "NetworkTopologyRevision_topologyId_version_key" ON "NetworkTopologyRevision"("topologyId", "version");
ALTER TABLE "NetworkTopology" ADD CONSTRAINT "NetworkTopology_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkTopologyRevision" ADD CONSTRAINT "NetworkTopologyRevision_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES "NetworkTopology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
