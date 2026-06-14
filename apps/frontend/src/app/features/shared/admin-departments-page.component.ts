import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Department, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-departments-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  template: `
    <app-layout pageTitle="Departments" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            Access denied. Department management is available to administrators only.
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
            <div class="card-header"><h3>🏢 Departments</h3></div>
            <div class="card-body" style="padding:0;">
              @if (loading) {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">Loading departments...</div>
              } @else {
                <table class="data-table">
                  <thead>
                    <tr><th>Name</th><th>Code</th><th>Description</th><th>Head</th></tr>
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
                      <tr><td colspan="4" style="text-align:center;padding:48px;color:var(--text-muted);">No departments found.</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>➕ Create Department</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <input type="text" [(ngModel)]="newDept.name" placeholder="Department name" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <input type="text" [(ngModel)]="newDept.code" placeholder="Code (e.g. PW)" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <textarea [(ngModel)]="newDept.description" placeholder="Description (optional)" rows="3" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
                <button class="btn btn-primary" [disabled]="creating || !newDept.name || !newDept.code" (click)="createDepartment()">
                  {{ creating ? 'Creating...' : 'Create Department' }}
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

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'Dashboard', route: '/admin' },
      { icon: 'apartment', label: 'Departments', route: '/admin/departments' },
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
        this.error = err.error?.error || 'Failed to load departments.';
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
        this.error = err.error?.error || 'Failed to create department.';
        this.creating = false;
      },
    });
  }
}