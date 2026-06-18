import crypto from 'crypto';
import { prisma } from '../db/client';
import { embedText, toPgVectorLiteral } from './embedding.service';

const CHUNK_SIZE_CHARS = 1500;   // ~400-500 tokens; tuned for nomic-embed-text
const CHUNK_OVERLAP_CHARS = 200; // keep context at chunk boundaries
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

/**
 * Naive but effective word-boundary chunker. Splits on whitespace, packs
 * `CHUNK_SIZE_CHARS` characters per chunk with `CHUNK_OVERLAP_CHARS`
 * overlap so cross-chunk references (e.g. a sentence split across two
 * paragraphs) still match.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length === 0) return [];
  if (normalized.length <= CHUNK_SIZE_CHARS) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE_CHARS, normalized.length);
    // Prefer to break on whitespace / newline so we don't slice words
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const lastSpace = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'));
      if (lastSpace > CHUNK_SIZE_CHARS * 0.6) {
        end = start + lastSpace;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface IngestInput {
  title: string;
  type: 'ORDINANCE' | 'DECISION' | 'REGULATION' | 'GUIDE' | 'OTHER';
  source: string;
  description?: string;
  documentDate?: string;
  content: string;
  uploadedById?: string;
}

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  skipped: boolean;
}

export interface HybridCitation {
  sourceType: 'legislation' | 'issue' | 'faq';
  id: string;
  title: string;
  subtype: string;
  chunkIndex: number;
  score: number;
  chunk: string;
  documentDate?: string | null;
}

export interface HybridRetrieveOptions {
  legislationK?: number;
  issuesK?: number;
  faqK?: number;
  minScore?: number;
}

/**
 * Ingest a piece of legislation/regulation into the vector store.
 *
 * Idempotent: re-uploading the same content becomes a no-op (the
 * `contentHash` unique index protects us). The caller still gets a
 * `documentId` so they can edit / delete the document.
 *
 * Slow path: O(chunks) embeddings at ~80-200ms each on a local Ollama.
 * We process them serially to keep Ollama responsive to other callers.
 */
export const ragService = {
  async ingest(input: IngestInput): Promise<IngestResult> {
    const hash = hashContent(input.content);

    const existing = await prisma.document.findUnique({ where: { contentHash: hash } });
    if (existing) {
      return { documentId: existing.id, chunksCreated: 0, skipped: true };
    }

    const chunks = chunkText(input.content);

    // Create the parent first so the FK is satisfied for chunk inserts.
    const doc = await prisma.document.create({
      data: {
        title: input.title,
        type: input.type,
        source: input.source,
        description: input.description,
        documentDate: input.documentDate,
        contentHash: hash,
        charCount: input.content.length,
        chunkCount: chunks.length,
        uploadedById: input.uploadedById,
      },
    });

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      const vecLiteral = toPgVectorLiteral(embedding);
      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" ("id", "documentId", "chunkIndex", "content", "embedding", "createdAt")
        VALUES (gen_random_uuid()::text, ${doc.id}, ${i}, ${chunks[i]}, ${vecLiteral}::vector, NOW())
        ON CONFLICT ("documentId", "chunkIndex") DO UPDATE
          SET "content" = EXCLUDED."content",
              "embedding" = EXCLUDED."embedding"
      `;
    }
    return { documentId: doc.id, chunksCreated: chunks.length, skipped: false };
  },

  /**
   * Cosine-distance retrieval. Returns the top-K chunks most similar to
   * the query, ordered by similarity ascending (lowest distance = most
   * similar). Empty array if the store has no embeddings yet.
   */
  async retrieve(query: string, topK: number = DEFAULT_TOP_K, minScore: number = 0.3) {
    const k = Math.min(Math.max(1, topK), MAX_TOP_K);
    const queryVec = await embedText(query);
    const vecLiteral = toPgVectorLiteral(queryVec);

    // 1 - cosine_distance = cosine_similarity
    // We filter in SQL to avoid shipping irrelevant rows to the app.
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        documentId: string;
        chunkIndex: number;
        content: string;
        documentTitle: string;
        documentType: string;
        documentSource: string;
        documentDate: string | null;
        score: number;
      }>
    >`
      SELECT
        c."id",
        c."documentId",
        c."chunkIndex",
        c."content",
        d."title"        AS "documentTitle",
        d."type"         AS "documentType",
        d."source"       AS "documentSource",
        d."documentDate" AS "documentDate",
        (1 - (c."embedding" <=> ${vecLiteral}::vector)) AS "score"
      FROM "DocumentChunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE c."embedding" IS NOT NULL
        AND (1 - (c."embedding" <=> ${vecLiteral}::vector)) >= ${minScore}
      ORDER BY c."embedding" <=> ${vecLiteral}::vector
      LIMIT ${k}
    `;

    return rows.map((r) => ({
      chunkId: r.id,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      documentType: r.documentType,
      documentSource: r.documentSource,
      documentDate: r.documentDate,
      chunkIndex: r.chunkIndex,
      content: r.content,
      score: Number(r.score),
    }));
  },

  async listDocuments(limit = 50) {
    return prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { _count: { select: { chunks: true } } },
    });
  },

  async deleteDocument(id: string) {
    return prisma.document.delete({ where: { id } });
  },

  /**
   * Retrieve similar issue reports (not legislation) for hybrid RAG.
   */
  async retrieveIssues(query: string, topK: number = 3, minScore: number = 0.3): Promise<HybridCitation[]> {
    const k = Math.min(Math.max(1, topK), MAX_TOP_K);
    const queryVec = await embedText(query);
    const vecLiteral = toPgVectorLiteral(queryVec);

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        status: string;
        score: number;
      }>
    >`
      SELECT
        i."id",
        i."title",
        i."description",
        i."category"::text AS category,
        i."status"::text AS status,
        (1 - (e."embedding" <=> ${vecLiteral}::vector)) AS "score"
      FROM "IssueEmbedding" e
      JOIN "Issue" i ON i."id" = e."issueId"
      WHERE e."embedding" IS NOT NULL
        AND (1 - (e."embedding" <=> ${vecLiteral}::vector)) >= ${minScore}
      ORDER BY e."embedding" <=> ${vecLiteral}::vector
      LIMIT ${k}
    `;

    return rows.map((r) => ({
      sourceType: 'issue' as const,
      id: r.id,
      title: r.title,
      subtype: r.category,
      chunkIndex: 0,
      score: Number(r.score),
      chunk: `${r.title}. ${r.description}`.slice(0, 280) + (r.description.length > 200 ? '…' : ''),
      documentDate: null,
    }));
  },

  /**
   * Retrieve FAQ chunks for hybrid RAG.
   */
  async retrieveFaq(query: string, topK: number = 2, minScore: number = 0.3): Promise<HybridCitation[]> {
    const k = Math.min(Math.max(1, topK), MAX_TOP_K);
    const queryVec = await embedText(query);
    const vecLiteral = toPgVectorLiteral(queryVec);

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        faqEntryId: string;
        chunkIndex: number;
        content: string;
        question: string;
        category: string | null;
        score: number;
      }>
    >`
      SELECT
        c."id",
        c."faqEntryId",
        c."chunkIndex",
        c."content",
        f."question",
        f."category",
        (1 - (c."embedding" <=> ${vecLiteral}::vector)) AS "score"
      FROM "FaqChunk" c
      JOIN "FaqEntry" f ON f."id" = c."faqEntryId"
      WHERE c."embedding" IS NOT NULL
        AND f."published" = true
        AND (1 - (c."embedding" <=> ${vecLiteral}::vector)) >= ${minScore}
      ORDER BY c."embedding" <=> ${vecLiteral}::vector
      LIMIT ${k}
    `;

    return rows.map((r) => ({
      sourceType: 'faq' as const,
      id: r.faqEntryId,
      title: r.question,
      subtype: r.category || 'FAQ',
      chunkIndex: r.chunkIndex,
      score: Number(r.score),
      chunk: r.content.slice(0, 280) + (r.content.length > 280 ? '…' : ''),
      documentDate: null,
    }));
  },

  /**
   * Merge legislation, issue, and FAQ retrieval into one ranked list.
   */
  async retrieveHybrid(
    query: string,
    opts: HybridRetrieveOptions = {},
  ): Promise<HybridCitation[]> {
    const {
      legislationK = 3,
      issuesK = 2,
      faqK = 2,
      minScore = 0.25,
    } = opts;

    const results: HybridCitation[] = [];
    const tasks: Array<Promise<void>> = [];

    if (legislationK > 0) {
      tasks.push(
        this.retrieve(query, legislationK, minScore).then((chunks) => {
          for (const c of chunks) {
            results.push({
              sourceType: 'legislation',
              id: c.documentId,
              title: c.documentTitle,
              subtype: c.documentType,
              chunkIndex: c.chunkIndex,
              score: c.score,
              chunk: c.content.slice(0, 280) + (c.content.length > 280 ? '…' : ''),
              documentDate: c.documentDate,
            });
          }
        }).catch(() => {}),
      );
    }

    if (issuesK > 0) {
      tasks.push(
        this.retrieveIssues(query, issuesK, minScore).then((rows) => {
          results.push(...rows);
        }).catch(() => {}),
      );
    }

    if (faqK > 0) {
      tasks.push(
        this.retrieveFaq(query, faqK, minScore).then((rows) => {
          results.push(...rows);
        }).catch(() => {}),
      );
    }

    await Promise.all(tasks);
    return results.sort((a, b) => b.score - a.score);
  },

  buildHybridSystemPrompt(citations: HybridCitation[]): string {
    const contextBlock = citations
      .map((c, i) => {
        const label = c.sourceType === 'legislation'
          ? `Ordinance/Law`
          : c.sourceType === 'issue'
            ? `Citizen Issue`
            : `FAQ`;
        const date = c.documentDate ? `, ${c.documentDate}` : '';
        return `[${i + 1}] (${label}: ${c.title}, ${c.subtype}${date})\n${c.chunk}`;
      })
      .join('\n\n---\n\n');

    return `You are CivicAssist, an AI assistant for the municipal government. The user may ask about
municipal rules, citizen issues, or common questions. The following excerpts are provided as
CONTEXT ONLY from three sources: official legislation, past citizen issue reports, and the FAQ
knowledge base. Answer using this context when relevant, and CITE sources by number in brackets
(e.g. [1]). Label whether each citation is an ordinance, issue report, or FAQ when referencing it.
If the context does not contain the answer, say so honestly and suggest where to look instead.
Keep answers concise and friendly.

--- CONTEXT ---
${contextBlock}
--- END CONTEXT ---`;
  },
};
