import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { issueService } from '../services/issue.service';
import { areaSummaryService } from '../services/area-summary.service';
import { createIssueSchema, updateStatusSchema } from '../validators/issue.validators';
import { getEmbedIssueQueue } from '../queue/embed-issue.queue';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';

const router = Router();

// Public listing (with optional auth for vote status)
router.get('/', async (req, res) => {
  try {
    const result = await issueService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      status: req.query.status as string,
      category: req.query.category as string,
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
      reporterId: req.query.reporterId as string,
      assigneeId: req.query.assigneeId as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.list]', error);
    res.status(500).json({ error: error.message });
  }
});

// Issue templates
router.get('/templates', authenticate, async (_req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: issueService.getTemplates() });
});

// Summarize issues inside a user-drawn polygon (any authenticated user).
// Note: must be declared before /:id so /summarize-area isn't captured by
// the param route.
router.post('/summarize-area', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const polygon = req.body?.polygon;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      res.status(400).json({ error: 'polygon must be an array of [lat, lng] pairs with at least 3 vertices' });
      return;
    }
    const result = await areaSummaryService.summarize(polygon);
    res.json({ success: true, data: result });
  } catch (error: any) {
    // The polygon was already validated above, but if the service
    // throws a BadRequestError (defence-in-depth), sendDomainError
    // maps it to 400. Anything else is a server-side failure (DB
    // outage, AI service down, etc.) — surface as 500.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.summarize-area]', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk update (staff+ only) — must be before /:id
router.patch('/bulk', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids, status, assigneeId, departmentId } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    const results = await issueService.bulkUpdate(ids, { status, assigneeId, departmentId }, req.user!.id);
    res.json({ success: true, data: results });
  } catch (error: any) {
    // Defence-in-depth: the service throws BadRequestError(400) when
    // ids is empty or > 100. Even though we pre-validated above,
    // delegating the status decision to sendDomainError keeps the
    // behaviour consistent with other routes.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.bulk]', error);
    res.status(500).json({ error: error.message });
  }
});

// Department resolution rates
router.get('/stats/departments', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD'), async (_req: AuthenticatedRequest, res) => {
  try {
    const rates = await issueService.getDepartmentResolutionRates();
    res.json({ success: true, data: rates });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.stats.departments]', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await issueService.getStats({
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
    });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.stats]', error);
    res.status(500).json({ error: error.message });
  }
});

// Semantic ("smart") search over issues. Returns the top-K issues most
// similar to the free-text query, ordered by cosine similarity. Used by
// the smart search bar in the issue list UI. Falls back to plain text
// matching if the embedding service is unavailable.
//
// Auth-gated: the underlying semantic path calls Ollama for an embedding
// and runs a pgvector scan, both of which are expensive. Keeping this
// behind `authenticate` matches the surrounding /issues endpoints and
// prevents anonymous callers from using it as a free DoS vector.
router.get('/search-similar', authenticate, async (req, res) => {
  try {
    const text = ((req.query.text as string) || '').trim();
    const topK = parseInt(req.query.topK as string) || 5;
    const minScore = parseFloat(req.query.minScore as string) || 0.2;

    if (text.length < 3) {
      res.status(400).json({ error: 'text query must be at least 3 characters' });
      return;
    }

    const result = await issueService.searchSimilar(text, topK, minScore);
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.searchSimilar]', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single issue
router.get('/:id', async (req, res) => {
  try {
    const issue = await issueService.getById(req.params.id as string);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    // Issue not found → 404 (was previously hard-coded below; now
    // delegated to sendDomainError so the code/details fields are
    // populated the same way as other domain errors).
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.getById]', error);
    res.status(500).json({ error: error.message });
  }
});

// Create issue (authenticated). Heavy work (embedding, AI triage) is
// deferred to the background worker — the HTTP handler returns 202 with
// the new issue id as soon as the row is persisted, so the user doesn't
// wait 4-5s for the AI calls.
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const data = createIssueSchema.parse(req.body);
    const issue = await issueService.create({
      ...data,
      reporterId: req.user!.id,
    });

    // Fire-and-forget enqueue. If Redis is unreachable, the issue is
    // still created — the backfill script (`npm run embed:backfill`)
    // will catch up. We log a warning and surface a `warnings` array in
    // the 202 response so the client / mayor dashboard can show a
    // degraded state instead of silently dropping the embedding job.
    const warnings: string[] = [];
    try {
      const queue = getEmbedIssueQueue();
      await queue.add(
        'embed',
        { issueId: issue.id },
        {
          // dedupe: BullMQ will skip a duplicate add with the same
          // jobId. Protects against double-clicks on the submit button.
          jobId: `embed:${issue.id}`,
        },
      );
    } catch (queueErr: any) {
      console.warn(
        `[issue.create] Could not enqueue embed job for ${issue.id}: ${queueErr.message}. ` +
        `The backfill script will catch up.`,
      );
      warnings.push('embedding_deferred_failed');
    }

    res.status(202).json({
      success: true,
      data: issue,
      warnings,
      message: 'Issue created. Embedding queued for background processing.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    // NotFoundError → 404 (e.g. assigneeId refers to a missing user in
    // a future refactor). Defence-in-depth: anything else is a
    // server-side failure.
    if (sendDomainError(res, error, { logger: console })) return;
    // Any other thrown error is a server-side failure (DB outage, queue
    // crash, etc.). The client did nothing wrong; surface it as 500 so
    // monitoring / retries can react properly.
    console.error('[issues.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// Update status (staff+ only)
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, note } = updateStatusSchema.parse(req.body);
    const issue = await issueService.updateStatus(req.params.id as string, status, req.user!.id, note);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    // updateStatus now throws NotFoundError when the id doesn't exist;
    // delegate the rest to sendDomainError for 403/BadRequest consistency.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.status]', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign issue (staff+ — STAFF is allowed because day-to-day routing of
// issues to a specific staffer is exactly the action a STAFF takes).
router.patch('/:id/assign', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const { assigneeId, departmentId } = req.body;
    const issue = await issueService.assign(req.params.id as string, assigneeId, departmentId, req.user!.id);
    res.json({ success: true, data: issue });
  } catch (error: any) {
    // assign now throws NotFoundError when the id is missing.
    if (sendDomainError(res, error, { logger: console })) return;
    // No Zod validation on the body (assigneeId/departmentId are simple
    // strings), so any thrown error is a server-side failure.
    console.error('[issues.assign]', error);
    res.status(500).json({ error: error.message });
  }
});

// Upvote issue
router.post('/:id/upvote', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await issueService.upvote(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    // upvote currently can't hit a NotFoundError on the issue (it uses
    // upsert semantics), but future changes might — delegate just in
    // case.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[issues.upvote]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
