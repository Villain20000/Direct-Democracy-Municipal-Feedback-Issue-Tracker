import { prisma } from '../db/client';
import { auditService } from './audit.service';
import { NotFoundError } from '../errors/domain-errors';

/**
 * B5 — Internal notes.
 * Staff-only annotations on an issue. The endpoint is mounted under
 * /api/v1/issues/:id/internal-notes and the route guard restricts
 * access to staff+. The list endpoint never returns notes to the
 * citizen-facing UI.
 */
export const internalNoteService = {
  async create(issueId: string, authorId: string, content: string) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    const note = await prisma.internalNote.create({
      data: { issueId, authorId, content },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    await auditService.log({
      userId: authorId,
      action: 'CREATE',
      entity: 'InternalNote',
      entityId: note.id,
      newValues: { issueId, content: content.slice(0, 100) },
    });

    return note;
  },

  async listForIssue(issueId: string) {
    return prisma.internalNote.findMany({
      where: { issueId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async delete(id: string, actorId: string) {
    const note = await prisma.internalNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundError('Internal note not found');
    await auditService.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'InternalNote',
      entityId: id,
      oldValues: { issueId: note.issueId },
    });
    await prisma.internalNote.delete({ where: { id } });
    return { deleted: true };
  },
};
