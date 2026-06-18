import { Router } from 'express';
import multer from 'multer';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { aiService } from '../ai/ollama.service';
import { ragService, type HybridCitation } from '../services/rag.service';
import { relatedImpactService } from '../services/related-impact.service';
import { aiHealthService } from '../services/ai-health.service';
import { slaTrackingService } from '../services/sla-tracking.service';
import { prisma } from '../db/client';
import { sendDomainError } from '../errors/domain-errors';
import ollama from 'ollama';
import { config } from '../config';

const router = Router();

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function toApiCitations(citations: HybridCitation[]) {
  return citations.map((c) => ({
    sourceType: c.sourceType,
    documentId: c.sourceType === 'legislation' ? c.id : c.id,
    issueId: c.sourceType === 'issue' ? c.id : undefined,
    faqId: c.sourceType === 'faq' ? c.id : undefined,
    id: c.id,
    title: c.title,
    type: c.subtype,
    source: c.sourceType,
    documentDate: c.documentDate ?? null,
    chunkIndex: c.chunkIndex,
    score: c.score,
    chunk: c.chunk,
  }));
}

async function buildHybridChatContext(messages: any[]) {
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
  const q = (lastUser?.content || '').toString().trim();
  if (q.length < 10) return { citations: [] as HybridCitation[], augmentedMessages: messages };

  try {
    const citations = await ragService.retrieveHybrid(q, { legislationK: 3, issuesK: 2, faqK: 2, minScore: 0.25 });
    if (citations.length === 0) return { citations, augmentedMessages: messages };
    const systemAugment = {
      role: 'system',
      content: ragService.buildHybridSystemPrompt(citations),
    };
    return { citations, augmentedMessages: [systemAugment, ...messages] };
  } catch (err: any) {
    console.warn('[ai.chat] Hybrid RAG retrieval failed:', err.message);
    return { citations: [] as HybridCitation[], augmentedMessages: messages };
  }
}

router.get('/health', async (_req, res) => {
  try {
    const data = await aiHealthService.check();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/categorize', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, locale } = req.body;
    if (!text) { res.status(400).json({ error: 'Text is required' }); return; }
    const result = await aiService.categorize(text, locale);
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
    const { messages, useRag } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'Messages array is required' }); return; }

    // RAG-augmented chat: if the latest user message looks like a question
    // about municipal rules, ordinances, or decisions, pull the top-5
    // most similar chunks from the document store and inject them into
    // the system prompt with explicit "cite the document title" instructions.
    let citations: HybridCitation[] = [];
    let augmentedMessages = messages;
    if (useRag !== false) {
      const hybrid = await buildHybridChatContext(messages);
      citations = hybrid.citations;
      augmentedMessages = hybrid.augmentedMessages;
    }

    // Direct call to ollama so we can swap the system prompt per request.
    const response = await ollama.chat({
      model: config.ollama.model,
      messages: augmentedMessages,
      stream: false,
    });
    res.json({
      success: true,
      data: {
        answer: response.message.content,
        citations: toApiCitations(citations),
        ragUsed: citations.length > 0,
      },
    });
  } catch (error: any) {
    console.error('[ai.chat]', error.message);
    // Fallback: legacy keyword chat.
    try {
      const result = await aiService.chat(req.body.messages);
      res.json({ success: true, data: { answer: result, citations: [], ragUsed: false, fallback: true } });
    } catch {
      res.status(503).json({ error: error.message });
    }
  }
});

router.post('/chat/stream', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { messages, useRag } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'Messages array is required' }); return; }

    let citations: HybridCitation[] = [];
    let augmentedMessages = messages;
    if (useRag !== false) {
      const hybrid = await buildHybridChatContext(messages);
      citations = hybrid.citations;
      augmentedMessages = hybrid.augmentedMessages;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send metadata/citations first
    res.write(`data: ${JSON.stringify({ type: 'meta', citations: toApiCitations(citations), ragUsed: citations.length > 0 })}\n\n`);

    try {
      const responseStream = await ollama.chat({
        model: config.ollama.model,
        messages: augmentedMessages,
        stream: true,
      });

      for await (const chunk of responseStream) {
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.message.content })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (ollamaErr: any) {
      console.error('[ai.chat.stream] Ollama stream failed, falling back to legacy:', ollamaErr.message);
      try {
        const result = await aiService.chat(messages);
        res.write(`data: ${JSON.stringify({ type: 'content', content: result })}\n\n`);
      } catch (e: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    console.error('[ai.chat.stream] root error:', error.message);
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

router.post('/draft-status-update', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, oldStatus, newStatus, note, locale } = req.body;
    if (!title || !oldStatus || !newStatus) {
      res.status(400).json({ error: 'title, oldStatus, and newStatus are required' });
      return;
    }
    const result = await aiService.draftStatusUpdate({ title, oldStatus, newStatus, note, locale });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/sla-risk', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { issueId, issueIds } = req.body;
    const ids: string[] = issueIds || (issueId ? [issueId] : []);
    if (!ids.length) {
      res.status(400).json({ error: 'issueId or issueIds is required' });
      return;
    }

    const results = [];
    for (const id of ids.slice(0, 20)) {
      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, priority: true, category: true },
      });
      if (!issue) continue;
      const sla = await slaTrackingService.getForIssue(id);
      const dueAt = sla?.dueAt ? new Date(sla.dueAt).getTime() : Date.now() + 72 * 3600000;
      const hoursUntilDue = (dueAt - Date.now()) / 3600000;
      const risk = await aiService.predictSlaRisk({
        title: issue.title,
        status: issue.status,
        priority: issue.priority || 3,
        hoursUntilDue,
        breached: sla?.breached ?? false,
        hasFirstResponse: !!sla?.firstResponseAt,
        category: issue.category,
      });
      results.push({ issueId: id, ...risk });
    }
    res.json({ success: true, data: results });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(503).json({ error: error.message });
  }
});

router.post('/score-resolution', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, resolutionNote, category } = req.body;
    if (!title || !resolutionNote) {
      res.status(400).json({ error: 'title and resolutionNote are required' });
      return;
    }
    const result = await aiService.scoreResolution({
      title,
      description: description || '',
      resolutionNote,
      category,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/explain-ballot', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, body, type, locale } = req.body;
    if (!title || !type) {
      res.status(400).json({ error: 'title and type (poll|referendum) are required' });
      return;
    }
    const result = await aiService.explainBallot({ title, description, body, type, locale });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/generate-agenda', authenticate, authorize('MAYOR', 'COUNCIL_MEMBER', 'SUPER_ADMIN'), aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { date, maxItems, departmentId } = req.body;
    const meetingDate = date || new Date().toISOString().slice(0, 10);
    const where: any = {
      status: { in: ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'REOPENED'] },
      duplicateOfId: null,
    };
    if (departmentId) where.departmentId = departmentId;

    const [issues, resolutions] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { upvotes: 'desc' }],
        take: 15,
        select: { title: true, category: true, priority: true, status: true },
      }),
      prisma.resolution.findMany({
        where: { status: { in: ['DRAFT', 'PROPOSED', 'VOTING'] } },
        take: 10,
        select: { title: true, status: true },
      }),
    ]);

    const result = await aiService.generateAgenda({
      date: meetingDate,
      issues: issues.map((i) => ({
        title: i.title,
        category: i.category,
        priority: i.priority || 3,
        status: i.status,
      })),
      resolutions: resolutions.map((r) => ({ title: r.title, status: r.status })),
      maxItems: maxItems || 10,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(503).json({ error: error.message });
  }
});

router.post('/moderate-text', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    const result = await aiService.moderateText(content.trim());
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/related-impact', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { issueId } = req.body;
    if (!issueId) {
      res.status(400).json({ error: 'issueId is required' });
      return;
    }
    const result = await relatedImpactService.analyze(issueId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    res.status(503).json({ error: error.message });
  }
});

router.post('/detect-language', authenticate, aiLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const language = await aiService.detectLanguage(text.trim());
    res.json({ success: true, data: { language } });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
});

router.post(
  '/describe-image',
  authenticate,
  aiLimiter as any,
  mediaUpload.single('image') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'image file is required' });
        return;
      }
      if (!req.file.mimetype.startsWith('image/')) {
        res.status(400).json({ error: 'Only image files are supported' });
        return;
      }
      const locale = (req.body?.locale as string) || 'en';
      const base64 = req.file.buffer.toString('base64');
      const result = await aiService.describeImage(base64, locale);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(503).json({ error: error.message });
    }
  },
);

router.post(
  '/transcribe',
  authenticate,
  aiLimiter as any,
  mediaUpload.single('audio') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'audio file is required' });
        return;
      }
      const locale = (req.body?.locale as string) || 'en';
      const base64 = req.file.buffer.toString('base64');
      const result = await aiService.transcribeAudio(base64, locale);
      if (!result.transcript) {
        const errMsg = 'error' in result ? result.error : 'Transcription failed';
        res.status(503).json({ error: errMsg || 'Transcription failed', data: result });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(503).json({ error: error.message });
    }
  },
);

export default router;
