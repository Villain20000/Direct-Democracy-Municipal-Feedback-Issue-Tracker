import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  code: z.string().min(1, 'Department code is required').max(10).regex(/^[A-Z]+$/, 'Code must be uppercase letters only'),
  description: z.string().max(500).optional(),
  budget: z.number().positive('Budget must be positive').optional(),
  headId: z.string().uuid().optional(),
});

export const createWardSchema = z.object({
  name: z.string().min(1, 'Ward name is required').max(100),
  code: z.string().min(1, 'Ward code is required').max(10).regex(/^WD-\d{1,3}$/, 'Code must match format WD-X to WD-XXX'),
  description: z.string().max(500).optional(),
  boundary: z.any().optional(),
  representativeId: z.string().uuid().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateWardInput = z.infer<typeof createWardSchema>;
