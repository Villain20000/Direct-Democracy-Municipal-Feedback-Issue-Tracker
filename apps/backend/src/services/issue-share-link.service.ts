import { prisma } from '../db/client';
import { randomBytes } from 'crypto';
import { NotFoundError } from '../errors/domain-errors';

/**
 * B2 — Issue share links.
 * Staff can mint a public, expiring URL token for any issue. The public
 * /share/:token endpoint returns a minimal, read-only view of the issue
 * without requiring auth.
 */
function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export const issueShareLinkService = {
  /** Mint a new share link. Optionally expires after `expiresInDays`. */
  async create(issueId: string, createdById: string, expiresInDays?: number) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    return prisma.issueShareLink.create({
      data: { issueId, createdById, token: generateToken(), expiresAt },
    });
  },

  /** Resolve a token to the underlying issue (public, no auth). */
  async resolve(token: string) {
    const link = await prisma.issueShareLink.findUnique({
      where: { token },
      include: {
        issue: {
          select: {
            id: true, title: true, description: true, category: true,
            status: true, location: true, createdAt: true, updatedAt: true,
            upvotes: true, viewCount: true, isPublic: true,
          },
        },
      },
    });
    if (!link) throw new NotFoundError('Share link not found or revoked');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new NotFoundError('Share link has expired');
    }
    if (!link.issue.isPublic) {
      throw new NotFoundError('Issue is not public');
    }

    // Bump view count fire-and-forget
    prisma.issue.update({
      where: { id: link.issueId },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    return link;
  },

  /** List all share links for an issue (staff only). */
  async listForIssue(issueId: string) {
    return prisma.issueShareLink.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Revoke a single share link. */
  async revoke(id: string) {
    try {
      await prisma.issueShareLink.delete({ where: { id } });
      return { revoked: true };
    } catch (err: any) {
      if (err.code === 'P2025') throw new NotFoundError('Share link not found');
      throw err;
    }
  },
};
