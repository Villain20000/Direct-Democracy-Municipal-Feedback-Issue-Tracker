-- ============================================================
-- Repair: restore spatial support after the locationGeom rename
-- ============================================================
--
-- Migration 20260620000000_remove_user_department_unique (a
-- `prisma migrate dev` drift-fix) renamed `Issue.location_geom`
-- to `Issue.locationGeom`, but in doing so it:
--   1. dropped `Issue_location_geom_gist` and never recreated it,
--   2. discarded the geometry backfill (the column was dropped
--      and re-added empty — "All the data in the column will be
--      lost"), so every existing row had NULL geometry,
--   3. left `spatial.service.ts` raw SQL targeting the old
--      `location_geom` name (fixed in source alongside this
--      migration), which made every /spatial/* endpoint fail
--      with SQL error 42703.
--
-- This migration restores the GIST index and re-runs the backfill
-- so ST_DWithin / ST_Contains use the index and see all rows.

-- 1. GIST index for radius / polygon / k-NN queries (postgis_spatial
--    step 4, recreated against the renamed column).
CREATE INDEX IF NOT EXISTS "Issue_locationGeom_gist"
  ON "Issue" USING GIST ("locationGeom");

-- 2. Backfill from lat/lng (X-then-Y: longitude first — PostGIS
--    uses lon-lat order, not lat-lon).
UPDATE "Issue"
SET "locationGeom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND "locationGeom" IS NULL;
