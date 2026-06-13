import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { commentService } from '../services/comment.service';

const router = Router();

// Get comments for an issue
router.get('/:issueId/comments', async (req, res) => {
  try {
    const result = await commentService.getByIssue(req.params.issueId as string, {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create comment on an issue
router.post('/:issueId/comments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const comment = await commentService.create({
      content: req.body.content,
      userId: req.user!.id,
      issueId: req.params.issueId as string,
      parentId: req.body.parentId,
    });
    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete comment
router.delete('/comments/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await commentService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
