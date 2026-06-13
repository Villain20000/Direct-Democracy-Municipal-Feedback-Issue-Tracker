import { prisma } from '../db/client';

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
    if (!resolution) throw new Error('Resolution not found');
    return resolution;
  },

  async updateStatus(id: string, status: string) {
    const resolution = await prisma.resolution.findUnique({ where: { id } });
    if (!resolution) throw new Error('Resolution not found');

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
    if (!resolution) throw new Error('Resolution not found');
    if (resolution.status !== 'VOTING') throw new Error('Resolution is not in voting status');

    const alreadyVoted = resolution.votedByIds.includes(userId);
    if (alreadyVoted) throw new Error('You have already voted on this resolution');

    return prisma.resolution.update({
      where: { id },
      data: {
        votesFor: voteFor ? { increment: 1 } : undefined,
        votesAgainst: !voteFor ? { increment: 1 } : undefined,
        votedByIds: { push: userId },
      },
    });
  },

  async delete(id: string) {
    const resolution = await prisma.resolution.findUnique({ where: { id } });
    if (!resolution) throw new Error('Resolution not found');
    return prisma.resolution.delete({ where: { id } });
  },
};
