/**
 * Phase D2 — Transparency Portal service.
 *
 * Aggregates publicly-visible data (no auth required) for the
 * /api/v1/portal/* endpoints. Everything exposed here respects the
 * `isPublic` flag on Issues + the publishedAt filter on Announcements +
 * the OPEN/PASSED filter on Referendums.
 *
 * Designed to be cheap to call: a single round-trip for the dashboard
 * widget, a separate call for each list view. Cache-friendly: no
 * per-user state.
 */
import { prisma } from '../db/client';

export const portalService = {
  /**
   * Top-line summary stats: total public issues, resolved, by status,
   * by category, by department, plus active referendum count + upcoming
   * event count.
   */
  async getStats() {
    const [
      totalIssues,
      resolvedIssues,
      byStatus,
      byCategory,
      byDepartmentRaw,
      activeReferendums,
      upcomingEvents,
      recentIssuesCount,
      departments,
      wards,
    ] = await Promise.all([
      prisma.issue.count({ where: { isPublic: true } }),
      prisma.issue.count({ where: { isPublic: true, status: { in: ['RESOLVED', 'VERIFIED'] } } }),
      prisma.issue.groupBy({ by: ['status'], _count: true, where: { isPublic: true } }),
      prisma.issue.groupBy({ by: ['category'], _count: true, where: { isPublic: true } }),
      prisma.issue.groupBy({
        by: ['departmentId'],
        where: { isPublic: true, departmentId: { not: null } },
        _count: true,
      }),
      prisma.referendum.count({ where: { status: { in: ['OPEN', 'PASSED'] } } }),
      prisma.event.count({
        where: {
          isPublic: true,
          startTime: { gte: new Date() },
        },
      }),
      prisma.issue.count({
        where: { isPublic: true, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.department.count(),
      prisma.ward.count(),
    ]);

    // Hydrate department names for the chart-friendly payload
    const deptIds = byDepartmentRaw
      .map(d => d.departmentId)
      .filter((id): id is string => Boolean(id));
    const deptRows = deptIds.length
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];
    const deptName = new Map(deptRows.map(d => [d.id, d.name]));

    return {
      totalIssues,
      resolvedIssues,
      openIssues: totalIssues - resolvedIssues,
      resolutionRate: totalIssues ? Math.round((resolvedIssues / totalIssues) * 100) : 0,
      recentIssuesCount,
      activeReferendums,
      upcomingEvents,
      totalDepartments: departments,
      totalWards: wards,
      issuesByStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      issuesByCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      issuesByDepartment: Object.fromEntries(
        byDepartmentRaw.map(d => [deptName.get(d.departmentId!) || d.departmentId, d._count]),
      ),
    };
  },

  /** Paginated list of public issues, newest first. No auth. */
  async listPublicIssues(params: { page?: number; pageSize?: number; category?: string; status?: string } = {}) {
    const { page = 1, pageSize = 20, category, status } = params;
    const where: any = { isPublic: true };
    if (category) where.category = category;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, description: true, category: true, status: true,
          location: true, latitude: true, longitude: true,
          upvotes: true, viewCount: true, createdAt: true, resolvedAt: true,
          department: { select: { id: true, name: true } },
          ward: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  /** Recent public issues for the portal landing widget. */
  async getRecentPublicIssues(limit = 10) {
    return prisma.issue.findMany({
      where: { isPublic: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, category: true, status: true, location: true,
        createdAt: true, upvotes: true,
        department: { select: { id: true, name: true } },
      },
    });
  },

  /** Most upvoted public issues (proxy for "what the city is focusing on"). */
  async getTopIssues(limit = 10) {
    // Show only "live" issues — those the city is still actively working on.
    // Excludes RESOLVED / VERIFIED (closed) and REJECTED (won't fix).
    return prisma.issue.findMany({
      where: {
        isPublic: true,
        status: { in: ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'REOPENED'] },
      },
      take: limit,
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, category: true, status: true, location: true,
        upvotes: true, createdAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  },

  /** All departments with budget totals + open issue counts. */
  async getDepartmentBreakdown() {
    const departments = await prisma.department.findMany({
      select: {
        id: true, name: true, code: true, description: true, budget: true,
        head: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { name: 'asc' },
    });
    const issueCounts = await prisma.issue.groupBy({
      by: ['departmentId'],
      where: { isPublic: true, departmentId: { not: null } },
      _count: { _all: true },
    });
    const resolvedCounts = await prisma.issue.groupBy({
      by: ['departmentId'],
      where: { isPublic: true, departmentId: { not: null }, status: { in: ['RESOLVED', 'VERIFIED'] } },
      _count: { _all: true },
    });
    const totalByDept = new Map(issueCounts.map(c => [c.departmentId, c._count._all]));
    const resolvedByDept = new Map(resolvedCounts.map(c => [c.departmentId, c._count._all]));

    return departments.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      budget: d.budget ? Number(d.budget) : null,
      head: d.head,
      totalIssues: totalByDept.get(d.id) || 0,
      resolvedIssues: resolvedByDept.get(d.id) || 0,
    }));
  },

  /** All wards + their public issue counts. */
  async getWardsWithCounts() {
    const wards = await prisma.ward.findMany({
      select: { id: true, name: true, code: true, description: true },
      orderBy: { name: 'asc' },
    });
    const issueCounts = await prisma.issue.groupBy({
      by: ['wardId'],
      where: { isPublic: true, wardId: { not: null } },
      _count: { _all: true },
    });
    const totalByWard = new Map(issueCounts.map(c => [c.wardId, c._count._all]));

    return wards.map(w => ({
      ...w,
      totalIssues: totalByWard.get(w.id) || 0,
    }));
  },

  /**
   * "Meeting minutes" — the closest analogue in the schema is the
   * Event model (COUNCIL_MEETING, PUBLIC_HEARING, TOWN_HALL). We expose
   * past public events + their RSVPs as a lightweight meeting record.
   */
  async getRecentMeetings(limit = 20) {
    return prisma.event.findMany({
      where: {
        isPublic: true,
        type: { in: ['COUNCIL_MEETING', 'PUBLIC_HEARING', 'TOWN_HALL'] },
        endTime: { lt: new Date() },
      },
      take: limit,
      orderBy: { startTime: 'desc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { rsvps: true } },
      },
    });
  },

  /** Upcoming public events (any type, not just meetings). */
  async getUpcomingEvents(limit = 10) {
    return prisma.event.findMany({
      where: {
        isPublic: true,
        startTime: { gte: new Date() },
      },
      take: limit,
      orderBy: { startTime: 'asc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { rsvps: true } },
      },
    });
  },

  /** Public announcements (published only). */
  async getAnnouncements(limit = 20) {
    return prisma.announcement.findMany({
      where: { publishedAt: { not: null } },
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  /**
   * "Active" referendums (OPEN + recently-PASSED for the result).
   * Public read; the public cannot see who's voting for what, only the
   * tallies.
   */
  async getActiveReferendums(limit = 10) {
    return prisma.referendum.findMany({
      where: { status: { in: ['OPEN', 'CLOSED', 'PASSED', 'REJECTED'] } },
      take: limit,
      orderBy: [{ status: 'asc' }, { closesAt: 'desc' }],
      select: {
        id: true, title: true, description: true, body: true,
        status: true, opensAt: true, closesAt: true,
        passThreshold: true, minParticipation: true,
        yesCount: true, noCount: true, abstainCount: true, totalVotes: true,
        decidedAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  /** Recent resolutions. */
  async getRecentResolutions(limit = 20) {
    return prisma.resolution.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },
};
