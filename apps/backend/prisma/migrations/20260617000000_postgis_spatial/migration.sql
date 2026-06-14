-- ============================================================
-- PostGIS extension + spatial index on Issue
-- ============================================================
--
-- This migration enables the PostGIS extension and adds a
-- `location_geom GEOMETRY(Point, 4326)` column to the Issue
-- table, backed by a GIST index. After this migration runs, the
-- `apps/backend/src/services/spatial.service.ts` module can run
-- ST_DWithin / ST_Contains queries instead of in-memory
-- ray-casting or naive bounding-box scans.
--
-- SRID 4326 = WGS 84 (the lat/lng coordinate system we already
-- store in the `latitude` / `longitude` columns). Points are
-- stored in (longitude, latitude) order because that's what
-- PostGIS expects — easy to get wrong.

-- 1. Enable PostGIS. The image built from `docker/postgres.Dockerfile`
--    has the postgresql-16-postgis-3 package installed; this
--    statement just makes the SQL-level extension available.
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add the geometry column. Nullable because legacy issues may
--    not have lat/lng. Prisma can\'t model this column directly
--    (no native GEOMETRY support) so we use raw SQL — the matching
--    Prisma field is `Unsupported("geometry(Point, 4326)")?`.
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "location_geom" GEOMETRY(Point, 4326);

-- 3. Backfill from the existing lat/lng columns. Note the
--    (longitude, latitude) argument order — PostGIS uses
--    X-then-Y (lon-then-lat) for ST_MakePoint, not lat-then-lng.
--    This is the most common PostGIS footgun in the project, so
--    the comment is here permanently.
UPDATE "Issue"
SET "location_geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND "location_geom" IS NULL;

-- 4. GIST index for sub-millisecond ST_DWithin / ST_Contains
--    queries. Without it, every spatial query is a full table
--    scan even when filtered to a 500m radius.
CREATE INDEX IF NOT EXISTS "Issue_location_geom_gist"
  ON "Issue" USING GIST ("location_geom");

-- 5. (informational, not enforced) A separate index for status-
--    filtered spatial queries. Most production queries will
--    combine `status IN (...)` with a spatial predicate, so a
--    composite index helps when the result set is small relative
--    to the table. Left as a single-column GIST for now since
--    Postgres doesn\'t natively support multi-column GIST
--    efficiently; a BRIN on `updatedAt` would be the natural
--    complement if the table grows past ~1M rows.

-- 6. Sanity check: count of issues with location_geom set should
--    match the count of issues with non-null lat/lng. Will fail
--    loudly if the backfill missed rows.
DO $$
DECLARE
  geom_count BIGINT;
  latlng_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO geom_count FROM "Issue" WHERE "location_geom" IS NOT NULL;
  SELECT COUNT(*) INTO latlng_count FROM "Issue" WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
  IF geom_count <> latlng_count THEN
    RAISE EXCEPTION 'PostGIS backfill mismatch: % geometry rows vs % lat/lng rows', geom_count, latlng_count;
  END IF;
  RAISE NOTICE 'PostGIS backfill OK: % geo-located issues', geom_count;
END $$;
