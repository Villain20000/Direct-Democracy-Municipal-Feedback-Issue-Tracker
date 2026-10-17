-- ============================================================
-- P1-11: seed demo ward boundary polygons (GeoJSON in Ward.boundary)
-- ============================================================
--
-- Backfills a demo polygon for each seeded ward code (WD-01..WD-06)
-- so the issues-map ward overlay, ward drill-down, and the admin
-- polygon editor have something to render on existing databases.
-- Fresh databases get the same polygons from `db/seed.ts`.
--
-- The UPDATEs are idempotent-ish: rows whose boundary is already
-- set (e.g. drawn by an admin) are left untouched, so re-running
-- the statements is safe. Wards with other codes are unaffected.
--
-- Coordinates are [lng, lat] rectangles around the demo-issue
-- cluster (New York City, SRID 4326 — same frame as Issue lat/lng).

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-01"},"geometry":{"type":"Polygon","coordinates":[[[-74.012,40.709],[-74.002,40.709],[-74.002,40.718],[-74.012,40.718],[-74.012,40.709]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-01' AND "boundary" IS NULL;

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-02"},"geometry":{"type":"Polygon","coordinates":[[[-74.008,40.711],[-73.998,40.711],[-73.998,40.719],[-74.008,40.719],[-74.008,40.711]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-02' AND "boundary" IS NULL;

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-03"},"geometry":{"type":"Polygon","coordinates":[[[-73.998,40.708],[-73.99,40.708],[-73.99,40.716],[-73.998,40.716],[-73.998,40.708]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-03' AND "boundary" IS NULL;

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-04"},"geometry":{"type":"Polygon","coordinates":[[[-74.006,40.716],[-73.996,40.716],[-73.996,40.724],[-74.006,40.724],[-74.006,40.716]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-04' AND "boundary" IS NULL;

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-05"},"geometry":{"type":"Polygon","coordinates":[[[-74.018,40.714],[-74.008,40.714],[-74.008,40.722],[-74.018,40.722],[-74.018,40.714]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-05' AND "boundary" IS NULL;

UPDATE "Ward" SET "boundary" = '{"type":"Feature","properties":{"code":"WD-06"},"geometry":{"type":"Polygon","coordinates":[[[-74.022,40.706],[-74.012,40.706],[-74.012,40.724],[-74.022,40.724],[-74.022,40.706]]]}}'::jsonb, "updatedAt" = NOW() WHERE "code" = 'WD-06' AND "boundary" IS NULL;
