import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../db/client';

const router = Router();

/**
 * GET /api/v1/activity
 *
 * Returns a merged, time-sorted feed of recent platform activity across
 * multiple tables (issues filed, status changes, upvotes, comments). No
 * schema changes — everything is computed from existing models.
 *
 * Query params:
 *   limit  - max items to return (1..50, default 20)
 *   scope  - 'all' (default) | 'me' (only activity by the caller)
 *
 * The feed is intentionally cheap: each source query is capped at
 * `limit` rows, indexed by `createdAt`, and merged in JS. We avoid
 * a UNION because Prisma doesn't support it cleanly and the row
 * counts are small.
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
    const scope = req.query.scope === 'me' ? 'me' : 'all';
    const userId = req.user!.id;

    // Each source returns at most `limit` most-recent rows. We fetch a
    // few extra columns for display (title, name) but keep selects lean.
    const reporterFilter = scope === 'me' ? { reporterId: userId } : {};

    const [issues, statusChanges, votes, comments] = await Promise.all([
      prisma.issue.findMany({
        where: reporterFilter,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          reporterId: true,
          createdAt: true,
          reporter: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.statusHistory.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          issueId: true,
          oldStatus: true,
          newStatus: true,
          changedBy: true,
          note: true,
          createdAt: true,
          issue: { select: { title: true } },
        },
      }),
      prisma.vote.findMany({
        where: { issueId: { not: null } },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          value: true,
          issueId: true,
          userId: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          issue: { select: { title: true } },
        },
      }),
      prisma.comment.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          issueId: true,
          userId: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          issue: { select: { title: true } },
        },
      }),
    ]);

    type ActivityItem = {
      id: string;
      type: 'issue_created' | 'status_changed' | 'upvote' | 'comment';
      actorId: string | null;
      actorName: string;
      issueId: string | null;
      issueTitle: string | null;
      detail: string;
      category?: string;
      createdAt: Date;
    };

    const items: ActivityItem[] = [];

    for (const i of issues) {
      items.push({
        id: `issue:${i.id}`,
        type: 'issue_created',
        actorId: i.reporterId,
        actorName: `${i.reporter.firstName} ${i.reporter.lastName}`,
        issueId: i.id,
        issueTitle: i.title,
        detail: i.title,
        category: i.category,
        createdAt: i.createdAt,
      });
    }

    for (const s of statusChanges) {
      items.push({
        id: `status:${s.id}`,
        type: 'status_changed',
        actorId: s.changedBy,
        actorName: 'Staff',
        issueId: s.issueId,
        issueTitle: s.issue?.title ?? null,
        detail: `${s.oldStatus ?? 'NEW'} → ${s.newStatus}`,
        createdAt: s.createdAt,
      });
    }

    for (const v of votes) {
      items.push({
        id: `vote:${v.id}`,
        type: 'upvote',
        actorId: v.userId,
        actorName: `${v.user.firstName} ${v.user.lastName}`,
        issueId: v.issueId,
        issueTitle: v.issue?.title ?? null,
        detail: `+${v.value}`,
        createdAt: v.createdAt,
      });
    }

    for (const c of comments) {
      items.push({
        id: `comment:${c.id}`,
        type: 'comment',
        actorId: c.userId,
        actorName: `${c.user.firstName} ${c.user.lastName}`,
        issueId: c.issueId,
        issueTitle: c.issue?.title ?? null,
        detail: c.content.length > 120 ? c.content.slice(0, 120) + '…' : c.content,
        createdAt: c.createdAt,
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const trimmed = items.slice(0, limit).map((it) => ({
      ...it,
      createdAt: it.createdAt.toISOString(),
    }));

    res.json({ success: true, data: trimmed, total: trimmed.length });
  } catch (error: any) {
    console.error('[activity.list]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
