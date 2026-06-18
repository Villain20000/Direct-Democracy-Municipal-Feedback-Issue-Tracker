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
import { wardDigestService } from './services/ward-digest.service';
import { seasonalForecastService } from './services/seasonal-forecast.service';
import { faqService } from './services/faq.service';

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

/** Daily 07:00 ward rep digest for every ward. */
const wardDigestTask = cron.schedule(
  '0 7 * * *',
  async () => {
    const dateKey = wardDigestService.getTodayKey();
    console.log(`[cron] 07:00 — generating ward digests for ${dateKey}`);
    try {
      const results = await wardDigestService.generateAll('AUTO');
      console.log(`[cron] ward digests: ${results.length} ward(s) processed`);
    } catch (err: any) {
      console.error(`[cron] ward digest generation failed: ${err.message}`);
    }
  },
  {
    timezone: process.env.WEEKLY_SUMMARY_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);
console.log(`📅 Ward-digest cron scheduled (daily 07:00 server time).`);

/** First day of each month at 08:00 — seasonal demand forecast. */
const seasonalForecastTask = cron.schedule(
  '0 8 1 * *',
  async () => {
    const monthKey = seasonalForecastService.getCurrentMonthKey();
    console.log(`[cron] Monthly 08:00 — generating seasonal forecast for ${monthKey}`);
    try {
      const { row, created } = await seasonalForecastService.generate(monthKey, 'AUTO');
      console.log(`[cron] seasonal forecast ${created ? 'created' : 'fetched'} for ${monthKey} (id=${row.id})`);
    } catch (err: any) {
      console.error(`[cron] seasonal forecast failed for ${monthKey}: ${err.message}`);
    }
  },
  {
    timezone: process.env.WEEKLY_SUMMARY_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);
console.log(`📅 Seasonal-forecast cron scheduled (1st of month 08:00).`);

/** Sunday 06:00 — regenerate citizen FAQ knowledge base from resolved issues. */
const faqTask = cron.schedule(
  '0 6 * * 0',
  async () => {
    const weekKey = faqService.getCurrentWeekKey();
    console.log(`[cron] Sunday 06:00 — generating FAQ entries for ${weekKey}`);
    try {
      const result = await faqService.generateWeekly(weekKey, 'AUTO');
      console.log(`[cron] FAQ generation: ${result.created} created (skipped=${result.skipped})`);
    } catch (err: any) {
      console.error(`[cron] FAQ generation failed: ${err.message}`);
    }
  },
  {
    timezone: process.env.WEEKLY_SUMMARY_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);
console.log(`📅 FAQ KB cron scheduled (Sunday 06:00).`);

console.log('   (Press Ctrl+C to stop.)');

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down workers...`);
  try {
    weeklySummaryTask.stop();
    wardDigestTask.stop();
    seasonalForecastTask.stop();
    faqTask.stop();
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
