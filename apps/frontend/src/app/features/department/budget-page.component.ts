import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, BudgetSummary, BudgetLine, Expense } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChartComponent } from '../shared/chart.component';

/**
 * P1-9 — Budget tracker page (PLAN §10 — department head "Department
 * budget tracker", admin/mayor oversight).
 *
 * Shows the plan-vs-spend doughnut, per-category progress, and lets a
 * department head / admin record budget lines and expenses. All data
 * comes from /api/v1/budget/* (RBAC + department-scoped server-side).
 */
@Component({
  selector: 'app-budget-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, CurrencyPipe, DatePipe, TranslatePipe, ChartComponent],
  template: `
    <app-layout [pageTitle]="i18n.t('budget.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (!departmentId) {
        <div class="card"><div class="card-body" style="padding:32px;text-align:center;color:var(--text-muted);">
          {{ 'budget.noDepartment' | t }}
        </div></div>
      } @else {
        @if (summary) {
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">account_balance_wallet</i></div><div class="stat-info"><div class="stat-value">{{ summary.totalBudget | currency:'USD':'symbol':'1.0-0' }}</div><div class="stat-label">{{ 'budget.totalBudget' | t }}</div></div></div>
            <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">shopping_cart</i></div><div class="stat-info"><div class="stat-value">{{ summary.totalSpent | currency:'USD':'symbol':'1.0-0' }}</div><div class="stat-label">{{ 'budget.spent' | t }}</div></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">savings</i></div><div class="stat-info"><div class="stat-value">{{ summary.totalRemaining | currency:'USD':'symbol':'1.0-0' }}</div><div class="stat-label">{{ 'budget.remaining' | t }}</div></div></div>
            <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">percent</i></div><div class="stat-info"><div class="stat-value">{{ summary.pctUsed }}%</div><div class="stat-label">{{ 'budget.usedPct' | t }}</div></div></div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px;">
            <div class="card">
              <div class="card-header"><h3>{{ 'budget.allocationVsSpending' | t }}</h3></div>
              <div class="card-body">
                <app-chart
                  kind="doughnut"
                  [labels]=\"['budget.chartSpent' | t, 'budget.chartRemaining' | t]\"
                  [data]=\"[summary.totalSpent, Math.max(0, summary.totalRemaining)]\"
                  [colors]=\"['#DC2626', '#16A34A']\"
                  [height]=\"220\" />
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3>{{ 'budget.byCategory' | t }}</h3></div>
              <div class="card-body">
                @if (summary.categories.length) {
                  <app-chart
                    kind=\"bar\"
                    [labels]=\"categoryLabels\"
                    [data]=\"plannedData\"
                    [data2]=\"spentData\"
                    [datasetLabel]=\"'budget.chartPlanned' | t\"
                    [datasetLabel2]=\"'budget.chartSpentLabel' | t\"
                    [height]=\"220\" />
                } @else {
                  <p style=\"color:var(--text-muted);font-size:13px;\">{{ 'budget.noLines' | t }}</p>
                }
              </div>
            </div>
          </div>
        }

        @if (canEdit) {
          <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px;\">
            <div class=\"card\">
              <div class=\"card-header\"><h3>{{ 'budget.addLine' | t }}</h3></div>
              <div class=\"card-body\">
                <div style=\"display:flex;flex-direction:column;gap:10px;\">
                  <input class=\"form-input\" [(ngModel)]=\"lineForm.category\" [placeholder]=\"'budget.category' | t\" />
                  <input class=\"form-input\" type=\"number\" min=\"1\" [(ngModel)]=\"lineForm.amount\" [placeholder]=\"'budget.amount' | t\" />
                  <input class=\"form-input\" [(ngModel)]=\"lineForm.note\" [placeholder]=\"'budget.note' | t\" />
                  <button class=\"btn btn-primary\" [disabled]=\"lineSaving || !lineForm.category || !lineForm.amount\" (click)=\"saveLine()\">
                    {{ lineSaving ? ('common.loading' | t) : ('budget.saveLine' | t) }}
                  </button>
                </div>
              </div>
            </div>
            <div class=\"card\">
              <div class=\"card-header\"><h3>{{ 'budget.addExpense' | t }}</h3></div>
              <div class=\"card-body\">
                <div style=\"display:flex;flex-direction:column;gap:10px;\">
                  <input class=\"form-input\" [(ngModel)]=\"expenseForm.category\" [placeholder]=\"'budget.category' | t\" />
                  <input class=\"form-input\" type=\"number\" min=\"1\" [(ngModel)]=\"expenseForm.amount\" [placeholder]=\"'budget.amount' | t\" />
                  <input class=\"form-input\" [(ngModel)]=\"expenseForm.description\" [placeholder]=\"'budget.description' | t\" />
                  <button class=\"btn btn-primary\" [disabled]=\"expenseSaving || !expenseForm.category || !expenseForm.amount\" (click)=\"saveExpense()\">
                    {{ expenseSaving ? ('common.loading' | t) : ('budget.saveExpense' | t) }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        <div class=\"card\" style=\"margin-bottom:16px;\">
          <div class=\"card-header\"><h3>{{ 'budget.linesTitle' | t }}</h3></div>
          <div class=\"card-body\" style=\"padding:0;\">
            <table class=\"data-table\">
              <thead><tr><th>{{ 'budget.category' | t }}</th><th>{{ 'budget.year' | t }}</th><th>{{ 'budget.amount' | t }}</th><th></th></tr></thead>
              <tbody>
                @for (line of lines; track line.id) {
                  <tr>
                    <td><strong>{{ line.category }}</strong>@if (line.note) { <span style=\"color:var(--text-muted);font-size:12px;margin-left:6px;\">{{ line.note }}</span> }</td>
                    <td>{{ line.fiscalYear }}</td>
                    <td>{{ line.amount | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td style=\"text-align:right;\">
                      @if (canEdit) {
                        <button class=\"btn btn-ghost btn-sm\" (click)=\"removeLine(line.id)\">✕</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan=\"4\" style=\"padding:24px;text-align:center;color:var(--text-muted);\">{{ 'budget.noLines' | t }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"card-header\"><h3>{{ 'budget.expensesTitle' | t }}</h3></div>
          <div class=\"card-body\" style=\"padding:0;\">
            <table class=\"data-table\">
              <thead><tr><th>{{ 'budget.date' | t }}</th><th>{{ 'budget.category' | t }}</th><th>{{ 'budget.description' | t }}</th><th>{{ 'budget.amount' | t }}</th><th></th></tr></thead>
              <tbody>
                @for (expense of expenses; track expense.id) {
                  <tr>
                    <td>{{ expense.incurredAt | date:'mediumDate' }}</td>
                    <td><strong>{{ expense.category }}</strong></td>
                    <td style=\"color:var(--text-muted);\">{{ expense.description || '—' }}</td>
                    <td>{{ expense.amount | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td style=\"text-align:right;\">
                      @if (canEdit) {
                        <button class=\"btn btn-ghost btn-sm\" (click)=\"removeExpense(expense.id)\">✕</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan=\"5\" style=\"padding:24px;text-align:center;color:var(--text-muted);\">{{ 'budget.noExpenses' | t }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class BudgetPageComponent implements OnInit {
  departmentId: string | null = null;
  summary: BudgetSummary | null = null;
  lines: BudgetLine[] = [];
  expenses: Expense[] = [];
  canEdit = false;

  lineForm = { category: '', amount: 0, note: '' };
  expenseForm = { category: '', amount: 0, description: '' };
  lineSaving = false;
  expenseSaving = false;

  Math = Math;
  categoryLabels: string[] = [];
  plannedData: number[] = [];
  spentData: number[] = [];

  navItems: NavItem[] = [];
  i18n = inject(TranslationService);
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  ngOnInit() {
    const user = this.auth.user();
    this.departmentId = user?.departmentId ?? null;
    this.canEdit = user?.role === 'DEPARTMENT_HEAD' || user?.role === 'SUPER_ADMIN';
    this.navItems = [{ icon: 'arrow_back', label: 'common.back', route: '/department' }] as any;
    if (this.departmentId) this.reload();
  }

  reload() {
    if (!this.departmentId) return;
    const deptId = this.departmentId;
    this.api.getBudgetSummary(deptId).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.summary = res.data;
        this.categoryLabels = res.data.categories.map((c) => c.category);
        this.plannedData = res.data.categories.map((c) => c.planned);
        this.spentData = res.data.categories.map((c) => c.spent);
      },
      error: () => {},
    });
    this.api.getBudgetLines(deptId).subscribe({
      next: (res) => { if (res.success) this.lines = res.data; },
      error: () => {},
    });
    this.api.getExpenses(deptId, { limit: 100 }).subscribe({
      next: (res) => { if (res.success) this.expenses = res.data; },
      error: () => {},
    });
  }

  saveLine() {
    if (!this.departmentId || !this.lineForm.category || !this.lineForm.amount) return;
    this.lineSaving = true;
    this.api.saveBudgetLine(this.departmentId, {
      category: this.lineForm.category.trim(),
      amount: Number(this.lineForm.amount),
      note: this.lineForm.note.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.lineSaving = false;
        if (res.success) {
          this.toast.success(this.i18n.t('budget.lineSaved'));
          this.lineForm = { category: '', amount: 0, note: '' };
          this.reload();
        }
      },
      error: (err) => {
        this.lineSaving = false;
        this.toast.error(err.error?.error || this.i18n.t('budget.saveFailed'));
      },
    });
  }

  removeLine(lineId: string) {
    if (!this.departmentId) return;
    this.api.deleteBudgetLine(this.departmentId, lineId).subscribe({
      next: () => { this.toast.success(this.i18n.t('budget.lineDeleted')); this.reload(); },
      error: () => this.toast.error(this.i18n.t('budget.saveFailed')),
    });
  }

  saveExpense() {
    if (!this.departmentId || !this.expenseForm.category || !this.expenseForm.amount) return;
    this.expenseSaving = true;
    this.api.createExpense(this.departmentId, {
      category: this.expenseForm.category.trim(),
      amount: Number(this.expenseForm.amount),
      description: this.expenseForm.description.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.expenseSaving = false;
        if (res.success) {
          this.toast.success(this.i18n.t('budget.expenseSaved'));
          this.expenseForm = { category: '', amount: 0, description: '' };
          this.reload();
        }
      },
      error: (err) => {
        this.expenseSaving = false;
        this.toast.error(err.error?.error || this.i18n.t('budget.saveFailed'));
      },
    });
  }

  removeExpense(expenseId: string) {
    if (!this.departmentId) return;
    this.api.deleteExpense(this.departmentId, expenseId).subscribe({
      next: () => { this.toast.success(this.i18n.t('budget.expenseDeleted')); this.reload(); },
      error: () => this.toast.error(this.i18n.t('budget.saveFailed')),
    });
  }
}
