import { prisma } from '../db/client';

/**
 * PostGIS-backed spatial queries for issues.
 *
 * The corresponding `Issue.location_geom` column is a
 * `GEOMETRY(Point, 4326)` (WGS 84 / lat-lng) populated by the
 * `20260617000000_postgis_spatial` migration. Queries use
 * parameterized `$queryRaw` so Prisma doesn't need a native
 * PostGIS type mapping.
 *
 * The radius query (`issuesWithinRadius`) is the most common
 * shape — used by the "find issues near me" feature on the map
 * page. The polygon query (`issuesInPolygon`) is the
 * PostGIS-accelerated version of the in-memory ray-cast that
 * `areaSummaryService.summarize()` used to do. The nearest-neighbors
 * query is used for "show me the 5 closest open issues" widgets.
 */
export const spatialService = {
  /**
   * Return all issues within `radiusMeters` of (lat, lng), ordered
   * by distance. The `ST_DWithin` predicate uses the geography
   * cast so the radius is in meters, not degrees (4326 + degrees
   * is the wrong unit for almost every real-world query).
   *
   * @param lat latitude (WGS 84)
   * @param lng longitude (WGS 84)
   * @param radiusMeters max distance in meters (e.g. 500)
   * @param opts.statuses optional status filter (e.g. only OPEN)
   * @param opts.limit row cap (default 200, hard ceiling 2000)
   */
  async issuesWithinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    opts: { statuses?: string[]; limit?: number } = {},
  ): Promise<Array<{ id: string; title: string; distanceMeters: number }>> {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('lat and lng must be numbers');
    }
    if (typeof radiusMeters !== 'number' || radiusMeters <= 0 || radiusMeters > 50_000) {
      throw new Error('radiusMeters must be > 0 and <= 50000');
    }
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);

    // Two-branch implementation: with or without the optional
    // status IN-filter. The IN-list is parameterized via Prisma's
    // `ANY(${array}::text[])` so we never interpolate user input
    // into the SQL text.
    if (opts.statuses && opts.statuses.length > 0) {
      return prisma.$queryRaw<Array<{ id: string; title: string; distanceMeters: number }>>`
        SELECT i."id", i."title",
          ST_Distance(
            i."location_geom"::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          ) AS "distanceMeters"
        FROM "Issue" i
        WHERE i."location_geom" IS NOT NULL
          AND ST_DWithin(
            i."location_geom"::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
          AND i."status"::text = ANY(${opts.statuses}::text[])
        ORDER BY i."location_geom" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        LIMIT ${limit}
      `;
    }

    return prisma.$queryRaw<Array<{ id: string; title: string; distanceMeters: number }>>`
      SELECT i."id", i."title",
        ST_Distance(
          i."location_geom"::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS "distanceMeters"
      FROM "Issue" i
      WHERE i."location_geom" IS NOT NULL
        AND ST_DWithin(
          i."location_geom"::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY i."location_geom" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      LIMIT ${limit}
    `;
  },

  /**
   * Return all issues whose location is inside a closed polygon,
   * ordered by creation time. The polygon is a flat list of
   * `[lng, lat]` pairs (NOT `[lat, lng]` — PostGIS uses
   * X-then-Y, i.e. longitude first). Minimum 3 vertices.
   *
   * This replaces the in-memory ray-casting in
   * `areaSummaryService.summarize()` — it's a single
   * `ST_Contains` query that uses the GIST index instead of
   * scanning every geo-located issue in JS.
   */
  async issuesInPolygon(
    polygon: Array<[number, number]>,
    opts: { statuses?: string[]; limit?: number } = {},
  ): Promise<Array<{ id: string; title: string; status: string; latitude: number; longitude: number }>> {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      throw new Error('polygon must have at least 3 vertices');
    }
    for (const v of polygon) {
      if (!Array.isArray(v) || v.length !== 2) {
        throw new Error('Each polygon vertex must be a [lng, lat] pair');
      }
    }
    const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 5000);

    // Build the WKT polygon: "POLYGON((lng1 lat1, lng2 lat2, ..., lng1 lat1))".
    // The closing vertex duplicates the first — required by WKT.
    const wktCoords = polygon
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(', ');
    const wkt = `POLYGON((${wktCoords}, ${polygon[0][0]} ${polygon[0][1]}))`;

    if (opts.statuses && opts.statuses.length > 0) {
      return prisma.$queryRaw<Array<{ id: string; title: string; status: string; latitude: number; longitude: number }>>`
        SELECT i."id", i."title", i."status"::text AS status,
          ST_Y(i."location_geom") AS latitude,
          ST_X(i."location_geom") AS longitude
        FROM "Issue" i
        WHERE i."location_geom" IS NOT NULL
          AND ST_Contains(
            ST_GeomFromText(${wkt}, 4326),
            i."location_geom"
          )
          AND i."status"::text = ANY(${opts.statuses}::text[])
        ORDER BY i."createdAt" DESC
        LIMIT ${limit}
      `;
    }

    return prisma.$queryRaw<Array<{ id: string; title: string; status: string; latitude: number; longitude: number }>>`
      SELECT i."id", i."title", i."status"::text AS status,
        ST_Y(i."location_geom") AS latitude,
        ST_X(i."location_geom") AS longitude
      FROM "Issue" i
      WHERE i."location_geom" IS NOT NULL
        AND ST_Contains(
          ST_GeomFromText(${wkt}, 4326),
          i."location_geom"
        )
      ORDER BY i."createdAt" DESC
      LIMIT ${limit}
    `;
  },

  /**
   * K-nearest-neighbor search. `ST_Distance` with ORDER BY + LIMIT
   * is the canonical "find closest" pattern in PostGIS; the GIST
   * index is used for the initial bounding-box filter via
   * `ST_DWithin(... , k * 1.5)` to bound the candidate set, then
   * we order by exact distance.
   *
   * @param k how many neighbors to return
   */
  async nearestIssues(
    lat: number,
    lng: number,
    k: number = 5,
  ): Promise<Array<{ id: string; title: string; distanceMeters: number }>> {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('lat and lng must be numbers');
    }
    const n = Math.min(Math.max(k, 1), 50);
    return prisma.$queryRaw<Array<{ id: string; title: string; distanceMeters: number }>>`
      SELECT i."id", i."title",
        ST_Distance(
          i."location_geom"::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS "distanceMeters"
      FROM "Issue" i
      WHERE i."location_geom" IS NOT NULL
      ORDER BY i."location_geom" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      LIMIT ${n}
    `;
  },

  /**
   * Update `location_geom` to track the current lat/lng. Called
   * from the issue service on create and on every update that
   * changes latitude/longitude. Cheap: a single GIST-compatible
   * UPDATE that the planner can do in-place.
   */
  async syncGeomFromLatLng(issueId: string, latitude: number | null, longitude: number | null): Promise<void> {
    if (latitude == null || longitude == null) {
      await prisma.$executeRaw`
        UPDATE "Issue"
        SET "location_geom" = NULL
        WHERE "id" = ${issueId}
      `;
      return;
    }
    await prisma.$executeRaw`
      UPDATE "Issue"
      SET "location_geom" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
      WHERE "id" = ${issueId}
    `;
  },
};
