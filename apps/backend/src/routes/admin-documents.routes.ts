/**
 * Admin routes for the municipal legislation / document store.
 *
 * Endpoints (all require authentication + admin-level role):
 *   GET    /api/v1/admin/documents              list documents (most recent first)
 *   GET    /api/v1/admin/documents/:id          get one document
 *   POST   /api/v1/admin/documents              upload a new document
 *   POST   /api/v1/admin/documents/retrieve     semantic search (no LLM) — for KB auditing
 *   DELETE /api/v1/admin/documents/:id          remove a document and its chunks
 *
 * Upload accepts either:
 *   - multipart/form-data with a `file` (PDF or .txt) + metadata fields, OR
 *   - application/json with `{ title, type, source, content, ... }` for paste-in.
 *
 * PDF text extraction uses pdf-parse. Plain text is taken as-is. Idempotent
 * re-ingestion: re-uploading the same content becomes a no-op (the
 * contentHash unique index protects us).
 */

import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { ragService } from '../services/rag.service';

// pdf-parse has no type definitions; we wrap it in a typed helper.
type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: PdfParseFn = require('pdf-parse');

// In-memory storage with a hard size cap. Files are streamed to the
// text-extractor, never written to disk here.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Multer 1.x's `.single()` returns its own `RequestHandler` type which
// doesn't structurally overlap with Express 5's. The runtime signature
// `(req, res, next) => void` is identical, so a single cast is safe.
const uploadSingleFile: RequestHandler = upload.single('file') as unknown as RequestHandler;

const ALLOWED_TYPES = new Set(['ORDINANCE', 'DECISION', 'REGULATION', 'GUIDE', 'OTHER']);

const router = Router();
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER'));

/**
 * List documents (most recent first, capped).
 */
router.get('/', async (_req: AuthenticatedRequest, res) => {
  try {
    const docs = await ragService.listDocuments(100);
    res.json({ success: true, data: docs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Semantic search over the legislation KB (no LLM).
 *
 * Useful for admins auditing the KB: see exactly which chunks would be
 * retrieved for a query, with their similarity scores, without spending
 * a token on a chat completion. Frontend can use this to build a
 * "browse legislation" page.
 *
 * Body: { query: string, topK?: number, minScore?: number }
 *   - query: required, min 3 chars
 *   - topK:  optional, default 5, max 20
 *   - minScore: optional, default 0.3 (cosine similarity)
 *
 * Response: { success, data: { query, chunks: RetrievedChunk[], count } }
 */
router.post('/retrieve', async (req: AuthenticatedRequest, res) => {
  try {
    const { query, topK, minScore } = req.body || {};
    if (typeof query !== 'string' || query.trim().length < 3) {
      res.status(400).json({ error: 'query is required and must be at least 3 characters' });
      return;
    }
    const k = topK !== undefined ? Math.min(Math.max(1, Number(topK) || 5), 20) : 5;
    const min = minScore !== undefined ? Math.max(0, Math.min(1, Number(minScore))) : 0.3;

    const chunks = await ragService.retrieve(query.trim(), k, min);
    res.json({
      success: true,
      data: { query: query.trim(), chunks, count: chunks.length },
    });
  } catch (err: any) {
    console.error('[admin.documents] retrieve failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a single document (with chunk text).
 */
router.get('/:id', async (req, res) => {
  try {
    const { prisma } = await import('../db/client');
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload / ingest a document.
 *
 * Two content types:
 *   - multipart/form-data: `file` (PDF or .txt) + metadata fields
 *   - application/json:   { title, type, source, content, description?, documentDate? }
 */
router.post('/', uploadSingleFile, async (req: AuthenticatedRequest, res) => {
  try {
    let title = (req.body?.title as string | undefined)?.trim();
    let type = (req.body?.type as string | undefined)?.trim();
    let source = (req.body?.source as string | undefined)?.trim();
    let description = (req.body?.description as string | undefined)?.trim();
    let documentDate = (req.body?.documentDate as string | undefined)?.trim();
    let content = (req.body?.content as string | undefined);

    // If a file was uploaded, extract text from it.
    if (req.file) {
      const mime = req.file.mimetype;
      const buf = req.file.buffer;
      if (mime === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
        const parsed = await pdfParse(buf);
        content = parsed.text;
      } else if (mime.startsWith('text/') || req.file.originalname.toLowerCase().endsWith('.txt')) {
        content = buf.toString('utf-8');
      } else {
        res.status(400).json({ error: `Unsupported file type: ${mime}. Use PDF or .txt.` });
        return;
      }
      // Default the title to the filename if the user didn't supply one.
      if (!title) title = req.file.originalname.replace(/\.[^.]+$/, '');
      if (!source) source = `upload:${req.file.originalname}`;
    }

    // Validation.
    if (!title || !type || !source || !content) {
      res.status(400).json({ error: 'title, type, source, and content (or file) are required' });
      return;
    }
    if (!ALLOWED_TYPES.has(type)) {
      res.status(400).json({ error: `type must be one of: ${[...ALLOWED_TYPES].join(', ')}` });
      return;
    }
    if (content.length < 50) {
      res.status(400).json({ error: 'content is too short to be useful (< 50 chars)' });
      return;
    }

    const result = await ragService.ingest({
      title,
      type: type as 'ORDINANCE' | 'DECISION' | 'REGULATION' | 'GUIDE' | 'OTHER',
      source,
      description,
      documentDate,
      content,
      uploadedById: req.user!.id,
    });

    res.status(result.skipped ? 200 : 201).json({
      success: true,
      data: result,
      message: result.skipped
        ? 'This document already exists (same content hash). No new chunks were created.'
        : `Document ingested. ${result.chunksCreated} chunk(s) created.`,
    });
  } catch (err: any) {
    console.error('[admin.documents] ingest failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a document (cascades to chunks).
 */
router.delete('/:id', async (req, res) => {
  try {
    await ragService.deleteDocument(req.params.id as string);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
