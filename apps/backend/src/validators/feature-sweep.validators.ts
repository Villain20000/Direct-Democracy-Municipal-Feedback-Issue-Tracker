import { z } from 'zod';

// === B1: Issue subscriptions ===

export const subscribeSchema = z.object({
  // No body required — subscription is derived from URL + authenticated user.
}).optional();

// === B2: Issue share links ===

// `.optional()` on the whole object lets the client POST with an empty
// body (all fields are optional anyway). Without this, zod's strict
// object parse rejects `undefined` and the validate middleware returns
// 400 before the route handler can default `req.body` to `{}`.
export const createShareLinkSchema = z.object({
  expiresInDays: z.number().int().positive().max(365).optional(),
}).optional();

// === B3: Saved searches ===

export const createSavedSearchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  filters: z.record(z.string(), z.unknown()),
});

export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

// === B4: Notification preferences ===

export const updateNotificationPreferenceSchema = z.object({
  channel: z.enum(['inApp', 'email', 'push']),
  type: z.string().min(1).max(50),
  enabled: z.boolean(),
});

export const bulkUpdateNotificationPreferencesSchema = z.object({
  preferences: z.array(updateNotificationPreferenceSchema).min(1).max(50),
});

// === B5: Internal notes ===

export const createInternalNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;
export type BulkUpdateNotificationPreferencesInput = z.infer<typeof bulkUpdateNotificationPreferencesSchema>;
export type CreateInternalNoteInput = z.infer<typeof createInternalNoteSchema>;
