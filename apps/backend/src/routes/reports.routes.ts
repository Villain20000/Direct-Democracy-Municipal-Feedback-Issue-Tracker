import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { reportsService } from '../services/reports.service';

const router = Router();

router.get('/issues.csv', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD', 'MEDIA', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const csv = await reportsService.exportIssuesCsv({
      status: req.query.status as string,
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="issues-export.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit.csv', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const csv = await reportsService.exportAuditCsv({
      userId: req.query.userId as string,
      entity: req.query.entity as string,
      action: req.query.action as string,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;