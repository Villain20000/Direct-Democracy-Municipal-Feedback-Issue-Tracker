import { prisma } from '../db/client';
import { notificationService } from './notification.service';
import { NotFoundError } from '../errors/domain-errors';

/**
 * B1 — Issue subscriptions.
 * Citizens follow an issue; whenever its status changes, a notification is
 * fanned out to every subscriber other than the actor. The uniqueness
 * constraint on (issueId, userId) makes subscribe idempotent.
 */
export const issueSubscriptionService = {
  /** Subscribe the current user to the issue. Idempotent. */
  async subscribe(issueId: string, userId: string) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, title: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    // upsert-style: try create, swallow unique-constraint violations
    const existing = await prisma.issueSubscription.findUnique({
      where: { issueId_userId: { issueId, userId } },
    });
    if (existing) return existing;

    return prisma.issueSubscription.create({
      data: { issueId, userId },
    });
  },

  /** Unsubscribe. Idempotent — returns the count removed. */
  async unsubscribe(issueId: string, userId: string) {
    const result = await prisma.issueSubscription.deleteMany({
      where: { issueId, userId },
    });
    return { removed: result.count };
  },

  /** List subscribers of an issue (used by staff dashboards). */
  async listSubscribers(issueId: string) {
    return prisma.issueSubscription.findMany({
      where: { issueId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** List issues the current user is subscribed to. */
  async listMine(userId: string) {
    return prisma.issueSubscription.findMany({
      where: { userId },
      include: {
        issue: {
          select: {
            id: true, title: true, status: true, category: true,
            createdAt: true, updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Fan-out a notification to every subscriber of an issue, excluding
   * the actor. Called from the issue service when status changes.
   */
  async fanOutStatusChange(
    issueId: string,
    actorUserId: string,
    newStatus: string,
    issueTitle: string,
  ) {
    const subs = await prisma.issueSubscription.findMany({
      where: { issueId, NOT: { userId: actorUserId } },
      select: { userId: true },
    });
    await Promise.all(
      subs.map(s =>
        notificationService.create(
          s.userId,
          'ISSUE_STATUS_CHANGED',
          'Issue status updated',
          `"${issueTitle}" is now ${newStatus}`,
          { issueId, newStatus },
          { sendEmail: false },
        ),
      ),
    );
    return { notified: subs.length };
  },
};
