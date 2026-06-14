import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { spatialService } from '../services/spatial.service';

const router = Router();

/**
 * GET /api/v1/spatial/issues/within
 * Query params:
 *   lat (number, required)
 *   lng (number, required)
 *   radius (meters, default 500, max 50000)
 *   statuses (comma-separated, optional — e.g. "SUBMITTED,IN_PROGRESS")
 *   limit (default 200, max 2000)
 *
 * Returns: { data: [{ id, title, distanceMeters }], mode: 'spatial' }
 */
router.get('/issues/within', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 500;
    const limit = parseInt(req.query.limit as string) || 200;
    const statusesRaw = (req.query.statuses as string) || '';
    const statuses = statusesRaw ? statusesRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng query params are required and must be numbers' });
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'lat must be in [-90, 90] and lng in [-180, 180]' });
      return;
    }

    const data = await spatialService.issuesWithinRadius(lat, lng, radius, { statuses, limit });
    res.json({ success: true, data, mode: 'spatial' });
  } catch (err: any) {
    console.error('[spatial.within]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/spatial/issues/in-polygon
 * Body (JSON): { polygon: [[lng, lat], [lng, lat], ...], statuses?: string[], limit?: number }
 *
 * Note: vertices are [lng, lat] (NOT [lat, lng]) because PostGIS
 * uses X-then-Y. The first vertex is repeated as the last by
 * the service (WKT requires it), so callers only need ≥3
 * unique points.
 */
router.post('/issues/in-polygon', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const polygon = req.body?.polygon;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      res.status(400).json({ error: 'polygon must be an array of [lng, lat] pairs with at least 3 vertices' });
      return;
    }
    for (const v of polygon) {
      if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
        res.status(400).json({ error: 'each polygon vertex must be a [lng, lat] number pair' });
        return;
      }
    }
    const data = await spatialService.issuesInPolygon(polygon, {
      statuses: req.body.statuses,
      limit: req.body.limit,
    });
    res.json({ success: true, data, mode: 'spatial' });
  } catch (err: any) {
    console.error('[spatial.in-polygon]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/spatial/issues/nearest
 * Query params:
 *   lat, lng (required)
 *   k (default 5, max 50)
 */
router.get('/issues/nearest', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const k = parseInt(req.query.k as string) || 5;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng query params are required' });
      return;
    }
    const data = await spatialService.nearestIssues(lat, lng, k);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[spatial.nearest]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
