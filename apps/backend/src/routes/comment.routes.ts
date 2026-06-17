import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { commentService } from '../services/comment.service';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';


const router = Router();

// Get comments for an issue
router.get('/issues/:issueId/comments', async (req, res) => {
  try {
    const result = await commentService.getByIssue(req.params.issueId as string, {
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 50 }),
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create comment on an issue
router.post('/issues/:issueId/comments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const comment = await commentService.create({
      content: req.body.content,
      userId: req.user!.id,
      issueId: req.params.issueId as string,
      parentId: req.body.parentId,
    });
    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    // service throws NotFoundError if the issue doesn't exist;
    // mapped to 404 via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[comments.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/comments/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await commentService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    // service throws NotFoundError (404) and ForbiddenError (403) when
    // the caller is not the comment author; both mapped via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[comments.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
