import net from 'net';
import { prisma } from '../db/client';
import { config } from '../config';
import { aiHealthService } from './ai-health.service';
import { httpLatencyStats } from '../middleware/http-metrics.middleware';

/**
 * P2-21 — Detailed system health for the Super Admin dashboard card.
 *
 * Aggregates everything the old single `fetch('/health')` toggle hid:
 *   - API latency (p50/p95 over recent in-process HTTP samples)
 *   - BullMQ embed queue depth (waiting/active/delayed/failed)
 *   - Ollama reachability + models (via aiHealthService)
 *   - Redis reachability (raw TCP probe — no client side effects)
 *   - Postgres reachability (SELECT 1)
 *
 * Every probe is individually guarded: a down dependency degrades its
 * own section, never the whole endpoint.
 */

function probeRedisTcp(timeoutMs = 2000): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    if (!config.redis.enabled) {
      resolve({ reachable: false, latencyMs: null });
      return;
    }
    let url: URL;
    try {
      url = new URL(config.redis.url);
    } catch {
      resolve({ reachable: false, latencyMs: null });
      return;
    }
    const host = url.hostname || 'localhost';
    const port = url.port ? parseInt(url.port) : 6379;
    const start = Date.now();
    const socket = net.connect(port, host);
    const done = (reachable: boolean) =>
      resolve({ reachable, latencyMs: reachable ? Date.now() - start : null });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      done(false);
    });
    socket.on('error', () => done(false));
  });
}

async function probeQueue(): Promise<{
  status: 'up' | 'down' | 'disabled';
  waiting: number; active: number; delayed: number; failed: number; completed: number;
}> {
  const down = { status: 'down' as const, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
  if (!config.redis.enabled) return { ...down, status: 'disabled' };
  try {
    // Lazy import so health checks never pull BullMQ into unrelated contexts.
    const { getEmbedIssueQueue } = await import('../queue/embed-issue.queue');
    const queue = getEmbedIssueQueue();
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    return {
      status: 'up',
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  } catch {
    return down;
  }
}

export const systemHealthService = {
  async detailed() {
    const startedAt = Date.now();

    const [db, redis, queue, ollama] = await Promise.all([
      (async () => {
        try {
          const t = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          return { status: 'up' as const, latencyMs: Date.now() - t };
        } catch (error: any) {
          return { status: 'down' as const, latencyMs: null, error: error.message };
        }
      })(),
      (async () => {
        const { reachable, latencyMs } = await probeRedisTcp();
        return {
          status: (reachable ? 'up' : config.redis.enabled ? 'down' : 'disabled') as 'up' | 'down' | 'disabled',
          latencyMs,
        };
      })(),
      probeQueue(),
      (async () => {
        try {
          const data: any = await Promise.race([
            aiHealthService.check(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('ollama probe timeout')), 8000)),
          ]);
          return {
            status: (data.status === 'unavailable' ? 'down' : 'up') as 'up' | 'down',
            tier: data.tier ?? null,
            models: Array.isArray(data.pulledModels) ? data.pulledModels.length : 0,
            chatLatencyMs: data.chatLatencyMs ?? null,
          };
        } catch {
          return { status: 'down' as const, tier: null, models: 0, chatLatencyMs: null };
        }
      })(),
    ]);

    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      http: httpLatencyStats(),
      database: db,
      redis,
      queue,
      ollama,
      probeMs: Date.now() - startedAt,
    };
  },
};
