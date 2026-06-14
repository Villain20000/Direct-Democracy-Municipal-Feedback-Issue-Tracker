import { prisma } from '../db/client';
import { cache } from '../cache/redis';
import { routingService } from './routing.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'priority', 'upvotes', 'status', 'title'] as const;

export const ISSUE_TEMPLATES = [
  { id: 'pothole', title: 'Pothole Report', description: 'There is a pothole on [street name] that is causing damage to vehicles. It has been present for [duration] and is growing larger.', category: 'INFRASTRUCTURE', location: '' },
  { id: 'streetlight', title: 'Broken Streetlight', description: 'Streetlight #[number] on [street] has been out for [duration]. The area is dark and feels unsafe at night.', category: 'INFRASTRUCTURE', location: '' },
  { id: 'illegal-dumping', title: 'Illegal Dumping', description: 'Someone has been dumping [type of waste] at [location]. This has been happening for [duration].', category: 'SANITATION', location: '' },
  { id: 'water-main', title: 'Water Main Break', description: 'Water is leaking from a broken water main at [location]. The street may be flooding.', category: 'UTILITIES', location: '' },
  { id: 'noise', title: 'Noise Complaint', description: 'Excessive noise from [source] at [location] during [hours]. This violates local noise ordinances.', category: 'OTHER', location: '' },
  { id: 'graffiti', title: 'Graffiti / Vandalism', description: 'Graffiti or vandalism has appeared at [location]. Please arrange for cleanup.', category: 'PUBLIC_SAFETY', location: '' },
  { id: 'sidewalk', title: 'Sidewalk Obstruction', description: 'A [tree branch / debris / object] is blocking the sidewalk at [location], making it inaccessible.', category: 'ENVIRONMENT', location: '' },
  { id: 'traffic', title: 'Traffic Safety Concern', description: 'There is a traffic safety issue at [intersection/location]. [Describe the hazard].', category: 'TRANSPORTATION', location: '' },
];

export const issueService = {
  getTemplates() {
    return ISSUE_TEMPLATES;
  },

  async create(data: {
    title: string; description: string; category: string;
    location: string; latitude?: number; longitude?: number;
    reporterId: string; wardId?: string; isPublic?: boolean;
  }) {
    const departmentId = await routingService.resolveDepartmentId(data.category);
    const issue = await prisma.issue.create({
      data: {
        ...data,
        category: data.category as any,
        departmentId,
        isPublic: data.isPublic ?? true,
      },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        ward: { select: { id: true, name: true, code: true } },
      },
    });
    await this.recordHistory(issue.id, null, 'SUBMITTED', data.reporterId);
    await auditService.log({
      userId: data.reporterId,
      action: 'CREATE',
      entity: 'Issue',
      entityId: issue.id,
      newValues: { title: issue.title, category: issue.category, departmentId },
    });
    await notificationService.create(
      data.reporterId,
      'ISSUE_STATUS_CHANGED',
      'Issue submitted',
      `Your report "${issue.title}" has been submitted and routed for review.`,
      { issueId: issue.id },
    );
    await cache.invalidatePattern('issues:stats');
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

    const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy as typeof ALLOWED_SORT_FIELDS[number])
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
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
    const cacheKey = `issues:detail:${id}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      await prisma.issue.update({ where: { id }, data: { viewCount: { increment: 1 } } });
      return { ...cached, viewCount: (cached.viewCount || 0) + 1 };
    }

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

    await prisma.issue.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    await cache.set(cacheKey, issue, 120);
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
    await auditService.log({
      userId: changedBy,
      action: 'UPDATE_STATUS',
      entity: 'Issue',
      entityId: id,
      oldValues: { status: issue.status },
      newValues: { status: newStatus, note },
    });
    if (issue.reporterId !== changedBy) {
      await notificationService.create(
        issue.reporterId,
        'ISSUE_STATUS_CHANGED',
        `Issue status: ${newStatus}`,
        `"${issue.title}" is now ${newStatus.replace(/_/g, ' ').toLowerCase()}.`,
        { issueId: id, status: newStatus },
        { sendEmail: true },
      );
    }
    await cache.del(`issues:detail:${id}`);
    await cache.invalidatePattern('issues:stats');
    return updated;
  },

  async bulkUpdate(ids: string[], updates: { status?: string; assigneeId?: string; departmentId?: string }, changedBy: string) {
    if (!ids.length) throw new Error('No issue IDs provided');
    if (ids.length > 100) throw new Error('Cannot update more than 100 issues at once');

    const results = [];
    for (const id of ids) {
      const issue = await prisma.issue.findUnique({ where: { id } });
      if (!issue) continue;

      const data: any = {};
      if (updates.assigneeId) data.assigneeId = updates.assigneeId;
      if (updates.departmentId) data.departmentId = updates.departmentId;
      if (updates.status) {
        data.status = updates.status;
        if (updates.status === 'RESOLVED') data.resolvedAt = new Date();
        await this.recordHistory(id, issue.status, updates.status, changedBy, 'Bulk update');
        await auditService.log({
          userId: changedBy,
          action: 'BULK_UPDATE',
          entity: 'Issue',
          entityId: id,
          oldValues: { status: issue.status },
          newValues: { status: updates.status },
        });
        if (issue.reporterId !== changedBy) {
          await notificationService.create(
            issue.reporterId,
            'ISSUE_STATUS_CHANGED',
            `Issue status: ${updates.status}`,
            `"${issue.title}" is now ${updates.status.replace(/_/g, ' ').toLowerCase()}.`,
            { issueId: id, status: updates.status },
          );
        }
      }

      const updated = await prisma.issue.update({ where: { id }, data });
      await cache.del(`issues:detail:${id}`);
      results.push(updated);
    }

    await cache.invalidatePattern('issues:stats');
    return results;
  },

  async assign(id: string, assigneeId: string, departmentId?: string, assignedBy?: string) {
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new Error('Issue not found');

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        assigneeId,
        ...(departmentId ? { departmentId } : {}),
        status: 'ACKNOWLEDGED',
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (assignedBy) {
      await this.recordHistory(id, issue.status, 'ACKNOWLEDGED', assignedBy, 'Issue assigned');
      await auditService.log({
        userId: assignedBy,
        action: 'ASSIGN',
        entity: 'Issue',
        entityId: id,
        newValues: { assigneeId, departmentId },
      });
    }

    await notificationService.create(
      assigneeId,
      'ISSUE_ASSIGNED',
      'New issue assigned',
      `You have been assigned: "${issue.title}"`,
      { issueId: id },
      { sendEmail: true },
    );
    if (issue.reporterId !== assigneeId) {
      await notificationService.create(
        issue.reporterId,
        'ISSUE_STATUS_CHANGED',
        'Issue acknowledged',
        `"${issue.title}" has been assigned to a staff member.`,
        { issueId: id },
      );
    }

    await cache.del(`issues:detail:${id}`);
    return updated;
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

  async getDepartmentResolutionRates() {
    const departments = await prisma.department.findMany({ select: { id: true, name: true } });
    return Promise.all(departments.map(async (dept) => {
      const [total, resolved] = await Promise.all([
        prisma.issue.count({ where: { departmentId: dept.id } }),
        prisma.issue.count({ where: { departmentId: dept.id, status: { in: ['RESOLVED', 'VERIFIED'] } } }),
      ]);
      return {
        department: dept.name,
        total,
        resolved,
        pct: total ? Math.round((resolved / total) * 100) : 0,
      };
    }));
  },

  async getStats(filters?: { departmentId?: string; wardId?: string }) {
    const cacheKey = `issues:stats:${JSON.stringify(filters || {})}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) return cached;

    const where = filters || {};
    const [
      totalIssues, openIssues, resolvedIssues,
      byCategory, byStatus, recentIssues,
      resolvedWithDates, totalUsers,
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
      prisma.issue.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.user.count(),
    ]);

    const avgResolutionTimeDays = resolvedWithDates.length
      ? resolvedWithDates.reduce((sum, issue) => {
          const days = (issue.resolvedAt!.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / resolvedWithDates.length
      : 0;

    const stats = {
      totalIssues, openIssues, resolvedIssues,
      avgResolutionTimeDays: Math.round(avgResolutionTimeDays * 10) / 10,
      totalUsers,
      issuesByCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      issuesByStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      recentIssues,
    };
    await cache.set(cacheKey, stats, 300);
    return stats;
  },

  async recordHistory(issueId: string, oldStatus: string | null, newStatus: string, changedBy: string, note?: string) {
    return prisma.statusHistory.create({
      data: { issueId, oldStatus, newStatus, changedBy, note },
    });
  },
};
