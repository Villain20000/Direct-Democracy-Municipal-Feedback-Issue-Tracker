import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';

const router = Router();

// Get all conversations
router.get('/conversations', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await messageService.getConversations(req.user!.id);
    res.json({ success: true, data: conversations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with a user
router.get('/conversations/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await messageService.getConversation(req.user!.id, req.params.userId as string, {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    });
    // Mark conversation as read
    await messageService.markConversationRead(req.user!.id, req.params.userId as string);
    res.json({ success: true, ...result });
  } catch (error: any) {
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
    res.status(400).json({ error: error.message });
  }
});

// Mark message as read
router.patch('/:id/read', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await messageService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await messageService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
