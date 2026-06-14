-- =====================================================
-- IssueEmbedding — per-issue vector embedding for semantic
-- duplicate detection and "smart search" via pgvector.
--
-- Embedding model: nomic-embed-text via local Ollama
-- Vector dimension: 768
-- =====================================================

-- The vector extension was already created in
-- 20260615000000_pgvector_rag, but the IF NOT EXISTS is idempotent
-- and cheap, so we keep it here for environments that apply this
-- migration in isolation.
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto provides gen_random_uuid() which the worker / backfill
-- script use in raw INSERTs. Postgres 13+ also ships it in core, but
-- we enable the extension explicitly so this migration is portable
-- across older deployments that may not have it on by default.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "IssueEmbedding" (
    "id"          TEXT NOT NULL,
    "issueId"     TEXT NOT NULL,
    "embedding"   vector(768),
    "contentHash" TEXT NOT NULL,
    "model"       TEXT NOT NULL DEFAULT 'nomic-embed-text',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IssueEmbedding_issueId_key" ON "IssueEmbedding"("issueId");
CREATE INDEX "IssueEmbedding_issueId_idx" ON "IssueEmbedding"("issueId");

-- Approximate-NN index. For pilot scale (5k issues) lists=100 is fine;
-- rule of thumb is rows/1000. Rebuild with `lists=rows/1000` if the
-- table grows past ~10k rows.
CREATE INDEX "IssueEmbedding_embedding_idx"
    ON "IssueEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Cascade on issue delete so a removed issue cleans up its embedding.
ALTER TABLE "IssueEmbedding" ADD CONSTRAINT "IssueEmbedding_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
