import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { auditService } from '../services/audit.service';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';

const router = Router();

// Get all audit logs (admin/auditor only)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await auditService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      userId: req.query.userId as string,
      entity: req.query.entity as string,
      action: req.query.action as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[audit.list]', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect anomalies from recent audit activity
router.get('/anomalies', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (_req: AuthenticatedRequest, res) => {
  try {
    const anomalies = await auditService.detectAnomalies();
    res.json({ success: true, data: anomalies });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[audit.anomalies]', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit trail for a specific entity
router.get('/entity/:entity/:entityId', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await auditService.getByEntity(req.params.entity as string, req.params.entityId as string);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[audit.entity]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
