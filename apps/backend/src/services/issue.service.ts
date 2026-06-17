import { prisma } from '../db/client';
import { cache } from '../cache/redis';
import { routingService } from './routing.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { embedText, toPgVectorLiteral } from './embedding.service';
import { spatialService } from './spatial.service';
import { issueSubscriptionService } from './issue-subscription.service';
import { slaTrackingService } from './sla-tracking.service';
import { issueAssignmentService, recordAssignChange } from './issue-assignment.service';
import { createHash } from 'crypto';
import { NotFoundError, BadRequestError } from '../errors/domain-errors';

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
    // Keep the PostGIS geometry column in sync with lat/lng. Fire
    // and forget — if this fails the issue is still created; the
    // next migration-rerun or a manual `syncGeomFromLatLng` will
    // catch up. Don't block the create on the spatial write.
    void spatialService.syncGeomFromLatLng(issue.id, data.latitude ?? null, data.longitude ?? null).catch((err) => {
      console.warn(`[issue.create] syncGeomFromLatLng failed for ${issue.id}:`, err.message);
    });
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
    if (!issue) throw new NotFoundError('Issue not found');

    await prisma.issue.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    await cache.set(cacheKey, issue, 120);
    return issue;
  },

  async updateStatus(id: string, newStatus: string, changedBy: string, note?: string) {
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundError('Issue not found');

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
    // Phase B1: fan out the same status change to every subscriber
    // (excluding the actor). Fire-and-forget — a fan-out failure
    // shouldn't fail the status update.
    void issueSubscriptionService
      .fanOutStatusChange(id, changedBy, newStatus, issue.title)
      .catch((err) => {
        console.warn(`[issue.updateStatus] subscription fan-out failed for ${id}:`, err.message);
      });
    // Phase B6: mark SLA first-response / resolution timestamps
    void slaTrackingService.markFirstResponse(id).catch(() => {});
    if (newStatus === 'RESOLVED' || newStatus === 'VERIFIED') {
      void slaTrackingService.markResolved(id).catch(() => {});
    }
    await cache.del(`issues:detail:${id}`);
    await cache.invalidatePattern('issues:stats');
    return updated;
  },

  async bulkUpdate(
    ids: string[],
    updates: {
      status?: string;
      assigneeId?: string;
      departmentId?: string;
      // Optional location refinement. When provided, the PostGIS
      // `location_geom` column is re-synced via `syncGeomFromLatLng`
      // so radius / polygon queries see the new pin position
      // immediately (not after the next migration-rerun). Either
      // field alone is accepted; callers usually send both together.
      latitude?: number;
      longitude?: number;
    },
    changedBy: string,
  ) {
    if (!ids.length) throw new BadRequestError('No issue IDs provided');
    if (ids.length > 100) throw new BadRequestError('Cannot update more than 100 issues at once');

    const results = [];
    for (const id of ids) {
      const issue = await prisma.issue.findUnique({ where: { id } });
      if (!issue) continue;

      const data: any = {};
      if (updates.assigneeId) data.assigneeId = updates.assigneeId;
      if (updates.departmentId) data.departmentId = updates.departmentId;
      if (updates.latitude !== undefined) data.latitude = updates.latitude;
      if (updates.longitude !== undefined) data.longitude = updates.longitude;
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

    // If the bulk update moved the pin, re-sync the PostGIS geometry
    // column for every affected issue. Fire-and-forget per-issue
    // (mirrors the create() pattern): a transient spatial write
    // failure shouldn't fail the bulk operation.
    //
    // We pass `updated.latitude` / `updated.longitude` (the values
    // Prisma just persisted for the row) rather than the raw
    // `updates.latitude ?? null` / `updates.longitude ?? null` —
    // `syncGeomFromLatLng` treats a `null` coordinate as "drop the
    // pin", so a partial update (caller sends only latitude) would
    // silently NULL the geometry. Reading from the merged row
    // guarantees we always pass a full (or both-null) pair.
    if (updates.latitude !== undefined || updates.longitude !== undefined) {
      for (const updated of results) {
        // The schema types the columns as `Decimal?` (Prisma's
        // `Decimal` class, not `number`), so we coerce via
        // `Number()` before handing them to the spatial helper
        // (which expects `number | null`). `Number(Prisma.Decimal)`
        // is safe — the class implements `valueOf()` returning the
        // JS number. The merged-row read (vs `updates.latitude ??
        // null`) guarantees we never pass a half-pair, which would
        // be treated by `syncGeomFromLatLng` as "drop the pin".
        const lat = updated.latitude == null ? null : Number(updated.latitude);
        const lng = updated.longitude == null ? null : Number(updated.longitude);
        void spatialService
          .syncGeomFromLatLng(updated.id, lat, lng)
          .catch((err) => {
            console.warn(
              `[issue.bulkUpdate] syncGeomFromLatLng failed for ${updated.id}:`,
              err.message,
            );
          });
      }
    }

    await cache.invalidatePattern('issues:stats');
    return results;
  },

  async assign(id: string, assigneeId: string, departmentId?: string, assignedBy?: string) {
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundError('Issue not found');

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
      // Phase B7: append to the assignment audit trail. Closes the
      // prior open row (if any) and creates a new one.
      void recordAssignChange(id, assigneeId, assignedBy).catch((err) => {
        console.warn(`[issue.assign] recordAssignChange failed for ${id}:`, err.message);
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

  /**
   * Semantic ("smart") search over the IssueEmbedding table. Powers the
   * smart search bar in the issue list. Falls back to plain text search
   * (the same `where: { title | description contains search }` used by
   * getAll) if the embedding call fails — the search bar should never be
   * totally broken just because Ollama is down.
   *
   * Caching: the result of each (query, topK, minScore) triple is cached
   * in Redis for `SEARCH_CACHE_TTL_SECONDS` (default 5 min). The cache
   * key is a SHA-256 of the canonicalized triple so different queries
   * don't collide and we never expose user input in the key. We DO NOT
   * cache text-fallback or text-empty results because:
   *   - text-fallback reads from the live issue table; we'd serve
   *     stale rows if an issue was just created.
   *   - text-empty is already the cheap case.
   *
   * The embed worker also calls `cache.invalidatePattern('search:')`
   * after each successful embed, so a freshly-embedded issue becomes
   * searchable within seconds (worst case = current TTL).
   *
   * Returns issues in similarity order (highest first), with a `score`
   * field (cosine similarity 0-1) attached to each row. The `mode` field
   * on the result tells the caller whether the semantic path or the
   * text fallback was used, so the UI can label the result accordingly.
   */
  async searchSimilar(
    text: string,
    topK: number = 5,
    minScore: number = 0.2,
  ): Promise<{
    data: Array<any & { score?: number }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    mode: 'semantic' | 'semantic-cached' | 'text-fallback' | 'text-empty';
    query: string;
  }> {
    const query = (text || '').trim();
    if (query.length < 3) {
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: topK,
        totalPages: 0,
        mode: 'text-empty',
        query,
      };
    }

    const k = Math.min(Math.max(1, topK), 20);
    const SEARCH_CACHE_TTL_SECONDS = 300; // 5 min

    // Cache key: SHA-256 of `query|topK|minScore`. Hashing means we
    // don't put user input directly in the key, which keeps the
    // keyspace bounded and avoids redis key-parsing quirks.
    const cacheKey = `search:semantic:${createHash('sha256')
      .update(`${query.toLowerCase()}|${k}|${minScore}`)
      .digest('hex')}`;

    const cached = await cache.get<{
      data: Array<any & { score?: number }>;
      total: number;
    }>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        total: cached.total,
        page: 1,
        pageSize: k,
        totalPages: 1,
        mode: 'semantic-cached',
        query,
      };
    }

    try {
      const queryVec = await embedText(query);
      const vecLiteral = toPgVectorLiteral(queryVec);

      // 1 - cosine_distance = cosine_similarity (0..1, higher = more similar).
      // Filter in SQL so we don't ship irrelevant rows to the app server.
      const rows = await prisma.$queryRaw<
        Array<{ id: string; title: string; score: number }>
      >`
        SELECT
          i."id",
          i."title",
          (1 - (e."embedding" <=> ${vecLiteral}::vector)) AS "score"
        FROM "IssueEmbedding" e
        JOIN "Issue" i ON i."id" = e."issueId"
        WHERE e."embedding" IS NOT NULL
          AND (1 - (e."embedding" <=> ${vecLiteral}::vector)) >= ${minScore}
        ORDER BY e."embedding" <=> ${vecLiteral}::vector
        LIMIT ${k}
      `;

      if (rows.length === 0) {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: k,
          totalPages: 0,
          mode: 'text-empty',
          query,
        };
      }

      // Hydrate the full issue rows in the same order as the similarity results.
      const ids = rows.map((r) => r.id);
      const issues = await prisma.issue.findMany({
        where: { id: { in: ids } },
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          department: { select: { id: true, name: true } },
          ward: { select: { id: true, name: true, code: true } },
          tags: { select: { tag: true } },
          _count: { select: { comments: true, votes: true } },
        },
      });
      const byId = new Map(issues.map((i) => [i.id, i]));
      const ordered = rows
        .map((r) => {
          const issue = byId.get(r.id);
          if (!issue) return null; // embedding row for a since-deleted issue
          return { ...issue, score: Number(r.score) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Cache the result so the next 50 citizens who search for
      // "σπασμένος σωλήνας" hit Redis instead of Ollama + pgvector.
      await cache.set(cacheKey, { data: ordered, total: ordered.length }, SEARCH_CACHE_TTL_SECONDS);

      return {
        data: ordered,
        total: ordered.length,
        page: 1,
        pageSize: k,
        totalPages: 1,
        mode: 'semantic',
        query,
      };
    } catch (err: any) {
      // Don't let an Ollama outage break the search bar. Fall back to
      // plain text matching so the user still gets useful results.
      console.warn(`[issue.searchSimilar] Semantic path failed, using text fallback: ${err.message}`);
      const fallback = await this.getAll({
        page: 1,
        pageSize: k,
        search: query,
      });
      return { ...fallback, mode: 'text-fallback', query };
    }
  },
};
