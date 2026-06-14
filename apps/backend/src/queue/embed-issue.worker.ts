/**
 * BullMQ worker for the "embed-issue" queue. For each job:
 *   1. Fetch the Issue row from the database.
 *   2. Compute sha256 contentHash of (title + description).
 *   3. If the existing IssueEmbedding has the same contentHash, skip
 *      (idempotent — protects against duplicate enqueues).
 *   4. Otherwise, generate a 768-dim vector via Ollama (nomic-embed-text)
 *      and upsert into IssueEmbedding.
 *
 * Concurrency: 2 (tuned for a single local Ollama instance; raise if
 * you run multiple Ollama replicas).
 */

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '../db/client';
import { cache } from '../cache/redis';
import { embedText, toPgVectorLiteral } from '../services/embedding.service';
import { contentHash } from '../utils/content-hash';
import {
  EMBED_ISSUE_QUEUE,
  getRedisConnection,
  type EmbedIssueJobData,
} from './embed-issue.queue';

async function processEmbedIssue(
  job: Job<EmbedIssueJobData>,
): Promise<{ skipped: boolean; reason?: string; issueId?: string }> {
  const { issueId } = job.data;
  const start = Date.now();

  // 1. Fetch the issue (plus the contentHash of any existing embedding).
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      title: true,
      description: true,
      embedding: { select: { contentHash: true } },
    },
  });
  if (!issue) {
    // Issue was deleted between enqueue and processing. Not an error —
    // just nothing to do. (Cascading delete of IssueEmbedding will have
    // already cleaned up the embedding if it existed.)
    console.warn(`[embed-issue] Issue ${issueId} not found, skipping.`);
    return { skipped: true, reason: 'not_found' };
  }

  // 2. Idempotency check.
  const hash = contentHash(issue.title, issue.description);
  if (issue.embedding?.contentHash === hash) {
    console.log(
      `[embed-issue] Issue ${issueId} already up-to-date (hash match). Skipped.`,
    );
    return { skipped: true, reason: 'up_to_date' };
  }

  // 3. Generate the embedding.
  const text = `${issue.title}. ${issue.description}`.trim();
  const embedding = await embedText(text);
  const vecLiteral = toPgVectorLiteral(embedding);

  // 4. Upsert into IssueEmbedding. Raw SQL because Prisma doesn't
  //    understand pgvector. ON CONFLICT on the unique (issueId) makes
  //    this safe under concurrent processing.
  await prisma.$executeRaw`
    INSERT INTO "IssueEmbedding"
      ("id", "issueId", "embedding", "contentHash", "model", "generatedAt")
    VALUES
      (gen_random_uuid()::text, ${issue.id}, ${vecLiteral}::vector,
       ${hash}, ${process.env.EMBED_MODEL || 'nomic-embed-text'}, NOW())
    ON CONFLICT ("issueId") DO UPDATE SET
      "embedding"   = EXCLUDED."embedding",
      "contentHash" = EXCLUDED."contentHash",
      "model"       = EXCLUDED."model",
      "generatedAt" = NOW()
  `;

  // 5. Invalidate the semantic-search cache so the freshly-embedded
  //    issue becomes searchable immediately (worst case = current
  //    TTL, but the common case is sub-second). The pattern matches
  //    the `search:semantic:<sha256>` keys written by
  //    `issueService.searchSimilar`. The trailing `*` is required —
  //    Redis KEYS uses glob-style matching and a pattern with no
  //    wildcards only matches the literal key name. We
  //    fire-and-forget — a Redis blip here doesn't block the embed.
  cache
    .invalidatePattern('search:semantic:*')
    .catch((err) => console.warn(`[embed-issue] cache.invalidatePattern failed:`, err.message));

  const ms = Date.now() - start;
  console.log(
    `[embed-issue] Embedded issue ${issueId} in ${ms}ms (${embedding.length}-dim).`,
  );
  return { skipped: false, issueId };
}

let _worker: Worker<EmbedIssueJobData> | null = null;

/**
 * Start the worker. Idempotent — calling twice returns the same instance.
 * The worker connects to Redis via the shared BullMQ connection.
 */
export function startEmbedIssueWorker(): Worker<EmbedIssueJobData> {
  if (_worker) return _worker;

  _worker = new Worker<EmbedIssueJobData>(
    EMBED_ISSUE_QUEUE,
    processEmbedIssue,
    {
      // Cast: BullMQ 5.x bundles its own ioredis type which is
      // structurally identical to ours but not nominally assignable.
      connection: getRedisConnection() as unknown as ConnectionOptions,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
      // If a job doesn't heartbeat within `lockDuration`, BullMQ
      // considers it stalled and re-queues it. 60s is generous for a
      // local Ollama cold-start; lower it for a hot production setup.
      lockDuration: parseInt(process.env.EMBED_LOCK_DURATION_MS || '60_000', 10),
      stalledInterval: parseInt(process.env.EMBED_STALLED_INTERVAL_MS || '30_000', 10),
    },
  );

  _worker.on('completed', (job) => {
    const r = job.returnvalue;
    if (r?.skipped) {
      console.log(
        `[embed-issue] Job ${job.id} for ${job.data.issueId} skipped (${r.reason}).`,
      );
    } else {
      console.log(`[embed-issue] Job ${job.id} for ${job.data.issueId} completed.`);
    }
  });

  _worker.on('failed', (job, err) => {
    console.error(
      `[embed-issue] Job ${job?.id} for ${job?.data.issueId} failed (attempt ` +
      `${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`,
    );
  });

  _worker.on('error', (err) => {
    // Surfaces Redis / connection errors. Don't crash the process.
    console.error(`[embed-issue] Worker error: ${err.message}`);
  });

  return _worker;
}

/**
 * Stop the worker (used by the entry point on SIGINT / SIGTERM).
 */
export async function stopEmbedIssueWorker(): Promise<void> {
  if (!_worker) return;
  await _worker.close();
  _worker = null;
  console.log('[embed-issue] Worker stopped.');
}
