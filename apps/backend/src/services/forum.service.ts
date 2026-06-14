import { prisma } from '../db/client';

export const forumService = {
  async create(data: { title: string; description?: string; creatorId: string }) {
    return prisma.forum.create({
      data,
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { posts: true } },
      },
    });
  },

  async getAll(params: { page?: number; pageSize?: number; activeOnly?: boolean }) {
    const { page = 1, pageSize = 20, activeOnly } = params;
    const where: any = {};
    if (activeOnly) where.isActive = true;

    const [data, total] = await Promise.all([
      prisma.forum.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          posts: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forum.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const forum = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        posts: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        },
      },
    });
    if (!forum) throw new Error('Forum not found');
    return forum;
  },

  async addPost(forumId: string, authorId: string, content: string) {
    const forum = await prisma.forum.findUnique({ where: { id: forumId } });
    if (!forum) throw new Error('Forum not found');
    if (!forum.isActive) throw new Error('Forum is closed');

    const [post] = await prisma.$transaction([
      prisma.forumPost.create({
        data: { forumId, authorId, content },
        include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      prisma.forum.update({ where: { id: forumId }, data: { updatedAt: new Date() } }),
    ]);
    return post;
  },

  async close(id: string) {
    return prisma.forum.update({ where: { id }, data: { isActive: false } });
  },
};