-- Phase 2 AI features: forum moderation flags + seasonal forecasts

ALTER TABLE "ForumPost" ADD COLUMN "moderationFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ForumPost" ADD COLUMN "moderationSeverity" TEXT;
ALTER TABLE "ForumPost" ADD COLUMN "moderationReason" TEXT;

CREATE TABLE "SeasonalForecast" (
  "id" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "stats" JSONB NOT NULL,
  "narrative" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'AUTO',
  CONSTRAINT "SeasonalForecast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonalForecast_monthKey_key" ON "SeasonalForecast"("monthKey");