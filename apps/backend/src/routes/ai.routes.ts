import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { aiService } from '../ai/ollama.service';

const router = Router();

router.post('/categorize', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.categorize(text);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/priority', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, category } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.prioritize(text, category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/sentiment', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.sentiment(text);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/summary', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, maxLength } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.summarize(text, maxLength);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/trends', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { issues } = req.body;
    if (!issues || !Array.isArray(issues)) { res.status(400).json({ error: 'Issues array is required' }); return; }
    const result = await aiService.detectTrends(issues);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/chat', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'Messages array is required' }); return; }
    const result = await aiService.chat(messages);
    res.json({ success: true, data: { response: result } });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

export default router;
