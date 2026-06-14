import { prisma } from '../db/client';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { ForbiddenError, NotFoundError } from '../errors/domain-errors';

export const commentService = {
  async create(data: { content: string; userId: string; issueId: string; parentId?: string }) {
    const issue = await prisma.issue.findUnique({
      where: { id: data.issueId },
      select: { id: true, title: true, reporterId: true, assigneeId: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    const comment = await prisma.comment.create({
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await auditService.log({
      userId: data.userId,
      action: 'CREATE',
      entity: 'Comment',
      entityId: comment.id,
      newValues: { issueId: data.issueId, content: data.content.slice(0, 100) },
    });

    const notifyIds = new Set<string>();
    if (issue.reporterId !== data.userId) notifyIds.add(issue.reporterId);
    if (issue.assigneeId && issue.assigneeId !== data.userId) notifyIds.add(issue.assigneeId);

    const authorName = `${comment.user.firstName} ${comment.user.lastName}`;
    await Promise.all([...notifyIds].map(userId =>
      notificationService.create(
        userId,
        'ISSUE_COMMENT',
        'New comment on your issue',
        `${authorName} commented on "${issue.title}"`,
        { issueId: issue.id, commentId: comment.id },
        { sendEmail: userId === issue.reporterId },
      )
    ));

    return comment;
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
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.userId !== userId) {
      throw new ForbiddenError('Not authorized to delete this comment', {
        resourceOwnerId: comment.userId,
      });
    }
    await auditService.log({
      userId,
      action: 'DELETE',
      entity: 'Comment',
      entityId: id,
      oldValues: { issueId: comment.issueId },
    });
    return prisma.comment.delete({ where: { id } });
  },
};