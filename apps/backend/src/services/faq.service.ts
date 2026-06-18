import crypto from 'crypto';
import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';
import { embedText, toPgVectorLiteral } from './embedding.service';
import { chunkText } from './rag.service';

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function getCurrentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const faqService = {
  getCurrentWeekKey,

  async listPublished(limit = 30) {
    return prisma.faqEntry.findMany({
      where: { published: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sourceIssueIds: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Weekly cron: cluster recently resolved issues into FAQ Q&A pairs.
   * Idempotent per weekKey — skips if entries already exist.
   */
  async generateWeekly(weekKey = getCurrentWeekKey(), source = 'AUTO') {
    const existing = await prisma.faqEntry.count({ where: { weekKey } });
    if (existing > 0) {
      return { created: 0, weekKey, skipped: true };
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const resolved = await prisma.issue.findMany({
      where: {
        status: 'RESOLVED',
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        statusHistory: {
          where: { newStatus: 'RESOLVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { note: true },
        },
      },
    });

    if (resolved.length < 3) {
      return { created: 0, weekKey, skipped: true, reason: 'insufficient_data' };
    }

    const byCategory = new Map<string, typeof resolved>();
    for (const issue of resolved) {
      const list = byCategory.get(issue.category) || [];
      list.push(issue);
      byCategory.set(issue.category, list);
    }

    let created = 0;
    for (const [category, issues] of byCategory) {
      if (issues.length < 2) continue;
      const batch = issues.slice(0, 5);
      const issueText = batch
        .map((i, idx) => {
          const resolution = i.statusHistory?.[0]?.note || i.description.slice(0, 200);
          return `${idx + 1}. ${i.title}\nQ context: ${i.description.slice(0, 120)}\nA: ${resolution.slice(0, 200)}`;
        })
        .join('\n\n');

      const qa = await generateFaqPair(category, issueText, batch.map((i) => i.id));
      if (!qa) continue;

      const contentHash = hashContent(`${qa.question}|${qa.answer}`);
      const dup = await prisma.faqEntry.findUnique({ where: { contentHash } });
      if (dup) continue;

      const entry = await prisma.faqEntry.create({
        data: {
          question: qa.question,
          answer: qa.answer,
          category,
          sourceIssueIds: batch.map((i) => i.id),
          contentHash,
          weekKey,
          published: true,
        },
      });

      const chunks = chunkText(`Q: ${qa.question}\nA: ${qa.answer}`);
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embedText(chunks[i]);
        const vecLiteral = toPgVectorLiteral(embedding);
        await prisma.$executeRaw`
          INSERT INTO "FaqChunk" ("id", "faqEntryId", "chunkIndex", "content", "embedding", "createdAt")
          VALUES (gen_random_uuid()::text, ${entry.id}, ${i}, ${chunks[i]}, ${vecLiteral}::vector, NOW())
          ON CONFLICT ("faqEntryId", "chunkIndex") DO UPDATE
            SET "content" = EXCLUDED."content",
                "embedding" = EXCLUDED."embedding"
        `;
      }
      created++;
    }

    return { created, weekKey, source, skipped: false };
  },
};

async function generateFaqPair(
  category: string,
  issueText: string,
  sourceIds: string[],
): Promise<{ question: string; answer: string } | null> {
  const fallback = {
    question: `How does the city handle ${category.toLowerCase().replace(/_/g, ' ')} issues?`,
    answer: `The municipality tracks ${category.toLowerCase().replace(/_/g, ' ')} reports, assigns them to the relevant department, and resolves them with a documented resolution note. See recent examples in issue IDs: ${sourceIds.slice(0, 3).join(', ')}.`,
  };

  try {
    const response = await aiService.summarize(
      `From these resolved municipal issues in category ${category}, write ONE citizen FAQ entry.
Output format exactly:
QUESTION: <plain-language question citizens would ask>
ANSWER: <helpful 2-3 sentence answer based on how issues were resolved>

Issues:
${issueText}`,
      200,
    );
    const text = response.summary || '';
    const qMatch = text.match(/QUESTION:\s*(.+)/i);
    const aMatch = text.match(/ANSWER:\s*([\s\S]+)/i);
    if (qMatch && aMatch) {
      return { question: qMatch[1].trim(), answer: aMatch[1].trim() };
    }
    return fallback;
  } catch {
    return fallback;
  }
}