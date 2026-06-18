-- Phase 3 AI features: FAQ KB, saved-search alerts, hybrid RAG support

-- Saved search semantic alerts
ALTER TABLE "SavedSearch" ADD COLUMN "queryText" TEXT;
ALTER TABLE "SavedSearch" ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SavedSearchEmbedding" (
  "id"            TEXT NOT NULL,
  "savedSearchId" TEXT NOT NULL,
  "embedding"     vector(768),
  "contentHash"   TEXT NOT NULL,
  "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearchEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedSearchEmbedding_savedSearchId_key" ON "SavedSearchEmbedding"("savedSearchId");

CREATE TABLE "SavedSearchAlert" (
  "id"            TEXT NOT NULL,
  "savedSearchId" TEXT NOT NULL,
  "issueId"       TEXT NOT NULL,
  "score"         DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearchAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedSearchAlert_savedSearchId_issueId_key" ON "SavedSearchAlert"("savedSearchId", "issueId");
CREATE INDEX "SavedSearchAlert_savedSearchId_idx" ON "SavedSearchAlert"("savedSearchId");

ALTER TABLE "SavedSearchEmbedding" ADD CONSTRAINT "SavedSearchEmbedding_savedSearchId_fkey"
  FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_savedSearchId_fkey"
  FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Citizen FAQ knowledge base
CREATE TABLE "FaqEntry" (
  "id"             TEXT NOT NULL,
  "question"       TEXT NOT NULL,
  "answer"         TEXT NOT NULL,
  "category"       TEXT,
  "sourceIssueIds" TEXT[],
  "contentHash"    TEXT NOT NULL,
  "published"      BOOLEAN NOT NULL DEFAULT true,
  "weekKey"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FaqEntry_contentHash_key" ON "FaqEntry"("contentHash");
CREATE INDEX "FaqEntry_published_idx" ON "FaqEntry"("published");
CREATE INDEX "FaqEntry_category_idx" ON "FaqEntry"("category");
CREATE INDEX "FaqEntry_weekKey_idx" ON "FaqEntry"("weekKey");

CREATE TABLE "FaqChunk" (
  "id"         TEXT NOT NULL,
  "faqEntryId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content"    TEXT NOT NULL,
  "embedding"  vector(768),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaqChunk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FaqChunk_faqEntryId_chunkIndex_key" ON "FaqChunk"("faqEntryId", "chunkIndex");
CREATE INDEX "FaqChunk_faqEntryId_idx" ON "FaqChunk"("faqEntryId");
CREATE INDEX "FaqChunk_embedding_idx"
  ON "FaqChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 50);

ALTER TABLE "FaqChunk" ADD CONSTRAINT "FaqChunk_faqEntryId_fkey"
  FOREIGN KEY ("faqEntryId") REFERENCES "FaqEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;