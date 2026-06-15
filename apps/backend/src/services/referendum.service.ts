/**
 * Phase D1 — Referendum service.
 *
 * Distinct from Resolution (council-internal yes/no on a single motion):
 * a Referendum is a public ballot with YES / NO / ABSTAIN choices, an
 * opensAt / closesAt window, a passThreshold (default 0.5 simple
 * majority of YES+NO), and a minParticipation floor.
 *
 * Status state machine:
 *   DRAFT -> OPEN -> CLOSED -> PASSED | REJECTED
 *          (admin can CANCEL from any state)
 *
 * Concurrency:
 *   - Vote uniqueness: ReferendumVote has `@@unique([referendumId, userId])`
 *     so a second vote is rejected at the DB level.
 *   - Tally updates: castVote() runs in a single Prisma transaction that
 *     inserts the vote and increments the cached count atomically.
 *   - closeReferendum() tallies once under a transaction and sets the
 *     terminal status.
 */
import { prisma } from '../db/client';
import {
  AlreadyVotedError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors/domain-errors';
import type { Prisma, UserRole } from '@prisma/client';

type Role = (typeof import('@prisma/client').UserRole)[keyof typeof import('@prisma/client').UserRole];

export const referendumService = {
  /**
   * Create a new referendum in DRAFT status. Caller is the creator.
   * Validates: closesAt > opensAt (zod), passThreshold in (0, 1], etc.
   */
  async create(data: {
    title: string; description: string; body: string;
    opensAt: Date; closesAt: Date;
    passThreshold?: number; minParticipation?: number;
    eligibleRoles?: Role[]; createdById: string;
  }) {
    return prisma.referendum.create({
      data: {
        title: data.title,
        description: data.description,
        body: data.body,
        opensAt: data.opensAt,
        closesAt: data.closesAt,
        passThreshold: data.passThreshold ?? 0.5,
        minParticipation: data.minParticipation ?? 0,
        eligibleRoles: (data.eligibleRoles ?? []) as unknown as Prisma.InputJsonValue as string[],
        createdById: data.createdById,
        status: 'DRAFT',
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { votes: true } },
      },
    });
  },

  /** List referendums, paginated, filterable by status. Public read. */
  async list(params: { page?: number; pageSize?: number; status?: string } = {}) {
    const { page = 1, pageSize = 20, status } = params;
    const where: Prisma.ReferendumWhereInput = {};
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      prisma.referendum.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.referendum.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  /** Get a single referendum with its tallies + creator. */
  async getById(id: string) {
    const ref = await prisma.referendum.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!ref) throw new NotFoundError('Referendum not found');
    return ref;
  },

  /**
   * Update a referendum. Only the creator or an admin/mayor can do this,
   * and only while the referendum is still in DRAFT (no edits to
   * open/closed referendums).
   */
  async update(
    id: string,
    actorId: string,
    actorRole: Role,
    data: Partial<{
      title: string; description: string; body: string;
      opensAt: Date; closesAt: Date;
      passThreshold: number; minParticipation: number;
      eligibleRoles: Role[];
    }>,
  ) {
    const ref = await prisma.referendum.findUnique({ where: { id } });
    if (!ref) throw new NotFoundError('Referendum not found');
    if (ref.status !== 'DRAFT') {
      throw new BadRequestError(
        `Cannot edit a referendum in ${ref.status} status`,
        'BAD_REQUEST',
        { currentStatus: ref.status, expected: 'DRAFT' },
      );
    }
    const isAdmin = actorRole === 'SUPER_ADMIN' || actorRole === 'MAYOR';
    if (!isAdmin && ref.createdById !== actorId) {
      throw new ForbiddenError('Only the creator or an admin can edit this referendum');
    }
    if (data.opensAt && data.closesAt && data.closesAt.getTime() <= data.opensAt.getTime()) {
      throw new BadRequestError('closesAt must be after opensAt', 'BAD_REQUEST', {
        field: 'closesAt',
      });
    }
    return prisma.referendum.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.opensAt !== undefined ? { opensAt: data.opensAt } : {}),
        ...(data.closesAt !== undefined ? { closesAt: data.closesAt } : {}),
        ...(data.passThreshold !== undefined ? { passThreshold: data.passThreshold } : {}),
        ...(data.minParticipation !== undefined ? { minParticipation: data.minParticipation } : {}),
        ...(data.eligibleRoles !== undefined
          ? { eligibleRoles: data.eligibleRoles as unknown as string[] }
          : {}),
      },
    });
  },

  /**
   * Manual status transition. Allowed transitions:
   *   DRAFT   -> OPEN         (admin/mayor, or creator)
   *   DRAFT   -> CANCELLED
   *   OPEN    -> CLOSED       (admin/mayor, or auto-triggered on close)
   *   CLOSED  -> PASSED|REJECTED (admin/mayor, or via tally)
   *   any non-terminal -> CANCELLED
   * Terminal: PASSED, REJECTED, CANCELLED.
   */
  async changeStatus(id: string, actorId: string, actorRole: Role, newStatus: string) {
    const ref = await prisma.referendum.findUnique({ where: { id } });
    if (!ref) throw new NotFoundError('Referendum not found');

    const isAdmin = actorRole === 'SUPER_ADMIN' || actorRole === 'MAYOR';
    if (!isAdmin && ref.createdById !== actorId) {
      throw new ForbiddenError('Only the creator or an admin can change referendum status');
    }

    const allowed = this.allowedTransition(ref.status, newStatus);
    if (!allowed) {
      throw new BadRequestError(
        `Invalid status transition: ${ref.status} -> ${newStatus}`,
        'BAD_REQUEST',
        { from: ref.status, to: newStatus },
      );
    }

    // When flipping to OPEN, ensure the time window is valid right now.
    if (newStatus === 'OPEN') {
      const now = new Date();
      if (ref.closesAt.getTime() <= now.getTime()) {
        throw new BadRequestError('Cannot OPEN a referendum whose closesAt is in the past', 'BAD_REQUEST');
      }
    }

    // When flipping to a terminal state, stamp decidedAt.
    const data: Prisma.ReferendumUpdateInput = { status: newStatus as any };
    if (newStatus === 'PASSED' || newStatus === 'REJECTED' || newStatus === 'CANCELLED') {
      data.decidedAt = new Date();
    }
    return prisma.referendum.update({ where: { id }, data });
  },

  /** Static table of allowed transitions. */
  allowedTransition(from: string, to: string): boolean {
    const allowed: Record<string, string[]> = {
      DRAFT: ['OPEN', 'CANCELLED'],
      OPEN: ['CLOSED', 'CANCELLED'],
      CLOSED: ['PASSED', 'REJECTED', 'CANCELLED'],
      PASSED: [],
      REJECTED: [],
      CANCELLED: [],
    };
    return (allowed[from] || []).includes(to);
  },

  /**
   * Cast a vote. Idempotency at the DB level via
   * `ReferendumVote @@unique([referendumId, userId])`. The cached tallies
   * are bumped in the same transaction.
   */
  async castVote(referendumId: string, userId: string, userRole: Role, choice: 'YES' | 'NO' | 'ABSTAIN') {
    const ref = await prisma.referendum.findUnique({ where: { id: referendumId } });
    if (!ref) throw new NotFoundError('Referendum not found');

    if (ref.status !== 'OPEN') {
      throw new BadRequestError(
        `Referendum is not open for voting (current: ${ref.status})`,
        'BAD_REQUEST',
        { currentStatus: ref.status, expected: 'OPEN' },
      );
    }

    const now = new Date();
    if (now < ref.opensAt) {
      throw new BadRequestError('Voting has not opened yet', 'BAD_REQUEST', {
        opensAt: ref.opensAt,
      });
    }
    if (now >= ref.closesAt) {
      throw new BadRequestError('Voting has closed', 'BAD_REQUEST', { closesAt: ref.closesAt });
    }

    // Eligibility check
    if (ref.eligibleRoles.length > 0 && !ref.eligibleRoles.includes(userRole)) {
      throw new ForbiddenError('You are not eligible to vote on this referendum', {
        eligibleRoles: ref.eligibleRoles,
        yourRole: userRole,
      });
    }

    // Reject double-vote before hitting the DB
    const existing = await prisma.referendumVote.findUnique({
      where: { referendumId_userId: { referendumId, userId } },
    });
    if (existing) {
      throw new AlreadyVotedError('You have already voted on this referendum', {
        existingChoice: existing.choice,
      });
    }

    // Cast + bump tallies in one transaction
    const tallyIncrement: Prisma.ReferendumUpdateInput =
      choice === 'YES'
        ? { yesCount: { increment: 1 }, totalVotes: { increment: 1 } }
        : choice === 'NO'
          ? { noCount: { increment: 1 }, totalVotes: { increment: 1 } }
          : { abstainCount: { increment: 1 }, totalVotes: { increment: 1 } };

    const [vote, _updated] = await prisma.$transaction([
      prisma.referendumVote.create({
        data: { referendumId, userId, choice },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.referendum.update({ where: { id: referendumId }, data: tallyIncrement }),
    ]);
    return vote;
  },

  /**
   * Close the referendum and apply the pass/reject logic:
   *   - If totalVotes < minParticipation  -> REJECTED (inconclusive)
   *   - If yesCount / (yesCount + noCount) >= passThreshold -> PASSED
   *   - Otherwise -> REJECTED
   * Terminal: idempotent (closing a closed referendum is a no-op).
   */
  async close(referendumId: string, actorId: string, actorRole: Role) {
    const ref = await prisma.referendum.findUnique({ where: { id: referendumId } });
    if (!ref) throw new NotFoundError('Referendum not found');

    if (ref.status === 'PASSED' || ref.status === 'REJECTED' || ref.status === 'CANCELLED') {
      // Idempotent: closing a terminal referendum returns the existing row.
      return ref;
    }

    const isAdmin = actorRole === 'SUPER_ADMIN' || actorRole === 'MAYOR';
    if (!isAdmin) {
      throw new ForbiddenError('Only an admin or mayor can close a referendum');
    }

    // Move to CLOSED first so votes stop counting (defence-in-depth — the
    // service also rejects casts on a non-OPEN referendum).
    await prisma.referendum.update({
      where: { id: referendumId },
      data: { status: 'CLOSED' },
    });

    const result = await prisma.referendum.findUnique({ where: { id: referendumId } });
    if (!result) throw new NotFoundError('Referendum vanished');

    const decisive = result.yesCount + result.noCount;
    let finalStatus: 'PASSED' | 'REJECTED';
    if (decisive === 0 || result.totalVotes < result.minParticipation) {
      finalStatus = 'REJECTED'; // inconclusive counts as rejected
    } else {
      const yesRatio = result.yesCount / decisive;
      finalStatus = yesRatio >= result.passThreshold ? 'PASSED' : 'REJECTED';
    }

    return prisma.referendum.update({
      where: { id: referendumId },
      data: { status: finalStatus, decidedAt: new Date() },
    });
  },

  /** Get a list of votes cast on a referendum (admin / mayor / creator only). */
  async listVotes(referendumId: string) {
    return prisma.referendumVote.findMany({
      where: { referendumId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Has the current user already voted on this referendum? Returns the
   * choice (or null) so the UI can render a "You voted YES" badge without
   * a separate API round-trip.
   */
  async getMyVote(referendumId: string, userId: string) {
    return prisma.referendumVote.findUnique({
      where: { referendumId_userId: { referendumId, userId } },
    });
  },

  async delete(id: string, actorId: string, actorRole: Role) {
    const ref = await prisma.referendum.findUnique({ where: { id } });
    if (!ref) throw new NotFoundError('Referendum not found');
    const isAdmin = actorRole === 'SUPER_ADMIN';
    if (!isAdmin && ref.createdById !== actorId) {
      throw new ForbiddenError('Only the creator or an admin can delete a referendum');
    }
    // Don't allow deleting a referendum that already has votes
    const voteCount = await prisma.referendumVote.count({ where: { referendumId: id } });
    if (voteCount > 0) {
      throw new BadRequestError(
        `Cannot delete a referendum with ${voteCount} vote(s) — cancel it instead`,
        'BAD_REQUEST',
        { voteCount },
      );
    }
    await prisma.referendum.delete({ where: { id } });
    return { deleted: true };
  },
};
