import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { userService } from '../services/user.service';

const router = Router();

router.get('/', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await userService.getAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      role: req.query.role as string,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', authenticate, authorize('SUPER_ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const stats = await userService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await userService.getById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await userService.update(req.params.id as string, req.body);
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
