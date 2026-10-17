import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  code: z.string().min(1, 'Department code is required').max(10).regex(/^[A-Z]+$/, 'Code must be uppercase letters only'),
  description: z.string().max(500).optional(),
  budget: z.number().positive('Budget must be positive').optional(),
  headId: z.string().uuid().optional(),
});

/**
 * GeoJSON Feature carrying a Polygon or MultiPolygon ward boundary.
 * Stored as-is in `Ward.boundary` (Json) and rendered as Leaflet
 * polygons on the issues map + admin ward editor.
 */
const polygonCoords = z.array(z.array(z.array(z.number()).min(2)).min(4)).min(1);

export const wardBoundarySchema = z.object({
  type: z.literal('Feature'),
  properties: z.record(z.string(), z.any()).optional(),
  geometry: z.discriminatedUnion('type', [
    z.object({ type: z.literal('Polygon'), coordinates: polygonCoords }),
    z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygonCoords).min(1) }),
  ]),
}).passthrough().superRefine((val, ctx) => {
  const polys = val.geometry.type === 'Polygon'
    ? [val.geometry.coordinates]
    : val.geometry.coordinates;
  for (const poly of polys) {
    const ring = poly[0];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Polygon rings must be closed (first position equals last)' });
      return;
    }
  }
});

export const createWardSchema = z.object({
  name: z.string().min(1, 'Ward name is required').max(100),
  code: z.string().min(1, 'Ward code is required').max(10).regex(/^WD-\d{1,3}$/, 'Code must match format WD-X to WD-XXX'),
  description: z.string().max(500).optional(),
  boundary: wardBoundarySchema.optional(),
  representativeId: z.string().uuid().optional(),
});

export const updateWardSchema = z.object({
  name: z.string().min(1, 'Ward name is required').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  boundary: wardBoundarySchema.nullable().optional(),
  representativeId: z.string().uuid().nullable().optional(),
});

export const assignDeptWardSchema = z.object({
  departmentId: z.string().uuid('departmentId must be a UUID'),
});

// P2-15 — department update (all fields optional; at least one required).
export const updateDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100).optional(),
  code: z.string().min(1, 'Department code is required').max(10).regex(/^[A-Z]+$/, 'Code must be uppercase letters only').optional(),
  description: z.string().max(500).nullable().optional(),
  budget: z.number().positive('Budget must be positive').nullable().optional(),
  headId: z.string().uuid().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

// P2-15 — ward update already exists (updateWardSchema); ward delete
// takes no body. Department delete accepts an optional reassignment
// target so open issues can be moved instead of blocking the delete.
export const deleteDepartmentSchema = z.object({
  reassignDepartmentId: z.string().uuid('reassignDepartmentId must be a UUID').optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateWardInput = z.infer<typeof createWardSchema>;
