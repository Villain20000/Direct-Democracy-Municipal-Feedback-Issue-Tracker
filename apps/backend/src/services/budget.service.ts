import { prisma } from '../db/client';
import { NotFoundError, BadRequestError } from '../errors/domain-errors';

/**
 * P1-9 — Budget management (PLAN §10: department-head budget tracker,
 * mayor allocation-vs-spending chart, council budget impact reports,
 * auditor expenditure audit trail).
 *
 * Data model:
 *   BudgetLine — planned allocation per (department, fiscal year, category)
 *   Expense    — recorded expenditure per department (optionally tied
 *                to a budget line)
 *
 * `getCurrentYear()` helpers keep the dashboard queries simple; the
 * summary endpoint returns plan / spent / remaining per category so
 * charts can render without extra round-trips.
 */
export const budgetService = {
  getCurrentYear(): number {
    return new Date().getFullYear();
  },

  /** Validate a department exists (used by routes before writes). */
  async assertDepartment(departmentId: string) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundError('Department not found');
    return dept;
  },

  /**
   * Budget vs spend summary for one department.
   * Returns per-category rows plus totals for the tracker / charts.
   */
  async getSummary(departmentId: string, fiscalYear?: number) {
    const year = fiscalYear ?? this.getCurrentYear();
    await this.assertDepartment(departmentId);

    const [lines, expenses, department] = await Promise.all([
      prisma.budgetLine.findMany({
        where: { departmentId, fiscalYear: year },
        orderBy: { category: 'asc' },
      }),
      prisma.expense.findMany({
        where: {
          departmentId,
          incurredAt: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        },
        select: { category: true, amount: true },
      }),
      prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true, code: true, budget: true },
      }),
    ]);

    const spentByCategory: Record<string, number> = {};
    for (const e of expenses) {
      spentByCategory[e.category] = (spentByCategory[e.category] || 0) + Number(e.amount);
    }

    const categories = new Set<string>([
      ...lines.map((l) => l.category),
      ...Object.keys(spentByCategory),
    ]);

    const rows = [...categories].sort().map((category) => {
      const line = lines.find((l) => l.category === category);
      const planned = line ? Number(line.amount) : 0;
      const spent = Math.round((spentByCategory[category] || 0) * 100) / 100;
      return {
        category,
        budgetLineId: line?.id ?? null,
        planned,
        spent,
        remaining: Math.round((planned - spent) * 100) / 100,
        // When there's no budget line we can't compute a percentage;
        // the FE renders "—" for that case.
        pctUsed: planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : null,
      };
    });

    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalSpent = Math.round(rows.reduce((s, r) => s + r.spent, 0) * 100) / 100;
    // Fall back to the legacy Department.budget headline when no
    // budget lines exist yet so the tracker isn't blank on day one.
    const headlineBudget = department?.budget != null ? Number(department.budget) : 0;
    const totalBudget = totalPlanned > 0 ? totalPlanned : headlineBudget;

    return {
      fiscalYear: year,
      department: department
        ? { id: department.id, name: department.name, code: department.code }
        : null,
      totalBudget,
      totalPlanned,
      totalSpent,
      totalRemaining: Math.round((totalBudget - totalSpent) * 100) / 100,
      pctUsed: totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0,
      categories: rows,
    };
  },

  async listBudgetLines(departmentId: string, fiscalYear?: number) {
    await this.assertDepartment(departmentId);
    return prisma.budgetLine.findMany({
      where: { departmentId, ...(fiscalYear != null ? { fiscalYear } : {}) },
      orderBy: [{ fiscalYear: 'desc' }, { category: 'asc' }],
    });
  },

  async upsertBudgetLine(
    departmentId: string,
    data: { fiscalYear?: number; category: string; amount: number; note?: string },
  ) {
    await this.assertDepartment(departmentId);
    const year = data.fiscalYear ?? this.getCurrentYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestError('fiscalYear must be an integer between 2000 and 2100');
    }
    if (!(data.amount > 0)) throw new BadRequestError('amount must be positive');
    const category = data.category.trim();
    if (!category) throw new BadRequestError('category is required');

    return prisma.budgetLine.upsert({
      where: { departmentId_fiscalYear_category: { departmentId, fiscalYear: year, category } },
      create: { departmentId, fiscalYear: year, category, amount: data.amount, note: data.note },
      update: { amount: data.amount, ...(data.note !== undefined ? { note: data.note } : {}) },
    });
  },

  async deleteBudgetLine(departmentId: string, lineId: string) {
    const line = await prisma.budgetLine.findUnique({ where: { id: lineId } });
    if (!line || line.departmentId !== departmentId) throw new NotFoundError('Budget line not found');
    return prisma.budgetLine.delete({ where: { id: lineId } });
  },

  async listExpenses(departmentId: string, opts: { fiscalYear?: number; category?: string; limit?: number } = {}) {
    await this.assertDepartment(departmentId);
    const year = opts.fiscalYear;
    return prisma.expense.findMany({
      where: {
        departmentId,
        ...(year != null
          ? {
              incurredAt: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              },
            }
          : {}),
        ...(opts.category ? { category: opts.category } : {}),
      },
      orderBy: { incurredAt: 'desc' },
      take: Math.min(Math.max(opts.limit ?? 100, 1), 1000),
      include: {
        budgetLine: { select: { category: true, fiscalYear: true } },
      },
    });
  },

  async createExpense(
    departmentId: string,
    data: {
      category: string; amount: number; description?: string;
      incurredAt?: string; budgetLineId?: string;
    },
    recordedById?: string,
  ) {
    await this.assertDepartment(departmentId);
    if (!(data.amount > 0)) throw new BadRequestError('amount must be positive');
    const category = data.category.trim();
    if (!category) throw new BadRequestError('category is required');

    if (data.budgetLineId) {
      const line = await prisma.budgetLine.findUnique({ where: { id: data.budgetLineId } });
      if (!line || line.departmentId !== departmentId) {
        throw new BadRequestError('budgetLineId does not belong to this department');
      }
    }

    const incurredAt = data.incurredAt ? new Date(data.incurredAt) : new Date();
    if (Number.isNaN(incurredAt.getTime())) throw new BadRequestError('incurredAt must be a valid date');

    return prisma.expense.create({
      data: {
        departmentId,
        category,
        amount: data.amount,
        description: data.description,
        incurredAt,
        budgetLineId: data.budgetLineId,
        recordedById,
      },
    });
  },

  async deleteExpense(departmentId: string, expenseId: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.departmentId !== departmentId) throw new NotFoundError('Expense not found');
    return prisma.expense.delete({ where: { id: expenseId } });
  },

  /**
   * Expense audit-trail CSV for the auditor / media transparency exports.
   * Columns: id, department, category, amount, description, incurredAt,
   * budgetLine, recordedBy. Optionally scoped to one department + year.
   */
  async exportExpensesCsv(departmentId?: string, fiscalYear?: number) {
    if (departmentId) await this.assertDepartment(departmentId);
    const where: any = { ...(departmentId ? { departmentId } : {}) };
    if (fiscalYear != null) {
      where.incurredAt = {
        gte: new Date(Date.UTC(fiscalYear, 0, 1)),
        lt: new Date(Date.UTC(fiscalYear + 1, 0, 1)),
      };
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { incurredAt: 'desc' },
      take: 5000,
      include: {
        department: { select: { name: true, code: true } },
        budgetLine: { select: { category: true, fiscalYear: true } },
      },
    });
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['id', 'department', 'deptCode', 'category', 'amount', 'description', 'incurredAt', 'budgetLine', 'recordedBy'];
    const rows = expenses.map((e) =>
      [
        e.id,
        e.department?.name ?? '',
        e.department?.code ?? '',
        e.category,
        Number(e.amount).toFixed(2),
        e.description ?? '',
        e.incurredAt.toISOString(),
        e.budgetLine ? `${e.budgetLine.category} (FY${e.budgetLine.fiscalYear})` : '',
        (e as any).recordedById ?? '',
      ]
        .map(esc)
        .join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Cross-department overview for the mayor / auditor dashboards:
   * every department's plan vs spend for the fiscal year.
   */
  async getOverview(fiscalYear?: number) {
    const year = fiscalYear ?? this.getCurrentYear();
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true, budget: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      departments.map(async (dept) => {
        const [lines, expenses] = await Promise.all([
          prisma.budgetLine.aggregate({
            where: { departmentId: dept.id, fiscalYear: year },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: {
              departmentId: dept.id,
              incurredAt: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              },
            },
            _sum: { amount: true },
          }),
        ]);
        const planned = lines._sum.amount != null ? Number(lines._sum.amount) : 0;
        const spent = expenses._sum.amount != null ? Number(expenses._sum.amount) : 0;
        const total = planned > 0 ? planned : dept.budget != null ? Number(dept.budget) : 0;
        return {
          departmentId: dept.id,
          name: dept.name,
          code: dept.code,
          fiscalYear: year,
          budget: total,
          planned,
          spent,
          remaining: Math.round((total - spent) * 100) / 100,
          pctUsed: total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0,
        };
      }),
    );
  },
};
