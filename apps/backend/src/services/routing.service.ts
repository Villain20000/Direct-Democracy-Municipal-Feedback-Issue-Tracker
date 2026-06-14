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

export const routingService = {
  async resolveDepartmentId(category: string): Promise<string | undefined> {
    const code = CATEGORY_TO_DEPT_CODE[category] || 'PW';
    const dept = await prisma.department.findUnique({ where: { code } });
    return dept?.id;
  },
};