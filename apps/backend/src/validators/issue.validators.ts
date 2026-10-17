import { z } from 'zod';

const issueCategoryEnum = z.enum([
  'INFRASTRUCTURE', 'PUBLIC_SAFETY', 'SANITATION', 'UTILITIES', 'HOUSING',
  'ENVIRONMENT', 'TRANSPORTATION', 'EDUCATION', 'HEALTH', 'OTHER',
]);

const issueStatusEnum = z.enum([
  'SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW',
  'RESOLVED', 'VERIFIED', 'REJECTED', 'REOPENED',
]);

export const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: issueCategoryEnum,
  location: z.string().min(1, 'Location is required').max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  wardId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  status: issueStatusEnum,
  note: z.string().max(1000).optional(),
  /** Optional custom notification message sent to the reporter (AI-drafted or edited). */
  notificationMessage: z.string().max(2000).optional(),
});

/** Manual edit — priority override (PLAN feature 4) plus title/description fixes. */
export const updateIssueSchema = z.object({
  priority: z.number().int().min(1, 'Priority must be 1-5').max(5, 'Priority must be 1-5').optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;