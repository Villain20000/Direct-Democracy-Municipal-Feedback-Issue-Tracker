import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Ward, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-wards-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  template: `
    <app-layout pageTitle="Wards" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            Access denied. Ward management is available to administrators only.
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
            <div class="card-header"><h3>🗺 Wards</h3></div>
            <div class="card-body" style="padding:0;">
              @if (loading) {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">Loading wards...</div>
              } @else {
                <table class="data-table">
                  <thead>
                    <tr><th>Name</th><th>Code</th><th>Description</th></tr>
                  </thead>
                  <tbody>
                    @for (ward of wards; track ward.id) {
                      <tr>
                        <td><strong>{{ ward.name }}</strong></td>
                        <td><span class="badge badge-blue">{{ ward.code }}</span></td>
                        <td style="font-size:12px;color:var(--text-secondary);">{{ ward.description || '-' }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3" style="text-align:center;padding:48px;color:var(--text-muted);">No wards found.</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>➕ Create Ward</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <input type="text" [(ngModel)]="newWard.name" placeholder="Ward name" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <input type="text" [(ngModel)]="newWard.code" placeholder="Code (e.g. WD-1)" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <textarea [(ngModel)]="newWard.description" placeholder="Description (optional)" rows="3" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
                <button class="btn btn-primary" [disabled]="creating || !newWard.name || !newWard.code" (click)="createWard()">
                  {{ creating ? 'Creating...' : 'Create Ward' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class AdminWardsPageComponent implements OnInit {
  wards: Ward[] = [];
  loading = true;
  creating = false;
  error = '';
  authorized = false;
  newWard = { name: '', code: '', description: '' };
  navItems: NavItem[] = [];

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'Dashboard', route: '/admin' },
      { icon: 'map', label: 'Wards', route: '/admin/wards' },
    ];
    this.authorized = auth.hasRole(UserRole.SUPER_ADMIN);
  }

  ngOnInit() {
    if (this.authorized) this.loadWards();
    else this.loading = false;
  }

  loadWards() {
    this.loading = true;
    this.error = '';
    this.api.getWards().subscribe({
      next: (res: any) => {
        if (res.success) this.wards = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load wards.';
        this.loading = false;
      },
    });
  }

  createWard() {
    this.creating = true;
    this.error = '';
    this.api.createWard({
      name: this.newWard.name,
      code: this.newWard.code,
      description: this.newWard.description || undefined,
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.wards = [...this.wards, res.data];
          this.newWard = { name: '', code: '', description: '' };
        }
        this.creating = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to create ward.';
        this.creating = false;
      },
    });
  }
}