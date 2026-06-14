import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Ward, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-wards-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  template: `
    <app-layout [pageTitle]="i18n.t('adminWards.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            {{ i18n.t('adminWards.accessDenied') }}
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
            <div class="card-header"><h3>{{ i18n.t('adminWards.header') }}</h3></div>
            <div class="card-body" style="padding:0;">
              @if (loading) {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminWards.loading') }}</div>
              } @else {
                <table class="data-table">
                  <thead>
                    <tr><th>{{ i18n.t('adminWards.colName') }}</th><th>{{ i18n.t('adminWards.colCode') }}</th><th>{{ i18n.t('adminWards.colDescription') }}</th></tr>
                  </thead>
                  <tbody>
                    @for (ward of wards; track ward.id) {
                      <tr>
                        <td><strong>{{ ward.name }}</strong></td>
                        <td><span class="badge badge-blue">{{ ward.code }}</span></td>
                        <td style="font-size:12px;color:var(--text-secondary);">{{ ward.description || '-' }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminWards.noWards') }}</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('adminWards.createHeader') }}</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <input type="text" [(ngModel)]="newWard.name" [placeholder]="i18n.t('adminWards.namePlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <input type="text" [(ngModel)]="newWard.code" [placeholder]="i18n.t('adminWards.codePlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <textarea [(ngModel)]="newWard.description" [placeholder]="i18n.t('adminWards.descPlaceholder')" rows="3" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
                <button class="btn btn-primary" [disabled]="creating || !newWard.name || !newWard.code" (click)="createWard()">
                  {{ creating ? i18n.t('adminWards.creating') : i18n.t('adminWards.createBtn') }}
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

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'nav.dashboard', route: '/admin' },
      { icon: 'map', label: 'nav.wards', route: '/admin/wards' },
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
        this.error = err.error?.error || this.i18n.t('adminWards.loadFailed');
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
        this.error = err.error?.error || this.i18n.t('adminWards.createFailed');
        this.creating = false;
      },
    });
  }
}
