import { config } from '../config';

const DEFAULT_MODEL = 'nomic-embed-text';
const EXPECTED_DIM = 768;

interface EmbeddingResult {
  embedding: number[];
  model: string;
}

let cachedModel: string | null = null;

function getModel(): string {
  if (cachedModel) return cachedModel;
  // Read from env at startup so we don't pay the cost on every call
  cachedModel = process.env.EMBED_MODEL || DEFAULT_MODEL;
  return cachedModel;
}

/**
 * Generate a single embedding. We hit Ollama directly via fetch (no SDK
 * dependency) because the `ollama` npm package does not yet expose a
 * stable embeddings helper for all versions.
 *
 * Throws if Ollama is unreachable or the returned vector has the wrong
 * dimension — callers should treat that as a hard fail.
 */
export async function embedText(text: string): Promise<number[]> {
  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!cleaned) throw new Error('Cannot embed empty text');

  const res = await fetch(`${config.ollama.baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: getModel(), prompt: cleaned }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama embeddings failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as Partial<EmbeddingResult>;
  if (!Array.isArray(json.embedding) || json.embedding.length !== EXPECTED_DIM) {
    throw new Error(
      `Unexpected embedding dimension ${json.embedding?.length} (expected ${EXPECTED_DIM}). ` +
      `Did you swap EMBED_MODEL? Update EXPECTED_DIM and the pgvector column.`,
    );
  }
  return json.embedding;
}

/**
 * Vector -> pgvector literal, e.g. "[0.1,0.2,...]". The string is what
 * Prisma's $queryRaw / $executeRaw need for `::vector` casts.
 */
export function toPgVectorLiteral(vec: number[]): string {
  return '[' + vec.map((n) => Number(n).toFixed(6)).join(',') + ']';
}

export const EMBED_DIM = EXPECTED_DIM;
