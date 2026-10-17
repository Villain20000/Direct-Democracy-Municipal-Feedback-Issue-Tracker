import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createDepartmentSchema, createWardSchema, updateWardSchema, updateDepartmentSchema, deleteDepartmentSchema, assignDeptWardSchema } from '../validators/department.validators';
import { prisma } from '../db/client';
import { Prisma } from '@prisma/client';

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
    console.error('[departments.create]', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/wards', async (_req, res) => {
  try {
    const wards = await prisma.ward.findMany({
      include: {
        representative: { select: { id: true, firstName: true, lastName: true } },
        departments: { include: { department: { select: { id: true, name: true, code: true } } } },
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
    console.error('[departments.createWard]', error);
    res.status(500).json({ error: error.message });
  }
});

// Ward boundary + metadata edit (P1-11 — admin polygon editor persists
// GeoJSON here; `boundary: null` clears the polygon).
router.patch('/wards/:id', authenticate, authorize('SUPER_ADMIN'), validate(updateWardSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const wardId = String(req.params.id);
    const existing = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!existing) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }
    // Prisma distinguishes JSON null from SQL NULL on Json fields;
    // clearing the polygon must write SQL NULL so `IS NULL` filters
    // and falsy frontend checks agree.
    const data: Record<string, unknown> = { ...req.body };
    if (data['boundary'] === null) data['boundary'] = Prisma.DbNull;
    const ward = await prisma.ward.update({
      where: { id: wardId },
      data: data as any,
    });
    res.json({ success: true, data: ward });
  } catch (error: any) {
    console.error('[departments.updateWard]', error);
    res.status(500).json({ error: error.message });
  }
});

// Department↔Ward hierarchy assignments (P1-11 — powers ward-aware
// routing: issues filed in a ward route to the ward's departments).
router.get('/wards/:id/departments', async (req, res) => {
  try {
    const wardId = String(req.params.id);
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }
    const rows = await prisma.departmentWard.findMany({
      where: { wardId }, 
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { department: { code: 'asc' } },
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/wards/:id/departments', authenticate, authorize('SUPER_ADMIN'), validate(assignDeptWardSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const wardId = String(req.params.id);
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }
    const department = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
    if (!department) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    const row = await prisma.departmentWard.upsert({
      where: { departmentId_wardId: { departmentId: req.body.departmentId, wardId } },
      create: { departmentId: req.body.departmentId, wardId },
      update: {},
      include: { department: { select: { id: true, name: true, code: true } } },
    });
    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    console.error('[departments.assignDeptWard]', error);
    res.status(500).json({ error: error.message });
  }
});

// P2-15 — department update (SUPER_ADMIN only). Code uniqueness is
// enforced by the DB; a P2002 violation surfaces as 409.
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), validate(updateDepartmentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = String(req.params.id);
    const existing = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!existing) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    if (req.body.headId) {
      const head = await prisma.user.findUnique({ where: { id: req.body.headId } });
      if (!head) {
        res.status(404).json({ error: 'Head user not found' });
        return;
      }
    }
    const data: Record<string, unknown> = { ...req.body };
    const department = await prisma.department.update({
      where: { id: departmentId },
      data: data as any,
    });
    res.json({ success: true, data: department });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'A department with this code already exists' });
      return;
    }
    console.error('[departments.update]', error);
    res.status(500).json({ error: error.message });
  }
});

// P2-15 — department delete (SUPER_ADMIN only) with reassignment
// guards. Open issues can be moved to another department via
// `reassignDepartmentId`; staff members, head assignment, ward
// assignments, and budget records block the delete with a 409 that
// names the blocker so the admin UI can explain it.
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = String(req.params.id);
    const parsed = deleteDepartmentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const existing = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        _count: { select: { issues: true, staff: true, wards: true, budgetLines: true, expenses: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    const blockers: string[] = [];
    if (existing.headId) blockers.push('department head is assigned (unassign the head first)');
    if (existing._count.staff > 0) blockers.push(`${existing._count.staff} staff member(s) belong to this department`);
    if (existing._count.wards > 0) blockers.push(`${existing._count.wards} ward assignment(s) reference this department`);
    if (existing._count.budgetLines > 0 || existing._count.expenses > 0) {
      blockers.push('budget records reference this department (financial trail cannot be orphaned)');
    }
    let reassigned = 0;
    if (existing._count.issues > 0) {
      const targetId = parsed.data.reassignDepartmentId;
      if (!targetId) {
        blockers.push(`${existing._count.issues} issue(s) belong to this department (pass reassignDepartmentId to move them)`);
      } else if (targetId === departmentId) {
        res.status(400).json({ error: 'reassignDepartmentId must be a different department' });
        return;
      } else {
        const target = await prisma.department.findUnique({ where: { id: targetId } });
        if (!target) {
          res.status(404).json({ error: 'Reassignment target department not found' });
          return;
        }
        const moved = await prisma.issue.updateMany({
          where: { departmentId },
          data: { departmentId: targetId },
        });
        reassigned = moved.count;
      }
    }
    if (blockers.length > 0) {
      res.status(409).json({ error: 'Department cannot be deleted', blockers });
      return;
    }
    // Config join rows have no DB-level cascade — remove them first.
    await prisma.departmentWard.deleteMany({ where: { departmentId } });
    await prisma.department.delete({ where: { id: departmentId } });
    res.json({ success: true, data: { removed: true, reassigned } });
  } catch (error: any) {
    console.error('[departments.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

// P2-15 — ward delete (SUPER_ADMIN only) with reassignment guards.
// Issues, resident users, and ward digests block the delete (409);
// Department↔Ward assignments are config and cascade.
router.delete('/wards/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const wardId = String(req.params.id);
    const existing = await prisma.ward.findUnique({
      where: { id: wardId },
      include: {
        _count: { select: { issues: true, users: true, departments: true, digests: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }
    const blockers: string[] = [];
    if (existing._count.issues > 0) blockers.push(`${existing._count.issues} issue(s) belong to this ward`);
    if (existing._count.users > 0) blockers.push(`${existing._count.users} resident user(s) belong to this ward`);
    if (existing._count.digests > 0) blockers.push(`${existing._count.digests} ward digest(s) reference this ward`);
    if (blockers.length > 0) {
      res.status(409).json({ error: 'Ward cannot be deleted', blockers });
      return;
    }
    await prisma.departmentWard.deleteMany({ where: { wardId } });
    await prisma.ward.delete({ where: { id: wardId } });
    res.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    console.error('[departments.deleteWard]', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/wards/:id/departments/:departmentId', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const wardId = String(req.params.id);
    const departmentId = String(req.params.departmentId);
    const row = await prisma.departmentWard.findUnique({
      where: { departmentId_wardId: { departmentId, wardId } },
    });
    if (!row) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    await prisma.departmentWard.delete({ where: { id: row.id } });
    res.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    console.error('[departments.unassignDeptWard]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
