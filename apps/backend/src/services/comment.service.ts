import { prisma } from '../db/client';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/domain-errors';

/**
 * Extract @mention tokens from comment text. Matches @email,
 * @email-prefix, and @FirstName/@LastName single tokens
 * (e.g. "@john", "@maria.pap").
 */
export function extractMentionTokens(content: string): string[] {
  const tokens = new Set<string>();
  const re = /@([A-Za-z0-9._-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1].length >= 2) tokens.add(m[1]);
    if (tokens.size >= 10) break;
  }
  return [...tokens];
}

export const commentService = {
  async create(data: { content: string; userId: string; issueId: string; parentId?: string }) {
    const issue = await prisma.issue.findUnique({
      where: { id: data.issueId },
      select: { id: true, title: true, reporterId: true, assigneeId: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    // P1-12: two-level threads only. A reply must target a top-level
    // comment on the same issue — replying to a reply is rejected.
    if (data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.issueId !== data.issueId) {
        throw new BadRequestError('Parent comment not found on this issue');
      }
      if (parent.parentId) {
        throw new BadRequestError('Replies are limited to two levels');
      }
    }

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

    // P1-12 @mentions: resolve each @token to a user (email, email
    // prefix, first or last name, case-insensitive) and emit
    // ISSUE_MENTION. Prefs are honoured inside `create()`; email goes
    // out when the mentioned user opted in.
    const tokens = extractMentionTokens(data.content);
    if (tokens.length > 0) {
      const mentioned = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: tokens.flatMap(tok => [
            { email: { equals: tok, mode: 'insensitive' as const } },
            { email: { startsWith: `${tok}@`, mode: 'insensitive' as const } },
            { firstName: { equals: tok, mode: 'insensitive' as const } },
            { lastName: { equals: tok, mode: 'insensitive' as const } },
          ]),
        },
        select: { id: true },
      });
      const mentionIds = [...new Set(mentioned.map(u => u.id))].filter(
        uid => uid !== data.userId,
      );
      await Promise.all(mentionIds.map(uid =>
        notificationService.create(
          uid,
          'ISSUE_MENTION',
          'You were mentioned',
          `${authorName} mentioned you in a comment on "${issue.title}"`,
          { issueId: issue.id, commentId: comment.id },
          { sendEmail: true },
        )
      ));
    }

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