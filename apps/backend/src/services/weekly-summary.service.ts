/**
 * Phase C — Weekly summary service.
 *
 * Generates an executive briefing for a calendar week (Mon–Sun) by:
 *   1. Aggregating issue stats for the week (new, resolved, by category, by department).
 *   2. Asking Ollama (gemma2:2b) to produce a `body` paragraph + a list
 *      of `highlights` bullets.
 *   3. Persisting the result keyed by ISO weekKey (e.g. `2026-W24`) so
 *      the Friday cron + on-demand calls are both idempotent.
 *
 * Failure modes:
 *   - If Ollama is down, the row is still written with a deterministic
 *     fallback body so the dashboard never shows a broken state.
 *   - If the week already has a row, `generate()` returns the existing
 *     one unless `force: true` is passed.
 */
import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';
import { aiService } from '../ai/ollama.service';
import { config } from '../config';
import { BadRequestError } from '../errors/domain-errors';

/** ISO-8601 week-of-year key, e.g. `2026-W24`. Matches the @unique index. */
export function getCurrentWeekKey(now: Date = new Date()): string {
  // ISO week: week 1 is the week containing the first Thursday of the year.
  // Copy the date so we don't mutate the original.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Day of week, Mon = 1 … Sun = 7
  const dayNum = (d.getUTCDay() + 6) % 7 + 1;
  // Set to nearest Thursday: current date + 4 - current day number
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Returns Monday 00:00 and Sunday 23:59:59 for the week containing `now`. */
export function getWeekRange(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  // Anchor to the start of the UTC day
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (start.getUTCDay() + 6) % 7; // Mon = 0, Sun = 6
  start.setUTCDate(start.getUTCDate() - dayNum); // back to Monday
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 7); // exclusive end
  return { weekStart: start, weekEnd: end };
}

export const weeklySummaryService = {
  getCurrentWeekKey,
  getWeekRange,

  /** Parse "2026-W24" back to a Date range. */
  parseWeekKey(weekKey: string): { weekStart: Date; weekEnd: Date } {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
    if (!match) throw new BadRequestError(`Invalid weekKey: ${weekKey}`);
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    // Jan 4 is always in week 1 (ISO)
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4DayNum = (jan4.getUTCDay() + 6) % 7; // Mon = 0
    const week1Monday = new Date(jan4.getTime() - jan4DayNum * 86400000);
    const weekStart = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    return { weekStart, weekEnd };
  },

  /**
   * Aggregate the issue counts and touch-points for a week. Pulls every
   * issue whose `createdAt` or `resolvedAt` falls inside [start, end).
   */
  async aggregateStats(start: Date, end: Date) {
    const [
      newCount,
      resolvedCount,
      byCategory,
      byDepartment,
      byStatus,
      averageResolutionDays,
    ] = await Promise.all([
      prisma.issue.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.issue.count({ where: { resolvedAt: { gte: start, lt: end } } }),
      prisma.issue.groupBy({
        by: ['category'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      prisma.issue.groupBy({
        by: ['departmentId'],
        where: {
          createdAt: { gte: start, lt: end },
          departmentId: { not: null },
        },
        _count: true,
      }),
      prisma.issue.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      this.computeAverageResolutionDays(start, end),
    ]);

    // Hydrate department names in one query
    const deptIds = byDepartment
      .map(d => d.departmentId)
      .filter((id): id is string => Boolean(id));
    const departments = deptIds.length
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];
    const deptNameById = new Map(departments.map(d => [d.id, d.name]));

    return {
      newCount,
      resolvedCount,
      averageResolutionDays,
      byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      byDepartment: Object.fromEntries(
        byDepartment.map(d => [deptNameById.get(d.departmentId!) || d.departmentId, d._count]),
      ),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
    };
  },

  async computeAverageResolutionDays(start: Date, end: Date): Promise<number> {
    const rows = await prisma.issue.findMany({
      where: { resolvedAt: { gte: start, lt: end }, createdAt: { gte: start, lt: end } },
      select: { createdAt: true, resolvedAt: true },
    });
    if (!rows.length) return 0;
    const total = rows.reduce((sum, r) => {
      const ms = r.resolvedAt!.getTime() - r.createdAt.getTime();
      return sum + ms / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round((total / rows.length) * 10) / 10;
  },

  /** Top N most-discussed (by comment count) issues touched this week. */
  async getTouchedIssues(start: Date, end: Date, limit = 10) {
    return prisma.issue.findMany({
      where: {
        OR: [
          { createdAt: { gte: start, lt: end } },
          { resolvedAt: { gte: start, lt: end } },
          { updatedAt: { gte: start, lt: end } },
        ],
      },
      select: {
        id: true, title: true, category: true, status: true, priority: true,
        createdAt: true, resolvedAt: true,
        _count: { select: { comments: true, votes: true } },
      },
      orderBy: [{ comments: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: limit,
    });
  },

  /** Compose the body via Ollama; fall back to a deterministic template. */
  async generateBody(stats: Awaited<ReturnType<typeof this.aggregateStats>>): Promise<string> {
    try {
      const prompt =
        `You are the mayor's chief of staff writing a Friday executive briefing.\n` +
        `This week's municipal activity (write 3-5 sentences, factual, no hype):\n` +
        `- New issues reported: ${stats.newCount}\n` +
        `- Issues resolved: ${stats.resolvedCount}\n` +
        `- Average resolution time (days): ${stats.averageResolutionDays}\n` +
        `- Top categories: ${Object.entries(stats.byCategory).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'}\n` +
        `- Top departments: ${Object.entries(stats.byDepartment).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'}`;
      const body = await aiService.chat([
        { role: 'user', content: prompt },
      ]);
      if (typeof body === 'string' && body.trim().length > 20) return body.trim();
      throw new Error('AI returned empty body');
    } catch (err: any) {
      console.warn(`[weeklySummary.generateBody] AI failed, using fallback: ${err.message}`);
      return (
        `This week saw ${stats.newCount} new issues reported and ${stats.resolvedCount} resolved ` +
        `(avg ${stats.averageResolutionDays} day(s) to close). ` +
        `Top categories: ${
          Object.entries(stats.byCategory)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([k, v]) => `${k} (${v})`)
            .join(', ') || 'none'
        }.`
      );
    }
  },

  /** Compose 3-5 highlight cards; JSON parse with a graceful fallback. */
  async generateHighlights(
    stats: Awaited<ReturnType<typeof this.aggregateStats>>,
    touchedIssues: Array<{ id: string; title: string; category: string; status: string }>,
  ): Promise<{ title: string; body: string }[]> {
    try {
      const issueList = touchedIssues
        .slice(0, 5)
        .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title} (${i.status})`)
        .join('\n');
      const response = await aiService.chat([
        {
          role: 'user',
          content:
            `Given these municipal stats and the most-discussed issues, produce 3-5 short highlight cards ` +
            `as JSON. Each card: { "title": "≤8 words", "body": "≤30 words" }. ` +
            `Stats: ${JSON.stringify(stats)}. ` +
            `Top issues: ${issueList || 'none'}. ` +
            `Output ONLY valid JSON in the form {"highlights":[{...}, ...]}.`,
        },
      ]);
      const text = typeof response === 'string' ? response : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.highlights)) {
          return parsed.highlights
            .filter((h: any) => h && typeof h.title === 'string' && typeof h.body === 'string')
            .slice(0, 5)
            .map((h: any) => ({ title: h.title, body: h.body }));
        }
      }
      throw new Error('AI returned no parseable highlights');
    } catch (err: any) {
      console.warn(`[weeklySummary.generateHighlights] AI failed, using fallback: ${err.message}`);
      // Deterministic fallback: top-3 categories as bullets
      return Object.entries(stats.byCategory)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 3)
        .map(([cat, count]) => ({
          title: `${cat} activity`,
          body: `${count} new ${cat.toLowerCase()} issue(s) reported this week.`,
        }));
    }
  },

  /**
   * Generate (or fetch) the summary for `weekKey`. Idempotent: returns
   * the existing row unless `force: true`.
   */
  async generate(weekKey: string, options: { force?: boolean; source?: 'AUTO' | 'MANUAL' } = {}) {
    if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
      throw new BadRequestError(`Invalid weekKey: ${weekKey}`);
    }
    const existing = await prisma.weeklySummary.findUnique({ where: { weekKey } });
    if (existing && !options.force) return { row: existing, created: false };

    const { weekStart, weekEnd } = this.parseWeekKey(weekKey);
    const [stats, touchedIssues] = await Promise.all([
      this.aggregateStats(weekStart, weekEnd),
      this.getTouchedIssues(weekStart, weekEnd, 10),
    ]);
    const [body, highlights] = await Promise.all([
      this.generateBody(stats),
      this.generateHighlights(stats, touchedIssues),
    ]);

    const data = {
      weekKey,
      weekStart,
      weekEnd,
      stats: stats as unknown as Prisma.InputJsonValue,
      highlights: highlights as unknown as Prisma.InputJsonValue,
      body,
      issueIds: touchedIssues.map(i => i.id),
      source: (options.source || 'MANUAL') as 'AUTO' | 'MANUAL',
    };

    const row = await prisma.weeklySummary.upsert({
      where: { weekKey },
      create: data,
      update: data,
    });
    return { row, created: true };
  },

  /** Convenience: generate the current week (used by the Friday cron). */
  async generateCurrent(source: 'AUTO' | 'MANUAL' = 'AUTO') {
    const weekKey = this.getCurrentWeekKey();
    return this.generate(weekKey, { source });
  },

  /** Latest row, or null. */
  async getLatest() {
    return prisma.weeklySummary.findFirst({ orderBy: { weekStart: 'desc' } });
  },

  async getByWeekKey(weekKey: string) {
    return prisma.weeklySummary.findUnique({ where: { weekKey } });
  },

  async list(params: { page?: number; pageSize?: number } = {}) {
    const { page = 1, pageSize = 20 } = params;
    const [data, total] = await Promise.all([
      prisma.weeklySummary.findMany({
        orderBy: { weekStart: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.weeklySummary.count(),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  /** Delete a summary row (admin only). Used for regenerations. */
  async delete(weekKey: string) {
    try {
      await prisma.weeklySummary.delete({ where: { weekKey } });
      return { deleted: true };
    } catch (err: any) {
      if (err.code === 'P2025') return { deleted: false };
      throw err;
    }
  },
};

export type WeeklySummaryService = typeof weeklySummaryService;
// Suppress unused-import warning when this file is read in isolation
void config;
