/**
 * Phase D2 — Transparency Portal routes.
 *
 * Public, no-auth endpoints under `/api/v1/portal/*`. Everything exposed
 * here is safe to share with the world: aggregate counts, public
 * (isPublic=true) issues, published announcements, OPEN/PASSED
 * referendums, public events / meetings, and department / ward metadata.
 *
 *   GET /api/v1/portal/stats           top-line numbers + per-status + per-category + per-department
 *   GET /api/v1/portal/issues          paginated public issues
 *   GET /api/v1/portal/issues/recent   last N public issues (default 10)
 *   GET /api/v1/portal/issues/top      most upvoted public issues (default 10)
 *   GET /api/v1/portal/departments     all departments with budget + issue counts
 *   GET /api/v1/portal/wards           all wards with public issue counts
 *   GET /api/v1/portal/announcements   published announcements
 *   GET /api/v1/portal/meetings        past public meetings (event log)
 *   GET /api/v1/portal/events/upcoming upcoming public events
 *   GET /api/v1/portal/referendums     active referendums (tallies visible)
 *   GET /api/v1/portal/resolutions     recent resolutions
 */
import { Router } from 'express';
import { portalService } from '../services/portal.service';
import { faqService } from '../services/faq.service';

const router = Router();

// Stats (the dashboard widget calls this on initial render)
router.get('/stats', async (_req, res) => {
  try {
    const data = await portalService.getStats();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Paginated public issues
router.get('/issues', async (req, res) => {
  try {
    const data = await portalService.listPublicIssues({
      page: parseInt(req.query.page as string) || 1,
      pageSize: Math.min(parseInt(req.query.pageSize as string) || 20, 100),
      category: req.query.category as string,
      status: req.query.status as string,
    });
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recent public issues
router.get('/issues/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const data = await portalService.getRecentPublicIssues(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Top-voted public issues
router.get('/issues/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const data = await portalService.getTopIssues(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Departments with budgets + open issue counts
router.get('/departments', async (_req, res) => {
  try {
    const data = await portalService.getDepartmentBreakdown();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Wards with public issue counts
router.get('/wards', async (_req, res) => {
  try {
    const data = await portalService.getWardsWithCounts();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Published announcements
router.get('/announcements', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const data = await portalService.getAnnouncements(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Past public meetings (the "meeting minutes" surface)
router.get('/meetings', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const data = await portalService.getRecentMeetings(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upcoming public events
router.get('/events/upcoming', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const data = await portalService.getUpcomingEvents(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Active referendums (tallies visible; user identities NOT exposed)
router.get('/referendums', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const data = await portalService.getActiveReferendums(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Citizen FAQ knowledge base (auto-generated from resolved issues)
router.get('/faq', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const data = await faqService.listPublished(limit);
    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recent resolutions
router.get('/resolutions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const data = await portalService.getRecentResolutions(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
