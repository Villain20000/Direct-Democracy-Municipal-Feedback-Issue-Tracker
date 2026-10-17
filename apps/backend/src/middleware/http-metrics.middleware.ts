import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';

/**
 * P2-21 — In-memory HTTP latency tracker for the admin System Health card.
 *
 * A ring buffer of recent response durations (ms). The detailed health
 * endpoint derives p50 / p95 / avg from it. Purely in-process: no Redis,
 * no schema, resets on restart. Bounded at MAX_SAMPLES entries.
 */

const MAX_SAMPLES = 1000;
const samples: number[] = [];
let samplesDropped = 0;

export function recordHttpSample(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  if (samples.length >= MAX_SAMPLES) {
    samples.shift();
    samplesDropped += 1;
  }
  samples.push(durationMs);
}

export function httpLatencyStats() {
  const count = samples.length;
  if (count === 0) {
    return { count: 0, dropped: samplesDropped, avgMs: 0, p50Ms: 0, p95Ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const quantile = (q: number) => sorted[Math.min(count - 1, Math.floor(q * count))];
  return {
    count,
    dropped: samplesDropped,
    avgMs: Math.round((sum / count) * 10) / 10,
    p50Ms: Math.round(quantile(0.5) * 10) / 10,
    p95Ms: Math.round(quantile(0.95) * 10) / 10,
  };
}

/** Express middleware: time every response and feed the ring buffer. */
export function httpMetricsMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    // Skip the detailed-health poll itself so the card doesn't measure
    // its own refresh loop.
    if (!req.path.includes('/health/detailed')) recordHttpSample(elapsedMs);
  });
  next();
}
