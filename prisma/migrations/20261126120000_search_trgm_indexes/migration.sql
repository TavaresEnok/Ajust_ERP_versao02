-- Busca "contém" (Prisma contains/insensitive = ILIKE) nas O.S., ocorrências e artigos:
-- sem índice, cada busca lê a tabela inteira. GIN de trigramas atende ILIKE %termo%.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "KnowledgeArticle_title_trgm_idx" ON "KnowledgeArticle" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "KnowledgeArticle_content_trgm_idx" ON "KnowledgeArticle" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_number_trgm_idx" ON "Occurrence" USING GIN ("number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_provider_trgm_idx" ON "Occurrence" USING GIN ("provider" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_type_trgm_idx" ON "Occurrence" USING GIN ("type" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_sector_trgm_idx" ON "Occurrence" USING GIN ("sector" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_origin_trgm_idx" ON "Occurrence" USING GIN ("origin" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Occurrence_description_trgm_idx" ON "Occurrence" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_protocol_trgm_idx" ON "ServiceOrder" USING GIN ("protocol" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_externalProtocol_trgm_idx" ON "ServiceOrder" USING GIN ("externalProtocol" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_title_trgm_idx" ON "ServiceOrder" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_description_trgm_idx" ON "ServiceOrder" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_requester_trgm_idx" ON "ServiceOrder" USING GIN ("requester" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ServiceOrder_analystName_trgm_idx" ON "ServiceOrder" USING GIN ("analystName" gin_trgm_ops);

