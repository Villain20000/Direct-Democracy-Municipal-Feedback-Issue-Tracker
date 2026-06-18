import crypto from 'crypto';
import { prisma } from '../db/client';
import { embedText, toPgVectorLiteral } from './embedding.service';
import { aiService } from '../ai/ollama.service';
import { notificationService } from './notification.service';

const ALERT_THRESHOLD = 0.58;

function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function extractQueryText(filters: Record<string, unknown>): string | null {
  const search = filters?.search;
  if (typeof search === 'string' && search.trim().length >= 3) {
    return search.trim();
  }
  const parts: string[] = [];
  for (const key of ['category', 'status', 'wardId', 'departmentId']) {
    const v = filters?.[key];
    if (typeof v === 'string' && v.trim()) parts.push(`${key}:${v.trim()}`);
  }
  return parts.length ? parts.join(' ') : null;
}

export const savedSearchAlertService = {
  extractQueryText,

  async syncEmbedding(savedSearchId: string, queryText: string | null) {
    if (!queryText || queryText.length < 3) {
      await prisma.savedSearchEmbedding.deleteMany({ where: { savedSearchId } });
      return;
    }

    const hash = contentHash(queryText);
    const existing = await prisma.savedSearchEmbedding.findUnique({
      where: { savedSearchId },
      select: { contentHash: true },
    });
    if (existing?.contentHash === hash) return;

    const embedding = await embedText(queryText);
    const vecLiteral = toPgVectorLiteral(embedding);
    await prisma.$executeRaw`
      INSERT INTO "SavedSearchEmbedding"
        ("id", "savedSearchId", "embedding", "contentHash", "generatedAt")
      VALUES
        (gen_random_uuid()::text, ${savedSearchId}, ${vecLiteral}::vector, ${hash}, NOW())
      ON CONFLICT ("savedSearchId") DO UPDATE SET
        "embedding"   = EXCLUDED."embedding",
        "contentHash" = EXCLUDED."contentHash",
        "generatedAt" = NOW()
    `;
  },

  async onSavedSearchCreated(savedSearchId: string, filters: Record<string, unknown>) {
    const queryText = extractQueryText(filters);
    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: { queryText },
    });
    await this.syncEmbedding(savedSearchId, queryText);
  },

  async onSavedSearchUpdated(savedSearchId: string, filters: Record<string, unknown>) {
    const queryText = extractQueryText(filters);
    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: { queryText },
    });
    await this.syncEmbedding(savedSearchId, queryText);
  },

  /**
   * Called after a new issue is embedded. Checks all alert-enabled saved
   * searches and notifies owners when similarity exceeds threshold.
   */
  async checkNewIssue(issueId: string) {
    const issueEmb = await prisma.issueEmbedding.findUnique({
      where: { issueId },
      select: { id: true },
    });
    if (!issueEmb) return { alertsSent: 0 };

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        departmentId: true,
        wardId: true,
      },
    });
    if (!issue) return { alertsSent: 0 };

    const savedSearches = await prisma.savedSearch.findMany({
      where: { alertsEnabled: true, queryText: { not: null } },
      include: { embedding: true },
    });

    let alertsSent = 0;
    for (const saved of savedSearches) {
      if (!saved.embedding || !saved.queryText) continue;

      const rows = await prisma.$queryRaw<Array<{ score: number }>>`
        SELECT (1 - (s."embedding" <=> e."embedding")) AS "score"
        FROM "SavedSearchEmbedding" s, "IssueEmbedding" e
        WHERE s."savedSearchId" = ${saved.id}
          AND e."issueId" = ${issueId}
          AND s."embedding" IS NOT NULL
          AND e."embedding" IS NOT NULL
      `;
      const score = rows[0]?.score != null ? Number(rows[0].score) : 0;
      if (score < ALERT_THRESHOLD) continue;

      const already = await prisma.savedSearchAlert.findUnique({
        where: { savedSearchId_issueId: { savedSearchId: saved.id, issueId } },
      });
      if (already) continue;

      const filters = saved.filters as Record<string, unknown>;
      if (!matchesFilters(issue, filters)) continue;

      let alertLine = `New issue matches your saved search "${saved.name}": ${issue.title}`;
      try {
        const summary = await aiService.summarize(
          `One-line alert for a citizen: saved search "${saved.name}" matched issue "${issue.title}" (${issue.category}, ${issue.status}). ${issue.description.slice(0, 120)}`,
          40,
        );
        if (summary.summary) alertLine = summary.summary;
      } catch {
        // use fallback line
      }

      await notificationService.create(
        saved.userId,
        'SAVED_SEARCH_ALERT',
        `Alert: ${saved.name}`,
        alertLine,
        { savedSearchId: saved.id, issueId, score, category: issue.category },
        { sendEmail: false },
      );

      await prisma.savedSearchAlert.create({
        data: { savedSearchId: saved.id, issueId, score },
      });
      alertsSent++;
    }

    return { alertsSent };
  },
};

function matchesFilters(
  issue: { category: string; status: string; departmentId: string | null; wardId: string | null },
  filters: Record<string, unknown>,
): boolean {
  if (filters.category && String(filters.category) !== issue.category) return false;
  if (filters.status && String(filters.status) !== issue.status) return false;
  if (filters.departmentId && String(filters.departmentId) !== issue.departmentId) return false;
  if (filters.wardId && String(filters.wardId) !== issue.wardId) return false;
  return true;
}