-- =====================================================
-- pgvector + RAG (municipal legislation search) + Weekly summary
-- =====================================================
--
-- Embedding model: nomic-embed-text via local Ollama
-- Vector dimension: 768
--
-- All vector columns are managed via raw SQL because Prisma does not
-- (yet) understand pgvector. The `Unsupported("vector(768)")` declaration
-- in schema.prisma mirrors what we create here.

CREATE EXTENSION IF NOT EXISTS vector;

-- Document (legislation / decision / regulation)
CREATE TABLE "Document" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "source"       TEXT NOT NULL,
    "description"  TEXT,
    "documentDate" TEXT,
    "contentHash"  TEXT NOT NULL,
    "charCount"    INTEGER NOT NULL DEFAULT 0,
    "chunkCount"   INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_contentHash_key" ON "Document"("contentHash");
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- DocumentChunk: each row is one text slice with its embedding
CREATE TABLE "DocumentChunk" (
    "id"         TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content"    TEXT NOT NULL,
    "embedding"  vector(768),
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key"
    ON "DocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- Approximate-NN index. `lists` is the recommended starting point; rule of
-- thumb: rows/1000. For pilot-scale (500-5k) we use 100.
CREATE INDEX "DocumentChunk_embedding_idx"
    ON "DocumentChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Weekly executive summary (Friday cron)
CREATE TABLE "WeeklySummary" (
    "id"          TEXT NOT NULL,
    "weekKey"     TEXT NOT NULL,
    "weekStart"   TIMESTAMP(3) NOT NULL,
    "weekEnd"     TIMESTAMP(3) NOT NULL,
    "stats"       JSONB NOT NULL,
    "highlights"  JSONB NOT NULL,
    "body"        TEXT NOT NULL,
    "issueIds"    TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source"      TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklySummary_weekKey_key" ON "WeeklySummary"("weekKey");
CREATE INDEX "WeeklySummary_weekStart_idx" ON "WeeklySummary"("weekStart");

-- Foreign keys
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
