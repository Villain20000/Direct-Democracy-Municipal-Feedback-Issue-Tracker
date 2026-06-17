import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { forumService } from '../services/forum.service';
import { sendDomainError } from '../errors/domain-errors';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await forumService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      activeOnly: req.query.activeOnly !== 'false',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const forum = await forumService.getById(req.params.id as string);
    res.json({ success: true, data: forum });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER', 'WARD_REP'), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
    const forum = await forumService.create({ title, description, creatorId: req.user!.id });
    res.status(201).json({ success: true, data: forum });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[forums.create]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/posts', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Content is required' }); return; }
    const post = await forumService.addPost(req.params.id as string, req.user!.id, content.trim());
    res.status(201).json({ success: true, data: post });
  } catch (error: any) {
    // service throws NotFoundError (404), AlreadyClosedError (409);
    // both mapped via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[forums.addPost]', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/close', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const forum = await forumService.close(req.params.id as string);
    res.json({ success: true, data: forum });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[forums.close]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;