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

        <div class="content-grid">
          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('adminDepartments.header') }}</h3></div>
            <div class="card-body" style="padding:0;">
              @if (loading) {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminDepartments.loading') }}</div>
              } @else {
                <table class="data-table">
                  <thead>
                    <tr><th>{{ i18n.t('adminDepartments.colName') }}</th><th>{{ i18n.t('adminDepartments.colCode') }}</th><th>{{ i18n.t('adminDepartments.colDescription') }}</th><th>{{ i18n.t('adminDepartments.colHead') }}</th></tr>
                  </thead>
                  <tbody>
                    @for (dept of departments; track dept.id) {
                      <tr>
                        <td><strong>{{ dept.name }}</strong></td>
                        <td><span class="badge badge-blue">{{ dept.code }}</span></td>
                        <td style="font-size:12px;color:var(--text-secondary);">{{ dept.description || '-' }}</td>
                        <td style="font-size:12px;">
                          @if (dept.head) {
                            {{ dept.head.firstName }} {{ dept.head.lastName }}
                          } @else { - }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminDepartments.noDepartments') }}</td></tr>
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
}
