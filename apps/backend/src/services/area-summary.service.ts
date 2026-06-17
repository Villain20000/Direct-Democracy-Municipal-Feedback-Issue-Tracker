import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';
import { spatialService } from './spatial.service';
import { BadRequestError } from '../errors/domain-errors';

/**
 * Input vertex order. We accept [lat, lng] (the convention the
 * Leaflet-draw polygon event uses on the frontend) and convert to
 * [lng, lat] for PostGIS internally — the spatial service expects
 * X-then-Y. The conversion happens in a single `.map()` so the rest
 * of the pipeline is uniform.
 */
type LatLngInput = [number, number];

export interface AreaSummary {
  count: number;
  issues: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    department: string | null;
  }>;
  summary: string;
  fallback?: boolean;
  /**
   * `'postgis'` when the spatial index served the filter, or
   * `'memory-fallback'` when PostGIS was unavailable and we fell
   * back to a JS scan. Surfaced to the UI so it can show a
   * "degraded performance" banner in dev.
   */
  mode: 'postgis' | 'memory-fallback';
}

export const areaSummaryService = {
  /**
   * Filter all geo-located issues by polygon containment (PostGIS)
   * and produce an AI-generated summary. Designed to be called from
   * the map page after the user closes a polygon.
   *
   * Replaces the previous in-memory ray-casting implementation.
   * Performance: for 50k issues, the old code scanned all rows in
   * JS; the new code is bounded by the GIST index + an O(log n)
   * `ST_Contains` lookup, so it's roughly the same regardless of
   * table size.
   */
  async summarize(polygonLatLng: LatLngInput[]): Promise<AreaSummary> {
    if (!Array.isArray(polygonLatLng) || polygonLatLng.length < 3) {
      throw new BadRequestError('Polygon must have at least 3 vertices');
    }
    for (const v of polygonLatLng) {
      if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
        throw new BadRequestError('Each polygon vertex must be a [lat, lng] pair');
      }
    }

    // Frontend sends [lat, lng] (Leaflet convention); PostGIS wants
    // [lng, lat] (X-then-Y). Flip the pair order in one pass.
    const polygonLngLat: Array<[number, number]> = polygonLatLng.map(([lat, lng]) => [lng, lat]);

    // The spatial service returns a row per issue with the bare
    // minimum columns. We still need the department and category for
    // the summary, so we follow up with a single batched lookup by
    // ID. (Could be a JOIN, but a second `findMany` with an IN-list
    // is more readable and the IDs are already in memory.)
    let matched: Array<{ id: string; title: string; status: string }>;
    let mode: AreaSummary['mode'] = 'postgis';
    try {
      matched = await spatialService.issuesInPolygon(polygonLngLat, { limit: 2000 });
    } catch (err) {
      // If PostGIS is unavailable (extension not installed, or
      // dev env hasn't run the migration), fall back to a JS
      // bounding-box scan. The result is the same as the old
      // ray-cast but cheaper to compute since we pre-filter by
      // bounding box.
      console.warn('[area-summary] PostGIS unavailable, falling back to JS:', err);
      mode = 'memory-fallback';
      matched = await memoryBoundingBoxFallback(polygonLatLng);
    }

    if (matched.length === 0) {
      return {
        count: 0,
        issues: [],
        summary: 'No citizen issues were reported inside the selected area.',
        mode,
      };
    }

    // Hydrate the rows we need for the AI prompt.
    const hydrated = await prisma.issue.findMany({
      where: { id: { in: matched.map((m) => m.id) } },
      include: { department: { select: { name: true } } },
    });

    // Group by category for a quick "themes" line in the summary input.
    const byCategory: Record<string, number> = {};
    for (const i of hydrated) byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c, n]) => `${c}:${n}`)
      .join(', ');

    const issueText = hydrated
      .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title} — ${i.description.slice(0, 180)}`)
      .join('\n');

    const prompt = `Summarize the following ${hydrated.length} citizen issue(s) reported inside a geographic area the user just selected on the map.
Top categories: ${topCategories}.
List the main themes, any urgency signals, and a one-line action suggestion for the municipality.

Issues:
${issueText}`;

    try {
      const result = await aiService.summarize(prompt, 250);
      return {
        count: hydrated.length,
        issues: hydrated.slice(0, 50).map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          status: i.status,
          department: i.department?.name ?? null,
        })),
        summary: result.summary,
        fallback: result.fallback,
        mode,
      };
    } catch (err) {
      // Never block the response because of an AI failure.
      return {
        count: hydrated.length,
        issues: hydrated.slice(0, 50).map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          status: i.status,
          department: i.department?.name ?? null,
        })),
        summary: `Found ${hydrated.length} issue(s) in the area. Top categories: ${topCategories}.`,
        fallback: true,
        mode,
      };
    }
  },
};

/**
 * Fallback when PostGIS isn't available (typically: dev env with a
 * bare `pgvector/pgvector` image and no PostGIS extension, or a CI
 * matrix that didn't run the spatial migration). Pre-filters by the
 * polygon's bounding box in SQL, then ray-casts in JS. Much faster
 * than scanning every geo-located issue in JS, and a defensible
 * degradation path.
 */
async function memoryBoundingBoxFallback(polygon: LatLngInput[]): Promise<Array<{ id: string; title: string; status: string }>> {
  const lats = polygon.map((p) => p[0]);
  const lngs = polygon.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const candidates = await prisma.issue.findMany({
    where: {
      latitude: { not: null, gte: minLat, lte: maxLat },
      longitude: { not: null, gte: minLng, lte: maxLng },
    },
    select: { id: true, title: true, status: true, latitude: true, longitude: true },
  });

  return candidates
    .filter((i) => i.latitude != null && i.longitude != null && pointInPolygon(Number(i.latitude), Number(i.longitude), polygon))
    .map(({ id, title, status }) => ({ id, title, status }));
}

function pointInPolygon(lat: number, lng: number, polygon: LatLngInput[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

