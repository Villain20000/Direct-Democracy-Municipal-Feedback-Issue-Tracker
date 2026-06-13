import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';

const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await notificationService.getByUser(req.user!.id, {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      unreadOnly: req.query.unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/read-all', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
