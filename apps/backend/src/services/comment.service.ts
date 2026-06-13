import { prisma } from '../db/client';

export const commentService = {
  async create(data: { content: string; userId: string; issueId: string; parentId?: string }) {
    return prisma.comment.create({
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
  },

  async getByIssue(issueId: string, params?: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 50 } = params || {};

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where: { issueId, parentId: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          children: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.comment.count({ where: { issueId, parentId: null } }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async delete(id: string, userId: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId) throw new Error('Not authorized to delete this comment');
    return prisma.comment.delete({ where: { id } });
  },
};
