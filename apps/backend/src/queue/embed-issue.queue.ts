/**
 * BullMQ queue for "embed newly-created issues". The HTTP route handler
 * enqueues a job after the issue row is persisted; a separate worker
 * process picks it up and generates the vector embedding.
 *
 * Design notes:
 *   - BullMQ requires its OWN ioredis connection (not the one used by
 *     the in-memory cache). We lazy-create it so importing this module
 *     is free if Redis is down.
 *   - `maxRetriesPerRequest: null` is REQUIRED by BullMQ.
 *   - The default job options below apply to every `queue.add()` call
 *     unless explicitly overridden.
 *   - We cast the connection to `ConnectionOptions` because BullMQ 5.x
 *     ships with its own bundled ioredis type, which is structurally
 *     identical to ours but not nominally assignable.
 */

import IORedis, { type Redis } from 'ioredis';
import { Queue, type ConnectionOptions } from 'bullmq';
import { config } from '../config';

export const EMBED_ISSUE_QUEUE = 'embed-issue';

export interface EmbedIssueJobData {
  issueId: string;
}

let _connection: Redis | null = null;

/**
 * Get (or create) the dedicated ioredis connection used by BullMQ.
 * We keep this separate from the cache.ts connection because BullMQ
 * needs `maxRetriesPerRequest: null` and the cache wants finite retries.
 */
export function getRedisConnection(): Redis {
  if (_connection) return _connection;
  _connection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null, // BullMQ requirement
    lazyConnect: false,
    enableReadyCheck: true,
  });
  _connection.on('error', (err) => {
    // Don't crash the app on transient Redis errors — the worker / queue
    // will retry on its own.
    console.error(`[embed-issue.queue] Redis connection error: ${err.message}`);
  });
  return _connection;
}

/**
 * Close the dedicated BullMQ connection. Exposed for graceful shutdown
 * in tests and for the worker entry point if it ever co-locates with
 * the API server in a single process.
 */
export async function closeRedisConnection(): Promise<void> {
  if (!_connection) return;
  try {
    await _connection.quit();
  } catch {
    _connection.disconnect();
  }
  _connection = null;
}

let _queue: Queue<EmbedIssueJobData> | null = null;

/**
 * Lazily-instantiated queue. Returns the same instance on subsequent calls.
 * If Redis is unreachable, calling this function still works — the
 * `queue.add()` call will surface the error at enqueue time, which the
 * HTTP handler catches and logs.
 *
 * Note: per-job timeout is configured on the Worker side
 * (`stalledInterval` / `lockDuration`) rather than here, because
 * `DefaultJobOptions.timeout` isn't a first-class field in BullMQ 5.x.
 */
export function getEmbedIssueQueue(): Queue<EmbedIssueJobData> {
  if (_queue) return _queue;
  _queue = new Queue<EmbedIssueJobData>(EMBED_ISSUE_QUEUE, {
    connection: getRedisConnection() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      // Keep last 100 successful jobs (for debugging via BullMQ UI)
      removeOnComplete: { count: 100 },
      // Keep last 50 failures (enough to inspect recent issues; the
      // rest can live in logs).
      removeOnFail: { count: 50 },
    },
  });
  return _queue;
}
