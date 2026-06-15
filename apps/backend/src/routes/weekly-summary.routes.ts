/**
 * Phase C — Weekly summary routes.
 *
 *   POST   /api/v1/weekly-summaries             generate (or refresh) for current week
 *   POST   /api/v1/weekly-summaries/backfill    generate for a specific past week
 *   GET    /api/v1/weekly-summaries             paginated list (newest first)
 *   GET    /api/v1/weekly-summaries/latest      most recent row
 *   GET    /api/v1/weekly-summaries/:weekKey    fetch by ISO week
 *   DELETE /api/v1/weekly-summaries/:weekKey    admin-only, used to allow re-gen
 *
 * The manual POST is open to MAYOR + DEPT_HEAD + ADMIN so the mayor
 * dashboard's "Regenerate" button works without the cron tick.
 */
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { generateWeeklySummarySchema } from '../validators/weekly-summary.validators';
import { weeklySummaryService } from '../services/weekly-summary.service';

const router = Router();

// Manual trigger (current week). Open to roles that can see the dashboard.
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'),
  validate(generateWeeklySummarySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { weekKey, force } = (req.body || {}) as { weekKey?: string; force?: boolean };
      const target = weekKey || weeklySummaryService.getCurrentWeekKey();
      const result = await weeklySummaryService.generate(target, { force, source: 'MANUAL' });
      res.status(result.created ? 201 : 200).json({ success: true, data: result.row, created: result.created });
    } catch (error: any) {
      console.error('[weekly-summaries.generate]', error);
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

// List all summaries, paginated.
router.get('/', authenticate, async (_req: AuthenticatedRequest, res) => {
  try {
    const data = await weeklySummaryService.list();
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Latest row (used by the mayor dashboard's "This week" widget).
router.get('/latest', authenticate, async (_req: AuthenticatedRequest, res) => {
  try {
    const row = await weeklySummaryService.getLatest();
    res.json({ success: true, data: row });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lookup by ISO week key.
router.get('/:weekKey', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const row = await weeklySummaryService.getByWeekKey(req.params.weekKey as string);
    if (!row) {
      res.status(404).json({ error: 'Weekly summary not found' });
      return;
    }
    res.json({ success: true, data: row });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete (admin only) — used by the regenerate flow if a row is corrupt.
router.delete(
  '/:weekKey',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await weeklySummaryService.delete(req.params.weekKey as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
