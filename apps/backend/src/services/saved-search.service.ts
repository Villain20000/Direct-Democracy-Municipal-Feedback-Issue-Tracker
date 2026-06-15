import { prisma } from '../db/client';
import { ForbiddenError, NotFoundError } from '../errors/domain-errors';

/**
 * B3 — Saved searches.
 * Persist a (name, filters) pair per user. Filters are an open JSON
 * object so the frontend can serialize its current query state without
 * us having to model every possible combination.
 */
export const savedSearchService = {
  async create(userId: string, data: { name: string; filters: Record<string, unknown> }) {
    return prisma.savedSearch.create({
      data: { userId, name: data.name, filters: data.filters as any },
    });
  },

  async listMine(userId: string) {
    return prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string, userId: string) {
    const saved = await prisma.savedSearch.findUnique({ where: { id } });
    if (!saved) throw new NotFoundError('Saved search not found');
    if (saved.userId !== userId) {
      throw new ForbiddenError('Not authorized to read this saved search');
    }
    return saved;
  },

  async update(
    id: string,
    userId: string,
    data: { name?: string; filters?: Record<string, unknown> },
  ) {
    const saved = await prisma.savedSearch.findUnique({ where: { id } });
    if (!saved) throw new NotFoundError('Saved search not found');
    if (saved.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this saved search');
    }
    return prisma.savedSearch.update({
      where: { id },
      data: {
        name: data.name,
        filters: data.filters as any,
      },
    });
  },

  async delete(id: string, userId: string) {
    const saved = await prisma.savedSearch.findUnique({ where: { id } });
    if (!saved) throw new NotFoundError('Saved search not found');
    if (saved.userId !== userId) {
      throw new ForbiddenError('Not authorized to delete this saved search');
    }
    await prisma.savedSearch.delete({ where: { id } });
    return { deleted: true };
  },
};
