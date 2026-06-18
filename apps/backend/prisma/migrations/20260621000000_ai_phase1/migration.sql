-- Phase 1 AI features: duplicate linking + ward digests

ALTER TABLE "Issue" ADD COLUMN "duplicateOfId" TEXT;

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_duplicateOfId_fkey"
  FOREIGN KEY ("duplicateOfId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Issue_duplicateOfId_idx" ON "Issue"("duplicateOfId");

CREATE TABLE "WardDigest" (
  "id" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "issueCount" INTEGER NOT NULL DEFAULT 0,
  "issueIds" TEXT[],
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'AUTO',
  CONSTRAINT "WardDigest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WardDigest_wardId_dateKey_key" ON "WardDigest"("wardId", "dateKey");
CREATE INDEX "WardDigest_dateKey_idx" ON "WardDigest"("dateKey");

ALTER TABLE "WardDigest" ADD CONSTRAINT "WardDigest_wardId_fkey"
  FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;