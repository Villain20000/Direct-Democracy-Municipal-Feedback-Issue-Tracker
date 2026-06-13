import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { resolutionService } from '../services/resolution.service';

const router = Router();

// Public listing
router.get('/', async (req, res) => {
  try {
    const result = await resolutionService.getAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      status: req.query.status as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single resolution
router.get('/:id', async (req, res) => {
  try {
    const resolution = await resolutionService.getById(req.params.id as string);
    res.json({ success: true, data: resolution });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create resolution (council/admin/mayor)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const resolution = await resolutionService.create({ ...req.body, proposedById: req.user!.id });
    res.status(201).json({ success: true, data: resolution });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update status (admin/mayor)
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN', 'MAYOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const resolution = await resolutionService.updateStatus(req.params.id as string, req.body.status);
    res.json({ success: true, data: resolution });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Vote on resolution (council members)
router.post('/:id/vote', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { voteFor } = req.body;
    if (typeof voteFor !== 'boolean') { res.status(400).json({ error: 'voteFor boolean is required' }); return; }
    const resolution = await resolutionService.vote(req.params.id as string, req.user!.id, voteFor);
    res.json({ success: true, data: resolution });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete resolution (admin only)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    await resolutionService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
