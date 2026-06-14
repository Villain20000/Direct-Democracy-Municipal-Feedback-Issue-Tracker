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
};
