/**
 * Standalone worker entry point.
 *
 * Run with: `npm run worker` (or `tsx src/worker.ts`)
 *
 * Starts the embed-issue worker and the Friday 17:00 weekly-summary cron
 * tick. Use a process supervisor (systemd, pm2, docker, k8s) to keep it
 * up in production. In dev, open a second terminal and run it alongside
 * `npm run dev`.
 */

import cron from 'node-cron';
import { startEmbedIssueWorker, stopEmbedIssueWorker } from './queue/embed-issue.worker';
import { weeklySummaryService } from './services/weekly-summary.service';

console.log('🚀 Starting background workers...');
const worker = startEmbedIssueWorker();
console.log(`✅ Embed-issue worker is running and waiting for jobs.`);

/**
 * Phase C — Friday 17:00 (server local time) weekly briefing.
 *
 * Schedule string: "m h d M w"
 *   m = minute  (0)
 *   h = hour    (17)
 *   d = day-of-month (*)
 *   M = month   (*)
 *   w = day-of-week (5 = Friday)
 *
 * The task is scheduled to fire in the server's local timezone, which
 * matches the docker-compose `TZ` env (defaults to UTC). If you want
 * strict Athens-time (Europe/Athens), set `TZ=Europe/Athens` on the
 * worker container.
 */
const weeklySummaryTask = cron.schedule(
  '0 17 * * 5',
  async () => {
    const weekKey = weeklySummaryService.getCurrentWeekKey();
    console.log(`[cron] Friday 17:00 — generating weekly summary for ${weekKey}`);
    try {
      const { row, created } = await weeklySummaryService.generate(weekKey, { source: 'AUTO' });
      console.log(
        `[cron] weekly summary ${created ? 'created' : 'fetched'} for ${weekKey} (id=${row.id})`,
      );
    } catch (err: any) {
      console.error(`[cron] weekly summary generation failed for ${weekKey}: ${err.message}`);
    }
  },
  {
    timezone: process.env.WEEKLY_SUMMARY_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);
console.log(`📅 Weekly-summary cron scheduled (Fri 17:00 server time, source: AUTO).`);

console.log('   (Press Ctrl+C to stop.)');

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down workers...`);
  try {
    weeklySummaryTask.stop();
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
