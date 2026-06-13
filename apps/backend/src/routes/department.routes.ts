import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createDepartmentSchema, createWardSchema } from '../validators/department.validators';
import { prisma } from '../db/client';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: departments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('SUPER_ADMIN'), validate(createDepartmentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const department = await prisma.department.create({ data: req.body });
    res.status(201).json({ success: true, data: department });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/wards', async (_req, res) => {
  try {
    const wards = await prisma.ward.findMany({
      include: {
        representative: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { issues: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: wards });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/wards', authenticate, authorize('SUPER_ADMIN'), validate(createWardSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const ward = await prisma.ward.create({ data: req.body });
    res.status(201).json({ success: true, data: ward });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
