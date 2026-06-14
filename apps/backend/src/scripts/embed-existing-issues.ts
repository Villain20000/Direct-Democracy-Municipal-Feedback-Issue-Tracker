/**
 * One-time backfill script for the RAG / pgvector pipeline.
 *
 * Walks every Issue in the database, generates a 768-dim embedding via
 * Ollama (nomic-embed-text), and upserts it into the IssueEmbedding
 * table. Idempotent — re-running skips issues whose contentHash already
 * matches, so it can be safely scheduled or run from CI.
 *
 * Usage:
 *   npm run embed:backfill
 *   npm run embed:backfill -- --dry-run      # report only, no writes
 *   BACKFILL_BATCH_SIZE=8 npm run embed:backfill
 *
 * Exit codes (for CI):
 *   0 — success (or nothing to do)
 *   1 — partial failure (some issues failed, others succeeded)
 *   2 — fatal error (couldn't connect to DB / Ollama, bad config, etc.)
 */

import { prisma } from '../db/client';
import { embedText, toPgVectorLiteral } from '../services/embedding.service';
import { contentHash } from '../utils/content-hash';


// ---------------------------------------------------------------------------
// CLI flags & configuration
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || args.has('-n');

const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '16', 10);
const SLEEP_MS   = parseInt(process.env.BACKFILL_SLEEP_MS   || '150', 10);
const PROGRESS_EVERY = parseInt(process.env.BACKFILL_PROGRESS_EVERY || '10', 10);

const EXIT_OK              = 0;
const EXIT_PARTIAL_FAILURE = 1;
const EXIT_FATAL          = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const s = (ms / 1000).toFixed(1);
  return s.length < 5 ? `${s}s` : s;
}

function printSummary(done: number, total: number, failed: number, elapsedMs: number, failures: Array<{ id: string; error: string }>) {
  const line = '═'.repeat(64);
  console.log(`\n${line}`);
  console.log(`✅ ${DRY_RUN ? 'Dry-run' : 'Backfill'} complete in ${formatDuration(elapsedMs)}`);
  console.log(`   Processed: ${done}/${total}`);
  console.log(`   Failed:    ${failed}`);
  if (failures.length > 0) {
    console.log('\n   First failures:');
    for (const f of failures.slice(0, 10)) {
      console.log(`     - ${f.id}: ${f.error.slice(0, 100)}`);
    }
    if (failures.length > 10) {
      console.log(`     ... and ${failures.length - 10} more`);
    }
  }
  console.log(line);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting issue-embedding backfill...');
  if (DRY_RUN) console.log('   (dry-run mode — no embeddings will be stored)');
  console.log(`   batch size: ${BATCH_SIZE}, sleep between batches: ${SLEEP_MS}ms`);
  console.log(`   embedding model: ${process.env.EMBED_MODEL || 'nomic-embed-text'}`);

  // 1. Fetch every issue with its current embedding (if any).
  //    We only need the contentHash from the embedding, not the vector.
  let allIssues;
  try {
    allIssues = await prisma.issue.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        embedding: { select: { contentHash: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch (err: any) {
    console.error('❌ Could not load issues from the database.');
    console.error(`   ${err.message}`);
    process.exit(EXIT_FATAL);
  }

  console.log(`📦 Found ${allIssues.length} issue(s) in the database`);

  // 2. Compute the live contentHash and diff against the stored one.
  //    Issues without an embedding OR with a stale contentHash get queued.
  const toProcess = allIssues.filter((issue) => {
    const hash = contentHash(issue.title, issue.description);
    return !issue.embedding || issue.embedding.contentHash !== hash;
  });
  const skipped = allIssues.length - toProcess.length;
  console.log(`   ${skipped} already up-to-date (contentHash matches)`);
  console.log(`   ${toProcess.length} need (re-)embedding`);

  if (toProcess.length === 0) {
    printSummary(0, 0, 0, Date.now() - startTime, []);
    process.exit(EXIT_OK);
  }

  if (DRY_RUN) {
    console.log('\n   First 5 to process:');
    for (const issue of toProcess.slice(0, 5)) {
      console.log(`     - ${issue.id}: "${issue.title.slice(0, 60)}"`);
    }
    printSummary(0, toProcess.length, 0, Date.now() - startTime, []);
    process.exit(EXIT_OK);
  }

  // 3. Process in batches. Each batch is parallel (Promise.all) so we
  //    overlap Ollama's per-request latency, but we sleep between
  //    batches to keep the local GPU/CPU happy.
  let done = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (issue) => {
        try {
          const text = `${issue.title}. ${issue.description}`.trim();
          const embedding = await embedText(text);
          const vecLiteral = toPgVectorLiteral(embedding);
          const hash = contentHash(issue.title, issue.description);

          // Raw SQL because Prisma doesn't understand pgvector.
          // ON CONFLICT on the unique (issueId) makes this an upsert.
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
          done++;
        } catch (err: any) {
          failed++;
          failures.push({ id: issue.id, error: err?.message || String(err) });
        }
      }),
    );

    // Progress line every PROGRESS_EVERY items (or on the final item).
    if (done % PROGRESS_EVERY < BATCH_SIZE || done === toProcess.length) {
      const pct = Math.round((done / toProcess.length) * 100);
      const elapsed = formatDuration(Date.now() - startTime);
      process.stdout.write(
        `\r   📊 ${done}/${toProcess.length} (${pct}%) — ${failed} failed — ${elapsed} elapsed`,
      );
    }

    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise((r) => setTimeout(r, SLEEP_MS));
    }
  }
  process.stdout.write('\n');

  // 4. Final report + CI-friendly exit code.
  printSummary(done, toProcess.length, failed, Date.now() - startTime, failures);
  process.exit(failed > 0 ? EXIT_PARTIAL_FAILURE : EXIT_OK);
}

main().catch((err) => {
  console.error('\n❌ Fatal error during backfill:');
  console.error(err?.stack || err);
  process.exit(EXIT_FATAL);
});
