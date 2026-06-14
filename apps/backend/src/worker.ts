/**
 * Standalone worker entry point.
 *
 * Run with: `npm run worker` (or `tsx src/worker.ts`)
 *
 * Starts the embed-issue worker and keeps it running. Use a process
 * supervisor (systemd, pm2, docker, k8s) to keep it up in production.
 * In dev, open a second terminal and run it alongside `npm run dev`.
 */

import { startEmbedIssueWorker, stopEmbedIssueWorker } from './queue/embed-issue.worker';

console.log('🚀 Starting background workers...');
const worker = startEmbedIssueWorker();
console.log(`✅ Embed-issue worker is running and waiting for jobs.`);
console.log('   (Press Ctrl+C to stop.)');

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down workers...`);
  try {
    await stopEmbedIssueWorker();
    console.log('👋 Workers stopped cleanly. Bye!');
    process.exit(0);
  } catch (err: any) {
    console.error(`Error during shutdown: ${err?.message || err}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Surface unexpected errors so they don't kill the process silently.
process.on('unhandledRejection', (err) => {
  console.error('[worker] Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception:', err);
});

// Note: BullMQ 5.x's Worker does NOT emit a public 'ready' event —
// the log line above ("Embed-issue worker is running and waiting for
// jobs.") is the best we can do for now. The underlying ioredis
// connection does emit 'ready' privately, but exposing that here would
// be a leaky abstraction. If you need true readiness semantics, switch
// to `await worker.run()` (added in 5.x) and use its promise.
