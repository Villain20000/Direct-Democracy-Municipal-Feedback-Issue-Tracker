import crypto from 'crypto';

/**
 * Stable content hash for an issue's text payload. Used by both the
 * BullMQ worker and the one-time backfill script to detect "no-op"
 * updates and skip re-embedding.
 *
 * The algorithm MUST stay in sync across all callers — a typo in one
 * place would cause silent "stale embedding" bugs.
 */
export function contentHash(title: string, description: string): string {
  return crypto
    .createHash('sha256')
    .update(`${title.trim()}\n${description.trim()}`)
    .digest('hex');
}
