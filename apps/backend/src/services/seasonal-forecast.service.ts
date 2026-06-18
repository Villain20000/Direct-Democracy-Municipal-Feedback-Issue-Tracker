import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';

function currentMonthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export const seasonalForecastService = {
  getCurrentMonthKey() {
    return currentMonthKey();
  },

  async getLatest() {
    return prisma.seasonalForecast.findFirst({ orderBy: { generatedAt: 'desc' } });
  },

  async aggregateMonthlyStats(monthsBack = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);

    const issues = await prisma.issue.findMany({
      where: { createdAt: { gte: since } },
      select: { category: true, createdAt: true, wardId: true },
    });

    const byMonthCategory: Record<string, Record<string, number>> = {};
    for (const issue of issues) {
      const month = issue.createdAt.toISOString().slice(0, 7);
      if (!byMonthCategory[month]) byMonthCategory[month] = {};
      byMonthCategory[month][issue.category] = (byMonthCategory[month][issue.category] || 0) + 1;
    }

    return { byMonthCategory, totalIssues: issues.length, monthsBack };
  },

  async generate(monthKey = currentMonthKey(), source: 'AUTO' | 'MANUAL' = 'AUTO') {
    const existing = await prisma.seasonalForecast.findUnique({ where: { monthKey } });
    if (existing && source === 'AUTO') return { row: existing, created: false };

    const stats = await this.aggregateMonthlyStats();
    const lines = Object.entries(stats.byMonthCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cats]) => {
        const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return `${month}: ${top.map(([c, n]) => `${c}=${n}`).join(', ')}`;
      })
      .join('\n');

    const summary = `Monthly issue counts (last ${stats.monthsBack} months):\n${lines || 'No data'}`;
    const { narrative } = await aiService.generateSeasonalForecast(summary);

    const row = await prisma.seasonalForecast.upsert({
      where: { monthKey },
      create: { monthKey, stats: stats as any, narrative, source },
      update: { stats: stats as any, narrative, generatedAt: new Date(), source },
    });

    return { row, created: !existing };
  },
};