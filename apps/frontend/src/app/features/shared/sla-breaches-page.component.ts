import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-sla-breaches-page',
  standalone: true,
  imports: [CommonModule, DatePipe, LayoutComponent],
  template: `
    <app-layout [pageTitle]="i18n.t('nav.slaBreaches')" [navItems]="navItems" (logout)="auth.logout()">
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ i18n.t('nav.slaBreaches') }}</h3>
          <button class="btn btn-secondary btn-sm" (click)="scanBreaches()" [disabled]="scanning">{{ scanning ? 'Scanning...' : 'Scan breaches' }}</button>
        </div>
        <div class="card-body">
          @if (loading) {
            <div style="color:var(--text-muted);">{{ i18n.t('common.loading') }}</div>
          } @else if (breaches.length === 0) {
            <div style="color:var(--text-muted);">No SLA breaches found</div>
          } @else {
            <table class="data-table">
              <thead>
                <tr><th>Issue</th><th>Priority</th><th>Due At</th><th>Breached</th></tr>
              </thead>
              <tbody>
                @for (b of breaches; track b.issueId) {
                  <tr>
                    <td><a [routerLink]="['/issues', b.issueId]">{{ b.issue?.title }}</a></td>
                    <td>{{ b.priority }}</td>
                    <td>{{ b.dueAt | date:'medium' }}</td>
                    <td>{{ b.breached ? 'Yes' : 'No' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </app-layout>
  `
})
export class SlaBreachesPageComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);
  navItems: NavItem[] = [];
  breaches: Array<any> = [];
  loading = false;
  scanning = false;

  ngOnInit() {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: this.auth.getDashboardRoute() }];
    this.loadBreaches();
  }

  loadBreaches() {
    this.loading = true;
    this.api.getSlaBreaches().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) this.breaches = res.data;
      },
      error: () => { this.loading = false; },
    });
  }

  scanBreaches() {
    this.scanning = true;
    this.api.scanSlaBreaches().subscribe({
      next: (res) => {
        this.scanning = false;
        this.toast.success(`Scanned, ${res.data.breached} breaches found`);
        this.loadBreaches();
      },
      error: () => { this.scanning = false; this.toast.error('Scan failed'); },
    });
  }
}
