import { prisma } from '../db/client';
import { NotFoundError } from '../errors/domain-errors';

/**
 * B7 — Issue assignment history.
 * Append-only log of "who was assigned what and when" + the matching
 * unassignment events. The current `Issue.assigneeId` is the source of
 * truth for "who is on it right now"; this table is the audit trail.
 */
export const issueAssignmentService = {
  /**
   * Record a new assignment. Returns the created row. Called by the
   * PATCH /issues/:id/assign route after Prisma's update succeeds.
   */
  async recordAssignment(
    issueId: string,
    assigneeId: string,
    assignedById: string,
    reason?: string,
  ) {
    return prisma.issueAssignment.create({
      data: { issueId, assigneeId, assignedById, reason },
    });
  },

  /**
   * Record an unassignment on the most recent open assignment row for
   * this issue, if any.
   */
  async recordUnassignment(issueId: string, unassignedById: string) {
    const open = await prisma.issueAssignment.findFirst({
      where: { issueId, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!open) return null;
    return prisma.issueAssignment.update({
      where: { id: open.id },
      data: { unassignedAt: new Date(), unassignedById },
    });
  },

  /** Return the full history of assignments for an issue, newest first. */
  async listForIssue(issueId: string) {
    return prisma.issueAssignment.findMany({
      where: { issueId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
        unassignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  },

  /** Count currently-open assignments for a user (workload metric). */
  async countOpenForUser(userId: string) {
    return prisma.issueAssignment.count({
      where: { assigneeId: userId, unassignedAt: null },
    });
  },
};

/**
 * Convenience wrapper that PATCH /issues/:id/assign can call after the
 * main update succeeds. It records the assignment and (if the issue is
 * being reassigned) closes the previous open row. Returns the list of
 * assignment rows touched.
 */
export async function recordAssignChange(
  issueId: string,
  newAssigneeId: string | null,
  actorId: string,
  reason?: string,
) {
  if (newAssigneeId === null) {
    return [await issueAssignmentService.recordUnassignment(issueId, actorId)].filter(Boolean);
  }
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, assigneeId: true },
  });
  if (!issue) throw new NotFoundError('Issue not found');

  const touched = [];
  if (issue.assigneeId && issue.assigneeId !== newAssigneeId) {
    const closed = await issueAssignmentService.recordUnassignment(issueId, actorId);
    if (closed) touched.push(closed);
  }
  const created = await issueAssignmentService.recordAssignment(
    issueId,
    newAssigneeId,
    actorId,
    reason,
  );
  touched.push(created);
  return touched;
}
