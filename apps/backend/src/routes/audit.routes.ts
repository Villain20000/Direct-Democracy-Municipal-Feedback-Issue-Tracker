import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { auditService } from '../services/audit.service';

const router = Router();

// Get all audit logs (admin/auditor only)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await auditService.getAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      userId: req.query.userId as string,
      entity: req.query.entity as string,
      action: req.query.action as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit trail for a specific entity
router.get('/entity/:entity/:entityId', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await auditService.getByEntity(req.params.entity as string, req.params.entityId as string);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
