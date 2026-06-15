import { z } from 'zod';

const referendumStatusEnum = z.enum(['DRAFT', 'OPEN', 'CLOSED', 'PASSED', 'REJECTED', 'CANCELLED']);
const referendumChoiceEnum = z.enum(['YES', 'NO', 'ABSTAIN']);
const userRoleEnum = z.enum([
  'SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER',
  'STAFF', 'WARD_REP', 'CITIZEN', 'VOLUNTEER', 'AUDITOR', 'MEDIA',
]);

export const createReferendumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  body: z.string().min(1, 'Body is required').max(20000),
  opensAt: z.string().datetime({ message: 'opensAt must be an ISO datetime' }),
  closesAt: z.string().datetime({ message: 'closesAt must be an ISO datetime' }),
  passThreshold: z.number().min(0.01).max(1).optional(),
  minParticipation: z.number().int().min(0).optional(),
  eligibleRoles: z.array(userRoleEnum).optional(),
}).refine(
  (d) => new Date(d.closesAt).getTime() > new Date(d.opensAt).getTime(),
  { message: 'closesAt must be after opensAt', path: ['closesAt'] },
);

export const updateReferendumSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  body: z.string().min(1).max(20000).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  passThreshold: z.number().min(0.01).max(1).optional(),
  minParticipation: z.number().int().min(0).optional(),
  eligibleRoles: z.array(userRoleEnum).optional(),
});

export const referendumStatusSchema = z.object({
  status: referendumStatusEnum,
});

export const castVoteSchema = z.object({
  choice: referendumChoiceEnum,
});

export type CreateReferendumInput = z.infer<typeof createReferendumSchema>;
export type UpdateReferendumInput = z.infer<typeof updateReferendumSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
