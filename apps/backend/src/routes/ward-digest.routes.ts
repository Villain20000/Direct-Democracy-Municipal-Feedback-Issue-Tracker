import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { wardDigestService } from '../services/ward-digest.service';
import { sendDomainError } from '../errors/domain-errors';
import { prisma } from '../db/client';

const router = Router();

router.get('/latest', authenticate, authorize('WARD_REP', 'SUPER_ADMIN', 'MAYOR'), async (req: AuthenticatedRequest, res) => {
  try {
    let wardId = req.query.wardId as string | undefined;
    if (req.user!.role === 'WARD_REP') {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { wardId: true },
      });
      wardId = user?.wardId || undefined;
    }
    if (!wardId) {
      res.status(400).json({ error: 'wardId is required' });
      return;
    }
    const row = await wardDigestService.getLatestForWard(wardId);
    res.json({ success: true, data: row });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate', authenticate, authorize('WARD_REP', 'SUPER_ADMIN', 'MAYOR'), async (req: AuthenticatedRequest, res) => {
  try {
    let wardId = req.body?.wardId as string | undefined;
    if (req.user!.role === 'WARD_REP') {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { wardId: true },
      });
      wardId = user?.wardId || undefined;
    }
    if (!wardId) {
      res.status(400).json({ error: 'wardId is required' });
      return;
    }
    const { row, created } = await wardDigestService.generateForWard(wardId, wardDigestService.getTodayKey(), 'MANUAL');
    res.json({ success: true, data: row, created });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;