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

router.post('/duplicates', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, candidates } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    if (!Array.isArray(candidates)) { res.status(400).json({ error: 'Candidates array is required' }); return; }
    const result = await aiService.detectDuplicates(text, candidates);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/resolve', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, category } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.suggestResolution(text, category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/describe', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, category } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
    const result = await aiService.generateDescription(title, category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/tags', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.extractTags(text);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/resolution-time', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, category } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.predictResolutionTime(text, category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/department', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, category } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.suggestDepartment(text, category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/translate', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, language } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.translate(text, language || 'English');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/search', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, issues } = req.body;
    if (!query) { res.status(400).json({ error: 'Query is required' }); return; }
    if (!Array.isArray(issues)) { res.status(400).json({ error: 'Issues array is required' }); return; }
    const result = await aiService.smartSearch(query, issues);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

export default router;
