import { prisma } from '../db/client';

export const issueService = {
  async create(data: {
    title: string; description: string; category: string;
    location: string; latitude?: number; longitude?: number;
    reporterId: string; wardId?: string; isPublic?: boolean;
  }) {
    const issue = await prisma.issue.create({
      data: {
        ...data,
        category: data.category as any,
        isPublic: data.isPublic ?? true,
      },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        ward: { select: { id: true, name: true, code: true } },
      },
    });
    await this.recordHistory(issue.id, null, 'SUBMITTED', data.reporterId);
    return issue;
  },

  async getAll(params: {
    page?: number; pageSize?: number; status?: string;
    category?: string; departmentId?: string; wardId?: string;
    reporterId?: string; assigneeId?: string; search?: string;
    sortBy?: string; sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1, pageSize = 20, status, category,
      departmentId, wardId, reporterId, assigneeId,
      search, sortBy = 'createdAt', sortOrder = 'desc',
    } = params;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;
    if (wardId) where.wardId = wardId;
    if (reporterId) where.reporterId = reporterId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          department: { select: { id: true, name: true } },
          ward: { select: { id: true, name: true, code: true } },
          tags: { select: { tag: true } },
          _count: { select: { comments: true, votes: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        department: true,
        ward: true,
        comments: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: true,
        tags: { select: { tag: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!issue) throw new Error('Issue not found');

    // Increment view count
    await prisma.issue.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return issue;
  },

  async updateStatus(id: string, newStatus: string, changedBy: string, note?: string) {
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new Error('Issue not found');

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        status: newStatus as any,
        ...(newStatus === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });
    await this.recordHistory(id, issue.status, newStatus, changedBy, note);
    return updated;
  },

  async assign(id: string, assigneeId: string, departmentId?: string) {
    return prisma.issue.update({
      where: { id },
      data: {
        assigneeId,
        ...(departmentId ? { departmentId } : {}),
        status: 'ACKNOWLEDGED',
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async upvote(id: string, userId: string) {
    const existing = await prisma.vote.findUnique({
      where: { userId_issueId: { userId, issueId: id } },
    });

    if (existing) {
      await prisma.vote.delete({ where: { id: existing.id } });
      await prisma.issue.update({ where: { id }, data: { upvotes: { decrement: 1 } } });
      return { voted: false };
    } else {
      await prisma.vote.create({ data: { value: 1, userId, issueId: id } });
      await prisma.issue.update({ where: { id }, data: { upvotes: { increment: 1 } } });
      return { voted: true };
    }
  },

  async getStats(filters?: { departmentId?: string; wardId?: string }) {
    const where = filters || {};
    const [
      totalIssues, openIssues, resolvedIssues,
      byCategory, byStatus, recentIssues,
    ] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.count({ where: { ...where, status: { notIn: ['RESOLVED', 'VERIFIED', 'REJECTED'] } } }),
      prisma.issue.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.issue.groupBy({ by: ['category'], _count: true, where }),
      prisma.issue.groupBy({ by: ['status'], _count: true, where }),
      prisma.issue.findMany({
        where, take: 10, orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return {
      totalIssues, openIssues, resolvedIssues,
      issuesByCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      issuesByStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      recentIssues,
    };
  },

  async recordHistory(issueId: string, oldStatus: string | null, newStatus: string, changedBy: string, note?: string) {
    return prisma.statusHistory.create({
      data: { issueId, oldStatus, newStatus, changedBy, note },
    });
  },
};
