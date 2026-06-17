import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { userService } from '../services/user.service';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';

const router = Router();

router.get('/', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await userService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      role: req.query.role as string,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.list]', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', authenticate, authorize('SUPER_ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const stats = await userService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.stats]', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await userService.getById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (error: any) {
    // userService.getById now throws NotFoundError → 404 (matches
    // the existing tests' expectation that GET /users/:missingId
    // returns 404).
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.getById]', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await userService.update(req.params.id as string, req.body);
    res.json({ success: true, data: user });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.update]', error);
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, wardId, departmentId } = req.body;
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'email, password, firstName, and lastName are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    const user = await userService.create({ email, password, firstName, lastName, phone, role, wardId, departmentId });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// Change own password (any authenticated user)
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' });
      return;
    }
    await userService.changeOwnPassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    // Wrong current password is a 401 (auth failure) via
    // InvalidCredentialsError; new password too short is a 400 via
    // BadRequestError. Both are mapped by sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[users.changePassword]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
