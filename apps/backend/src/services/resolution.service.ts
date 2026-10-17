import { prisma } from '../db/client';
import {
  AlreadyVotedError,
  BadRequestError,
  NotFoundError,
} from '../errors/domain-errors';
import { notificationService } from './notification.service';

export const resolutionService = {
  async create(data: {
    title: string; description: string; proposedById: string; issueId?: string;
  }) {
    return prisma.resolution.create({
      data: { ...data, status: 'DRAFT' },
      include: { proposedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async getAll(params: { page?: number; pageSize?: number; status?: string }) {
    const { page = 1, pageSize = 20, status } = params;
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.resolution.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { proposedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.resolution.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const resolution = await prisma.resolution.findUnique({
      where: { id },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!resolution) throw new NotFoundError('Resolution not found');
    return resolution;
  },

  async updateStatus(id: string, status: string) {
    const resolution = await prisma.resolution.findUnique({ where: { id } });
    if (!resolution) throw new NotFoundError('Resolution not found');

    return prisma.resolution.update({
      where: { id },
      data: {
        status,
        ...(status === 'PASSED' || status === 'REJECTED' ? { decidedAt: new Date() } : {}),
      },
    });
  },

  async vote(id: string, userId: string, voteFor: boolean) {
    const resolution = await prisma.resolution.findUnique({ where: { id } });
    if (!resolution) throw new NotFoundError('Resolution not found');
    if (resolution.status !== 'VOTING') {
      throw new BadRequestError(
        `Resolution is not in voting status (current: ${resolution.status})`,
        'BAD_REQUEST',
        { currentStatus: resolution.status, expected: 'VOTING' },
      );
    }

    const alreadyVoted = resolution.votedByIds.includes(userId);
    if (alreadyVoted) throw new AlreadyVotedError('You have already voted on this resolution');

    const updated = await prisma.resolution.update({
      where: { id },
      data: {
        votesFor: voteFor ? { increment: 1 } : undefined,
        votesAgainst: !voteFor ? { increment: 1 } : undefined,
        votedByIds: { push: userId },
      },
    });

    // P1-13: a vote notifies the proposer (VOTE_RECEIVED, email
    // throttled per resolution per hour). Fire-and-forget.
    if (resolution.proposedById !== userId) {
      void (async () => {
        try {
          const voter = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true },
          });
          const voterName = voter ? `${voter.firstName} ${voter.lastName}` : 'Someone';
          await notificationService.create(
            resolution.proposedById,
            'VOTE_RECEIVED',
            'New vote on your resolution',
            `${voterName} voted ${voteFor ? 'for' : 'against'} "${resolution.title}"`,
            { resolutionId: id },
            { sendEmail: true, emailThrottleMs: 60 * 60 * 1000, throttleKey: `VOTE_RECEIVED:resolution:${id}` },
          );
        } catch (err: any) {
          console.warn(`[resolution.vote] notify failed for ${id}:`, err.message);
        }
      })();
    }

    return updated;
  },

  async delete(id: string) {
    const resolution = await prisma.resolution.findUnique({ where: { id } });
    if (!resolution) throw new NotFoundError('Resolution not found');
    return prisma.resolution.delete({ where: { id } });
  },
};
