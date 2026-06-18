import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { seasonalForecastService } from '../services/seasonal-forecast.service';
import { sendDomainError } from '../errors/domain-errors';

const router = Router();

router.get('/latest', authenticate, authorize('MAYOR', 'SUPER_ADMIN', 'DEPARTMENT_HEAD'), async (_req: AuthenticatedRequest, res) => {
  try {
    const row = await seasonalForecastService.getLatest();
    res.json({ success: true, data: row });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate', authenticate, authorize('MAYOR', 'SUPER_ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const { row, created } = await seasonalForecastService.generate(
      seasonalForecastService.getCurrentMonthKey(),
      'MANUAL',
    );
    res.json({ success: true, data: row, created });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;