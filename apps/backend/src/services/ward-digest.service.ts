import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const wardDigestService = {
  getTodayKey() {
    return todayKey();
  },

  async getLatestForWard(wardId: string) {
    return prisma.wardDigest.findFirst({
      where: { wardId },
      orderBy: { generatedAt: 'desc' },
      include: { ward: { select: { id: true, name: true, code: true } } },
    });
  },

  async generateForWard(wardId: string, dateKey = todayKey(), source: 'AUTO' | 'MANUAL' = 'AUTO') {
    const existing = await prisma.wardDigest.findUnique({
      where: { wardId_dateKey: { wardId, dateKey } },
    });
    if (existing && source === 'AUTO') return { row: existing, created: false };

    const since = yesterdayStart();
    const issues = await prisma.issue.findMany({
      where: {
        wardId,
        createdAt: { gte: since },
        duplicateOfId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, description: true, category: true, status: true },
    });

    let body: string;
    if (issues.length === 0) {
      body = 'No new issues were reported in your ward in the last 24 hours.';
    } else {
      const bulletList = issues
        .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title} (${i.status})`)
        .join('\n');
      const summary = await aiService.summarize(
        `Ward daily digest — ${issues.length} new issue(s) in the last 24 hours:\n${bulletList}`,
        80,
      );
      body = summary.summary;
    }

    const row = await prisma.wardDigest.upsert({
      where: { wardId_dateKey: { wardId, dateKey } },
      create: {
        wardId,
        dateKey,
        body,
        issueCount: issues.length,
        issueIds: issues.map((i) => i.id),
        source,
      },
      update: {
        body,
        issueCount: issues.length,
        issueIds: issues.map((i) => i.id),
        generatedAt: new Date(),
        source,
      },
      include: { ward: { select: { id: true, name: true, code: true } } },
    });

    return { row, created: !existing };
  },

  async generateAll(source: 'AUTO' | 'MANUAL' = 'AUTO') {
    const wards = await prisma.ward.findMany({ select: { id: true, name: true } });
    const dateKey = todayKey();
    const results = [];
    for (const ward of wards) {
      try {
        const { row, created } = await this.generateForWard(ward.id, dateKey, source);
        results.push({ wardId: ward.id, wardName: ward.name, created, id: row.id });
      } catch (err: any) {
        console.warn(`[ward-digest] failed for ward ${ward.id}: ${err.message}`);
      }
    }
    return results;
  },
};