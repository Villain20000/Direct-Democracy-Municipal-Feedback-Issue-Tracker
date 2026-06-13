import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { issueService } from '../services/issue.service';

const router = Router();

// Public listing (with optional auth for vote status)
router.get('/', async (req, res) => {
  try {
    const result = await issueService.getAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      status: req.query.status as string,
      category: req.query.category as string,
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
      reporterId: req.query.reporterId as string,
      assigneeId: req.query.assigneeId as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await issueService.getStats({
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
    });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single issue
router.get('/:id', async (req, res) => {
  try {
    const issue = await issueService.getById(req.params.id as string);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create issue (authenticated)
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const issue = await issueService.create({
      ...req.body,
      reporterId: req.user!.id,
    });
    res.status(201).json({ success: true, data: issue });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update status (staff+ only)
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, note } = req.body;
    const issue = await issueService.updateStatus(req.params.id as string, status, req.user!.id, note);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Assign issue (admin/dept head only)
router.patch('/:id/assign', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'), async (req: AuthenticatedRequest, res) => {
  try {
    const { assigneeId, departmentId } = req.body;
    const issue = await issueService.assign(req.params.id as string, assigneeId, departmentId);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Upvote issue
router.post('/:id/upvote', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await issueService.upvote(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
