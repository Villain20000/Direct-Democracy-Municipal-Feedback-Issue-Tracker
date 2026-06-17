import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';

const router = Router();

// Get all conversations
router.get('/conversations', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await messageService.getConversations(req.user!.id);
    res.json({ success: true, data: conversations });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[messages.conversations]', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with a user
router.get('/conversations/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await messageService.getConversation(req.user!.id, req.params.userId as string, {
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 50 }),
    });
    // Mark conversation as read
    await messageService.markConversationRead(req.user!.id, req.params.userId as string);
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[messages.conversation]', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) { res.status(400).json({ error: 'receiverId and content are required' }); return; }
    const message = await messageService.send({ senderId: req.user!.id, receiverId, content });
    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[messages.send]', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
router.patch('/:id/read', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await messageService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[messages.markRead]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await messageService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    // The service throws NotFoundError (404) for unknown ids and
    // ForbiddenError (403) when you try to delete a message that
    // isn't yours. Both are mapped by sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[messages.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
