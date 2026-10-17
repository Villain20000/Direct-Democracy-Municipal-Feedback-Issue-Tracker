import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { budgetService } from '../services/budget.service';
import { auditService } from '../services/audit.service';
import { sendDomainError, ForbiddenError } from '../errors/domain-errors';
import { prisma } from '../db/client';

const router = Router();

/**
 * P1-9 — Budget management API.
 *
 * RBAC (PLAN §5 / §10):
 *   SUPER_ADMIN, MAYOR, AUDITOR      — read everything; admin writes
 *   DEPARTMENT_HEAD                  — read/write own department only
 * Reads are also exposed via /portal/departments for public
 * transparency (headline budget only).
 */

const budgetLineSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  category: z.string().min(1).max(80),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

const expenseSchema = z.object({
  category: z.string().min(1).max(80),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  incurredAt: z.string().optional(),
  budgetLineId: z.string().uuid().optional(),
});

/**
 * Resolve + enforce department scope for a DEPARTMENT_HEAD caller.
 * The JWT only carries id/email/role, so a DEPARTMENT_HEAD's
 * departmentId is read from the User row (User.departmentId —
 * "DepartmentStaff" relation).
 */
async function resolveDepartmentId(req: AuthenticatedRequest, paramDeptId: string): Promise<string> {
  const user = req.user!;
  if (user.role === 'DEPARTMENT_HEAD') {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!row?.departmentId || row.departmentId !== paramDeptId) {
      throw new ForbiddenError('You may only access your own department budget');
    }
  }
  return paramDeptId;
}

const READ_ROLES = ['SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD'] as const;
const WRITE_ROLES = ['SUPER_ADMIN', 'DEPARTMENT_HEAD'] as const;

// GET /budget/overview — cross-department plan vs spend (mayor/auditor/admin;
// MEDIA read-only for the Budget Transparency widget)
router.get('/overview', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'MEDIA'), async (req: AuthenticatedRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await budgetService.getOverview(year);
    res.json({ success: true, data });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.overview]', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /budget/expenses.csv — cross-department expenditure audit trail
// (auditor export, media Budget Transparency download)
router.get('/expenses.csv', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'MEDIA'), async (req: AuthenticatedRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const csv = await budgetService.exportExpensesCsv(undefined, year);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses-export.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error('[budget.expenses.csv]', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /budget/:departmentId/summary — tracker data (planned vs spent per category)
router.get('/:departmentId/summary', authenticate, authorize(...READ_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await budgetService.getSummary(departmentId, year);
    res.json({ success: true, data });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.summary]', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /budget/:departmentId/lines
router.get('/:departmentId/lines', authenticate, authorize(...READ_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await budgetService.listBudgetLines(departmentId, year);
    res.json({ success: true, data });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.lines]', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /budget/:departmentId/lines — create or update (upsert by year+category)
router.post('/:departmentId/lines', authenticate, authorize(...WRITE_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const body = budgetLineSchema.parse(req.body);
    const line = await budgetService.upsertBudgetLine(departmentId, body);
    await auditService.log({
      userId: req.user!.id,
      action: 'UPSERT_BUDGET_LINE',
      entity: 'BudgetLine',
      entityId: line.id,
      newValues: { departmentId, fiscalYear: line.fiscalYear, category: line.category, amount: Number(line.amount) },
    });
    res.status(201).json({ success: true, data: line });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.lines.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /budget/:departmentId/lines/:lineId
router.delete('/:departmentId/lines/:lineId', authenticate, authorize(...WRITE_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const line = await budgetService.deleteBudgetLine(departmentId, req.params.lineId as string);
    await auditService.log({
      userId: req.user!.id,
      action: 'DELETE_BUDGET_LINE',
      entity: 'BudgetLine',
      entityId: line.id,
      oldValues: { departmentId, fiscalYear: line.fiscalYear, category: line.category, amount: Number(line.amount) },
    });
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.lines.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /budget/:departmentId/expenses
router.get('/:departmentId/expenses', authenticate, authorize(...READ_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const data = await budgetService.listExpenses(departmentId, {
      fiscalYear: req.query.year ? parseInt(req.query.year as string) : undefined,
      category: req.query.category as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.expenses]', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /budget/:departmentId/expenses.csv — per-department expenditure export
router.get('/:departmentId/expenses.csv', authenticate, authorize(...READ_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const csv = await budgetService.exportExpensesCsv(departmentId, year);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses-export.csv"');
    res.send(csv);
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.dept.expenses.csv]', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /budget/:departmentId/expenses — record an expenditure
router.post('/:departmentId/expenses', authenticate, authorize(...WRITE_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const body = expenseSchema.parse(req.body);
    const expense = await budgetService.createExpense(departmentId, body, req.user!.id);
    await auditService.log({
      userId: req.user!.id,
      action: 'CREATE_EXPENSE',
      entity: 'Expense',
      entityId: expense.id,
      newValues: { departmentId, category: expense.category, amount: Number(expense.amount) },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.expenses.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /budget/:departmentId/expenses/:expenseId
router.delete('/:departmentId/expenses/:expenseId', authenticate, authorize(...WRITE_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const departmentId = await resolveDepartmentId(req, req.params.departmentId as string);
    const expense = await budgetService.deleteExpense(departmentId, req.params.expenseId as string);
    await auditService.log({
      userId: req.user!.id,
      action: 'DELETE_EXPENSE',
      entity: 'Expense',
      entityId: expense.id,
      oldValues: { departmentId, category: expense.category, amount: Number(expense.amount) },
    });
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[budget.expenses.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
