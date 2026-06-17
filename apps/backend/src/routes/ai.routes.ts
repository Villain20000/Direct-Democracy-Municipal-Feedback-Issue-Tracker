import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { aiService } from '../ai/ollama.service';
import { ragService } from '../services/rag.service';
import ollama from 'ollama';
import { config } from '../config';

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
    const { messages, useRag } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'Messages array is required' }); return; }

    // RAG-augmented chat: if the latest user message looks like a question
    // about municipal rules, ordinances, or decisions, pull the top-5
    // most similar chunks from the document store and inject them into
    // the system prompt with explicit "cite the document title" instructions.
    let citations: Array<{ documentId: string; title: string; type: string; source: string; documentDate: string | null; chunkIndex: number; score: number; chunk: string }> = [];
    let augmentedMessages = messages;
    if (useRag !== false) {
      const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
      const q = (lastUser?.content || '').toString().trim();
      if (q.length >= 10) {
        try {
          const chunks = await ragService.retrieve(q, 5, 0.25);
          if (chunks.length > 0) {
            citations = chunks.map((c) => ({
              documentId: c.documentId,
              title: c.documentTitle,
              type: c.documentType,
              source: c.documentSource,
              documentDate: c.documentDate,
              chunkIndex: c.chunkIndex,
              score: c.score,
              chunk: c.content.slice(0, 220) + (c.content.length > 220 ? '…' : ''),
            }));
            const contextBlock = chunks
              .map((c, i) => `[${i + 1}] (${c.documentTitle}, ${c.documentType}${c.documentDate ? `, ${c.documentDate}` : ''})\n${c.content}`)
              .join('\n\n---\n\n');
            const systemAugment = {
              role: 'system',
              content: `You are CivicAssist, an AI assistant for the municipal government. The user may ask about\nmunicipal rules, ordinances, or decisions. The following excerpts from the official document\nstore are provided as CONTEXT ONLY. Answer the user's question using this context when relevant,\nand CITE the document title and number in brackets (e.g. [1]) so the user can verify.\nIf the context does not contain the answer, say so honestly and suggest where the citizen could\nlook instead (e.g. the relevant department). Keep answers concise and friendly.\n\n--- CONTEXT ---\n${contextBlock}\n--- END CONTEXT ---`,
            };
            augmentedMessages = [systemAugment, ...messages];
          }
        } catch (err: any) {
          // RAG retrieval failed (e.g. no embeddings yet) — fall through to plain chat.
          console.warn('[ai.chat] RAG retrieval failed, falling back to plain chat:', err.message);
        }
      }
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
        citations,
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

    let citations: Array<{ documentId: string; title: string; type: string; source: string; documentDate: string | null; chunkIndex: number; score: number; chunk: string }> = [];
    let augmentedMessages = messages;
    if (useRag !== false) {
      const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
      const q = (lastUser?.content || '').toString().trim();
      if (q.length >= 10) {
        try {
          const chunks = await ragService.retrieve(q, 5, 0.25);
          if (chunks.length > 0) {
            citations = chunks.map((c) => ({
              documentId: c.documentId,
              title: c.documentTitle,
              type: c.documentType,
              source: c.documentSource,
              documentDate: c.documentDate,
              chunkIndex: c.chunkIndex,
              score: c.score,
              chunk: c.content.slice(0, 220) + (c.content.length > 220 ? '…' : ''),
            }));
            const contextBlock = chunks
              .map((c, i) => `[${i + 1}] (${c.documentTitle}, ${c.documentType}${c.documentDate ? `, ${c.documentDate}` : ''})\n${c.content}`)
              .join('\n\n---\n\n');
            const systemAugment = {
              role: 'system',
              content: `You are CivicAssist, an AI assistant for the municipal government. The user may ask about\nmunicipal rules, ordinances, or decisions. The following excerpts from the official document\nstore are provided as CONTEXT ONLY. Answer the user's question using this context when relevant,\nand CITE the document title and number in brackets (e.g. [1]) so the user can verify.\nIf the context does not contain the answer, say so honestly and suggest where the citizen could\nlook instead (e.g. the relevant department). Keep answers concise and friendly.\n\n--- CONTEXT ---\n${contextBlock}\n--- END CONTEXT ---`,
            };
            augmentedMessages = [systemAugment, ...messages];
          }
        } catch (err: any) {
          console.warn('[ai.chat.stream] RAG retrieval failed, falling back to plain chat:', err.message);
        }
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send metadata/citations first
    res.write(`data: ${JSON.stringify({ type: 'meta', citations, ragUsed: citations.length > 0 })}\n\n`);

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

export default router;
