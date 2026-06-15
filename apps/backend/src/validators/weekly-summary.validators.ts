import { z } from 'zod';

/**
 * Phase C — Weekly summary validators.
 *
 * The POST /weekly-summaries endpoint accepts an optional `weekKey` so an
 * admin can backfill a past week. The format is ISO-8601 week-of-year
 * (`YYYY-Www`, e.g. `2026-W24`). Without a body, the route generates the
 * current week's summary.
 */
export const generateWeeklySummarySchema = z
  .object({
    weekKey: z
      .string()
      .regex(/^\d{4}-W\d{2}$/, 'weekKey must match YYYY-Www (e.g. 2026-W24)')
      .optional(),
    /** Force regeneration even if a row already exists for the week. */
    force: z.boolean().optional().default(false),
  })
  .optional();

export type GenerateWeeklySummaryInput = z.infer<typeof generateWeeklySummarySchema>;
