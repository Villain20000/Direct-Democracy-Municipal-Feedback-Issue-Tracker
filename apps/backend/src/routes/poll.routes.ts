import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { pollService } from '../services/poll.service';
import { sendDomainError } from '../errors/domain-errors';

const router = Router();

// Public listing
router.get('/', async (req, res) => {
  try {
    const result = await pollService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      activeOnly: req.query.activeOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single poll
router.get('/:id', async (req, res) => {
  try {
    const poll = await pollService.getById(req.params.id as string);
    res.json({ success: true, data: poll });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create poll (admin/council/mayor)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const poll = await pollService.create({ ...req.body, creatorId: req.user!.id });
    res.status(201).json({ success: true, data: poll });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[polls.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// Vote on poll
router.post('/:id/vote', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { optionId } = req.body;
    if (!optionId) { res.status(400).json({ error: 'Option ID is required' }); return; }
    const poll = await pollService.vote(req.params.id as string, req.user!.id, optionId);
    res.json({ success: true, data: poll });
  } catch (error: any) {
    // service throws AlreadyClosedError (409), AlreadyVotedError (409),
    // BadRequestError (400), NotFoundError (404); all mapped via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[polls.vote]', error);
    res.status(500).json({ error: error.message });
  }
});

// Close poll (creator or admin)
router.patch('/:id/close', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const poll = await pollService.close(req.params.id as string);
    res.json({ success: true, data: poll });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[polls.close]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete poll (admin only)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    await pollService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[polls.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
