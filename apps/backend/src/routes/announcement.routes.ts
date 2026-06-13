import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { announcementService } from '../services/announcement.service';

const router = Router();

// Public listing (pinned first)
router.get('/', async (req, res) => {
  try {
    const result = await announcementService.getAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single announcement
router.get('/:id', async (req, res) => {
  try {
    const announcement = await announcementService.getById(req.params.id as string);
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create announcement (admin/staff only)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const announcement = await announcementService.create({ ...req.body, authorId: req.user!.id });
    res.status(201).json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update announcement (author or admin)
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await announcementService.getById(req.params.id as string);
    if (existing.authorId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'MAYOR') {
      res.status(403).json({ error: 'Not authorized to update this announcement' });
      return;
    }
    const updated = await announcementService.update(req.params.id as string, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete announcement (author or admin)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await announcementService.getById(req.params.id as string);
    if (existing.authorId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'MAYOR') {
      res.status(403).json({ error: 'Not authorized to delete this announcement' });
      return;
    }
    await announcementService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
