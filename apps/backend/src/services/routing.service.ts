import { prisma } from '../db/client';

const CATEGORY_TO_DEPT_CODE: Record<string, string> = {
  INFRASTRUCTURE: 'PW',
  PUBLIC_SAFETY: 'PS',
  SANITATION: 'SAN',
  UTILITIES: 'UT',
  HOUSING: 'HO',
  ENVIRONMENT: 'PR',
  TRANSPORTATION: 'TR',
  EDUCATION: 'HHS',
  HEALTH: 'HHS',
  OTHER: 'PW',
};

/**
 * Ward-aware issue routing (PLAN feature 3 — "category + ward/district").
 *
 * Resolution order:
 *   1. Ward hierarchy — when `wardId` is given and the ward has
 *      `DepartmentWard` assignments, route to the ward's department.
 *      When several departments serve the ward, prefer the one whose
 *      code matches the issue category; otherwise take the ward's
 *      first department (ordered by code, deterministic).
 *   2. Category fallback — the legacy category→code mapping, used
 *      when no ward is given or the ward has no assignments.
 *
 * Returns `undefined` when no department matches (caller leaves the
 * issue unassigned rather than failing the create).
 */
export const routingService = {
  async resolveDepartmentId(category: string, wardId?: string): Promise<string | undefined> {
    if (wardId) {
      const assignments = await prisma.departmentWard.findMany({
        where: { wardId },
        include: { department: true },
        orderBy: { department: { code: 'asc' } },
      });
      if (assignments.length > 0) {
        const categoryCode = CATEGORY_TO_DEPT_CODE[category] || 'PW';
        const categoryMatch = assignments.find((a) => a.department.code === categoryCode);
        return (categoryMatch ?? assignments[0]).department.id;
      }
    }
    const code = CATEGORY_TO_DEPT_CODE[category] || 'PW';
    const dept = await prisma.department.findUnique({ where: { code } });
    return dept?.id;
  },
};
