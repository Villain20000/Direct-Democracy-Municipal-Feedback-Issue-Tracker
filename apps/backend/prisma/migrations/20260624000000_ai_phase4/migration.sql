-- Phase 4 AI features: bilingual issue content storage

ALTER TABLE "Issue" ADD COLUMN "contentLocale" TEXT;
ALTER TABLE "Issue" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Issue" ADD COLUMN "titleEl" TEXT;
ALTER TABLE "Issue" ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "Issue" ADD COLUMN "descriptionEl" TEXT;