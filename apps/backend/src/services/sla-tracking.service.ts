import { prisma } from '../db/client';
import { NotFoundError } from '../errors/domain-errors';

/**
 * B6 — SLA tracking.
 *
 * Maps an issue's priority to a response / resolution deadline:
 *   5 (critical)  →  4 h
 *   4 (high)      → 24 h
 *   3 (medium)    →  3 d
 *   2 (low)       →  7 d
 *   1 (inform)    → 14 d
 *
 * The row is created when the issue is first prioritized and updated as
 * the issue moves through the workflow. A periodic breach scanner (to
 * be wired into a cron in a later phase) flips `breached = true` when
 * `dueAt` passes without a resolution.
 */
const SLA_HOURS: Record<number, number> = {
  5: 4,
  4: 24,
  3: 72,
  2: 168,
  1: 336,
};

export const slaTrackingService = {
  /** Compute the SLA `dueAt` for a given priority (defaults to 72h). */
  computeDueAt(priority: number, from: Date = new Date()): Date {
    const hours = SLA_HOURS[priority] ?? 72;
    return new Date(from.getTime() + hours * 60 * 60 * 1000);
  },

  /** Upsert the SLA row for an issue. Called from issue service on create + on priority change. */
  async upsertForIssue(issueId: string, priority: number) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    return prisma.slaTracking.upsert({
      where: { issueId },
      create: {
        issueId,
        priority: String(priority),
        dueAt: this.computeDueAt(priority),
      },
      update: {
        priority: String(priority),
        dueAt: this.computeDueAt(priority),
        // If priority changed, clear the first-response / resolution markers
        // so the SLA restarts against the new deadline.
        firstResponseAt: null,
        resolvedAt: null,
        breached: false,
      },
    });
  },

  /** Stamp the first response (status moved out of SUBMITTED). */
  async markFirstResponse(issueId: string) {
    const row = await prisma.slaTracking.findUnique({ where: { issueId } });
    if (!row || row.firstResponseAt) return row;
    return prisma.slaTracking.update({
      where: { issueId },
      data: { firstResponseAt: new Date() },
    });
  },

  /** Stamp the resolution. */
  async markResolved(issueId: string) {
    return prisma.slaTracking.update({
      where: { issueId },
      data: { resolvedAt: new Date(), breached: false },
    });
  },

  /** Read the current SLA row for an issue. */
  async getForIssue(issueId: string) {
    return prisma.slaTracking.findUnique({ where: { issueId } });
  },

  /**
   * Scan every unresolved SLA, flip `breached` for any past-due rows.
   * Designed to be invoked by a cron tick (not yet wired in this phase).
   */
  async scanForBreaches() {
    const now = new Date();
    const result = await prisma.slaTracking.updateMany({
      where: {
        breached: false,
        resolvedAt: null,
        dueAt: { lt: now },
      },
      data: { breached: true },
    });
    return { breached: result.count, scannedAt: now };
  },

  /** List currently-breached SLAs (used by the department-head dashboard). */
  async listBreached() {
    return prisma.slaTracking.findMany({
      where: { breached: true, resolvedAt: null },
      include: {
        issue: {
          select: {
            id: true, title: true, status: true, priority: true,
            departmentId: true, assigneeId: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  },
};
