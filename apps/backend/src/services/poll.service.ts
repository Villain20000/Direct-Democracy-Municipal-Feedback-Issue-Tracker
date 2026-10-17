import { prisma } from '../db/client';
import {
  AlreadyClosedError,
  AlreadyVotedError,
  BadRequestError,
  NotFoundError,
} from '../errors/domain-errors';
import { notificationService } from './notification.service';

export const pollService = {
  async create(data: {
    title: string; description?: string; creatorId: string;
    options: string[]; closesAt?: string;
  }) {
    const poll = await prisma.poll.create({
      data: {
        title: data.title,
        description: data.description,
        creatorId: data.creatorId,
        closesAt: data.closesAt ? new Date(data.closesAt) : undefined,
        options: { create: data.options.map(text => ({ text })) },
      },
      include: { options: true },
    });
    return poll;
  },

  async getAll(params: { page?: number; pageSize?: number; activeOnly?: boolean }) {
    const { page = 1, pageSize = 20, activeOnly } = params;
    const where: any = {};
    if (activeOnly) where.isActive = true;

    const [data, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { options: true, _count: { select: { votes: true } } },
      }),
      prisma.poll.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const poll = await prisma.poll.findUnique({
      where: { id },
      include: {
        options: true,
        votes: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { votes: true } },
      },
    });
    if (!poll) throw new NotFoundError('Poll not found');
    return poll;
  },

  async vote(pollId: string, userId: string, optionId: string) {
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundError('Poll not found');
    if (!poll.isActive) throw new AlreadyClosedError('Poll is no longer active');

    const option = await prisma.pollOption.findUnique({ where: { id: optionId } });
    if (!option || option.pollId !== pollId) {
      throw new BadRequestError('Invalid option for this poll', 'BAD_REQUEST', {
        field: 'optionId',
        pollId,
      });
    }

    const existing = await prisma.vote.findUnique({
      where: { userId_pollId: { userId, pollId } },
    });

    if (existing) {
      // Already voted on this poll — cannot change vote
      throw new AlreadyVotedError('You have already voted on this poll', undefined);
    }

    await prisma.vote.create({ data: { value: 1, userId, pollId } });
    await prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } });

    // P1-13: a vote notifies the poll creator (VOTE_RECEIVED, email
    // throttled per poll per hour). Fire-and-forget.
    if (poll.creatorId !== userId) {
      void (async () => {
        try {
          const voter = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true },
          });
          const voterName = voter ? `${voter.firstName} ${voter.lastName}` : 'Someone';
          await notificationService.create(
            poll.creatorId,
            'VOTE_RECEIVED',
            'New vote on your poll',
            `${voterName} voted on "${poll.title}"`,
            { pollId },
            { sendEmail: true, emailThrottleMs: 60 * 60 * 1000, throttleKey: `VOTE_RECEIVED:poll:${pollId}` },
          );
        } catch (err: any) {
          console.warn(`[poll.vote] notify failed for ${pollId}:`, err.message);
        }
      })();
    }

    return this.getById(pollId);
  },

  async close(id: string) {
    return prisma.poll.update({ where: { id }, data: { isActive: false } });
  },

  async delete(id: string) {
    const poll = await prisma.poll.findUnique({ where: { id } });
    if (!poll) throw new NotFoundError('Poll not found');
    return prisma.poll.delete({ where: { id } });
  },
};
