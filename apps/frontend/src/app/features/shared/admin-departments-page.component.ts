import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Department, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-departments-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  template: `
    <app-layout [pageTitle]="i18n.t('adminDepartments.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            {{ i18n.t('adminDepartments.accessDenied') }}
          </div>
        </div>
      } @else {
        @if (error) {
          <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
            <div class="card-body" style="color:var(--danger);">{{ error }}</div>
          </div>
        }
        @if (actionMsg) {
          <div class="card" style="margin-bottom:24px;" [style.border-color]="actionOk ? 'var(--success)' : 'var(--danger)'">
            <div class="card-body" [style.color]="actionOk ? 'var(--success)' : 'var(--danger)'" style="font-size:13px;">{{ actionMsg }}</div>
          </div>
        }

        <div class="content-grid">
          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('adminDepartments.header') }}</h3></div>
            <div class="card-body" style="padding:0;">
              @if (loading) {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminDepartments.loading') }}</div>
              } @else {
                <table class="data-table">
                  <thead>
                    <tr><th>{{ i18n.t('adminDepartments.colName') }}</th><th>{{ i18n.t('adminDepartments.colCode') }}</th><th>{{ i18n.t('adminDepartments.colDescription') }}</th><th>{{ i18n.t('adminDepartments.colHead') }}</th><th>{{ i18n.t('adminDepartments.colActions') }}</th></tr>
                  </thead>
                  <tbody>
                    @for (dept of departments; track dept.id) {
                      @if (editingId === dept.id) {
                        <tr>
                          <td><input type="text" [(ngModel)]="editName" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" /></td>
                          <td><input type="text" [(ngModel)]="editCode" style="width:90px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" /></td>
                          <td><input type="text" [(ngModel)]="editDesc" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" /></td>
                          <td style="font-size:12px;">
                            @if (dept.head) {
                              {{ dept.head.firstName }} {{ dept.head.lastName }}
                            } @else { - }
                          </td>
                          <td>
                            <div style="display:flex;gap:4px;">
                              <button type="button" class="btn btn-primary btn-sm" [disabled]="savingEdit" (click)="saveEdit(dept)">{{ i18n.t('adminDepartments.saveBtn') }}</button>
                              <button type="button" class="btn btn-ghost btn-sm" [disabled]="savingEdit" (click)="cancelEdit()">{{ i18n.t('common.cancel') }}</button>
                            </div>
                          </td>
                        </tr>
                      } @else {
                        <tr>
                          <td><strong>{{ dept.name }}</strong></td>
                          <td><span class="badge badge-blue">{{ dept.code }}</span></td>
                          <td style="font-size:12px;color:var(--text-secondary);">{{ dept.description || '-' }}</td>
                          <td style="font-size:12px;">
                            @if (dept.head) {
                              {{ dept.head.firstName }} {{ dept.head.lastName }}
                            } @else { - }
                          </td>
                          <td>
                            <div style="display:flex;gap:4px;">
                              <button type="button" class="btn btn-secondary btn-sm" (click)="startEdit(dept)">{{ i18n.t('adminDepartments.editBtn') }}</button>
                              <button type="button" class="btn btn-secondary btn-sm" [disabled]="deletingId === dept.id" (click)="deleteDepartment(dept)">{{ deletingId === dept.id ? i18n.t('adminDepartments.deleting') : i18n.t('adminDepartments.deleteBtn') }}</button>
                            </div>
                          </td>
                        </tr>
                      }
                    } @empty {
                      <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminDepartments.noDepartments') }}</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('adminDepartments.createHeader') }}</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <input type="text" [(ngModel)]="newDept.name" [placeholder]="i18n.t('adminDepartments.namePlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <input type="text" [(ngModel)]="newDept.code" [placeholder]="i18n.t('adminDepartments.codePlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <textarea [(ngModel)]="newDept.description" [placeholder]="i18n.t('adminDepartments.descPlaceholder')" rows="3" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
                <button class="btn btn-primary" [disabled]="creating || !newDept.name || !newDept.code" (click)="createDepartment()">
                  {{ creating ? i18n.t('adminDepartments.creating') : i18n.t('adminDepartments.createBtn') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class AdminDepartmentsPageComponent implements OnInit {
  departments: Department[] = [];
  loading = true;
  creating = false;
  error = '';
  authorized = false;
  newDept = { name: '', code: '', description: '' };
  // P2-15 — inline edit + delete state
  editingId = '';
  editName = '';
  editCode = '';
  editDesc = '';
  savingEdit = false;
  deletingId = '';
  actionMsg = '';
  actionOk = false;
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'nav.dashboard', route: '/admin' },
      { icon: 'apartment', label: 'nav.departments', route: '/admin/departments' },
    ];
    this.authorized = auth.hasRole(UserRole.SUPER_ADMIN);
  }

  ngOnInit() {
    if (this.authorized) this.loadDepartments();
    else this.loading = false;
  }

  loadDepartments() {
    this.loading = true;
    this.error = '';
    this.api.getDepartments().subscribe({
      next: (res: any) => {
        if (res.success) this.departments = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('adminDepartments.loadFailed');
        this.loading = false;
      },
    });
  }

  createDepartment() {
    this.creating = true;
    this.error = '';
    this.api.createDepartment({
      name: this.newDept.name,
      code: this.newDept.code.toUpperCase(),
      description: this.newDept.description || undefined,
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.departments = [...this.departments, res.data];
          this.newDept = { name: '', code: '', description: '' };
        }
        this.creating = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('adminDepartments.createFailed');
        this.creating = false;
      },
    });
  }

  // -----------------------------------------------------------------
  // P2-15 — inline edit + delete with reassignment guards
  // -----------------------------------------------------------------
  startEdit(dept: Department) {
    this.editingId = dept.id;
    this.editName = dept.name;
    this.editCode = dept.code;
    this.editDesc = dept.description || '';
    this.actionMsg = '';
  }

  cancelEdit() {
    this.editingId = '';
  }

  saveEdit(dept: Department) {
    if (this.savingEdit) return;
    this.savingEdit = true;
    this.actionMsg = '';
    this.api.updateDepartment(dept.id, {
      name: this.editName.trim() || undefined,
      code: this.editCode.trim().toUpperCase() || undefined,
      description: this.editDesc.trim() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.savingEdit = false;
        if (res.success) {
          this.departments = this.departments.map((d) => (d.id === dept.id ? { ...d, ...res.data } : d));
          this.editingId = '';
          this.actionOk = true;
          this.actionMsg = this.i18n.t('adminDepartments.updateOk');
        }
      },
      error: (err) => {
        this.savingEdit = false;
        this.actionOk = false;
        const details = err.error?.details?.map((d: any) => d.message).join('; ');
        this.actionMsg = err.error?.error === 'A department with this code already exists'
          ? this.i18n.t('adminDepartments.codeConflict')
          : details || err.error?.error || this.i18n.t('adminDepartments.updateFailed');
      },
    });
  }

  deleteDepartment(dept: Department) {
    if (this.deletingId) return;
    const reassignedTo = this.promptReassign(dept);
    if (reassignedTo === null) return;
    this.deletingId = dept.id;
    this.actionMsg = '';
    this.api.deleteDepartment(dept.id, reassignedTo || undefined).subscribe({
      next: (res: any) => {
        this.deletingId = '';
        if (res.success) {
          this.departments = this.departments.filter((d) => d.id !== dept.id);
          this.actionOk = true;
          this.actionMsg = res.data?.reassigned
            ? this.i18n.t('adminDepartments.deleteOkReassigned', { n: res.data.reassigned })
            : this.i18n.t('adminDepartments.deleteOk');
        }
      },
      error: (err) => {
        this.deletingId = '';
        this.actionOk = false;
        const blockers = err.error?.blockers?.join(' ');
        this.actionMsg = blockers || err.error?.error || this.i18n.t('adminDepartments.deleteFailed');
      },
    });
  }

  /**
   * Confirm the delete; when the department still owns issues, offer to
   * move them by asking for a target department code. Returns the
   * target department id, '' for a plain delete, or null to abort.
   */
  private promptReassign(dept: Department): string | null {
    const issueCount = (dept as any)._count?.issues;
    if (!window.confirm(this.i18n.t('adminDepartments.deleteConfirm', { name: dept.name }))) return null;
    if (issueCount > 0) {
      const codes = this.departments.filter((d) => d.id !== dept.id).map((d) => d.code).join(', ');
      const code = window.prompt(this.i18n.t('adminDepartments.reassignPrompt', { n: issueCount, codes }), '');
      if (code === null) return null;
      const target = this.departments.find((d) => d.code === code.trim().toUpperCase());
      if (!target) {
        this.actionOk = false;
        this.actionMsg = this.i18n.t('adminDepartments.reassignTargetMissing');
        return null;
      }
      return target.id;
    }
    return '';
  }
}
