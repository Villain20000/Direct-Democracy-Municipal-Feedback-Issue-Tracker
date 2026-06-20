import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../db/client';

const router = Router();

/**
 * Civic score badge tiers. Thresholds are deliberately generous so the
 * median active citizen reaches Bronze within a few weeks. The numbers
 * are the *minimum* points required for each tier.
 */
const TIERS = [
  { name: 'Platinum', min: 500, color: '#E5E4E2', icon: 'workspace_premium' },
  { name: 'Gold', min: 250, color: '#F59E0B', icon: 'military_tech' },
  { name: 'Silver', min: 100, color: '#94A3B8', icon: 'verified' },
  { name: 'Bronze', min: 25, color: '#B45309', icon: 'shield' },
  { name: 'Newcomer', min: 0, color: '#64748B', icon: 'eco' },
];

function tierFor(points: number) {
  return TIERS.find((t) => points >= t.min) ?? TIERS[TIERS.length - 1];
}

/**
 * GET /api/v1/civic-score/:userId
 *
 * Computes a gamification "civic score" for a user from existing data:
 *   +5 per issue reported
 *   +2 per upvote received on the user's issues
 *   +1 per vote cast (poll/survey)
 *   +3 per resolved issue the user reported
 *   +1 per comment posted
 *
 * No schema changes — purely read aggregation. Returns the score, the
 * per-component breakdown, the current tier, and progress to the next
 * tier so the UI can render a progress ring.
 */
router.get('/:userId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.userId as string;

    // Callers can read their own score or anyone else's — civic scores
    // are public-facing by design (leaderboard-style). We only require
    // authentication so we have a stable identity context.
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const [issues, upvotesReceived, votesCast, comments] = await Promise.all([
      prisma.issue.count({ where: { reporterId: targetUserId } }),
      prisma.issue.aggregate({
        where: { reporterId: targetUserId },
        _sum: { upvotes: true },
      }),
      prisma.vote.count({ where: { userId: targetUserId } }),
      prisma.comment.count({ where: { userId: targetUserId } }),
    ]);

    const resolved = await prisma.issue.count({
      where: {
        reporterId: targetUserId,
        status: { in: ['RESOLVED', 'VERIFIED'] },
      },
    });

    const breakdown = {
      issuesReported: { count: issues, points: issues * 5 },
      upvotesReceived: { count: upvotesReceived._sum.upvotes ?? 0, points: (upvotesReceived._sum.upvotes ?? 0) * 2 },
      votesCast: { count: votesCast, points: votesCast * 1 },
      commentsPosted: { count: comments, points: comments * 1 },
      issuesResolved: { count: resolved, points: resolved * 3 },
    };

    const points =
      breakdown.issuesReported.points +
      breakdown.upvotesReceived.points +
      breakdown.votesCast.points +
      breakdown.commentsPosted.points +
      breakdown.issuesResolved.points;

    const tier = tierFor(points);
    const nextTier = TIERS.find((t) => t.min > points) ?? null;
    const progressToNext = nextTier
      ? Math.min(100, Math.round(((points - tier.min) / (nextTier.min - tier.min)) * 100))
      : 100;

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role },
        points,
        tier,
        nextTier: nextTier ? { name: nextTier.name, min: nextTier.min } : null,
        progressToNext,
        breakdown,
      },
    });
  } catch (error: any) {
    console.error('[civic-score.get]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
