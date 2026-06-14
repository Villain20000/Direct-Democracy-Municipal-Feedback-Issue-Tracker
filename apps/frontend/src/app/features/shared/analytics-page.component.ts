import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats } from '@dd/shared-types';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, TitleCasePipe],
  template: `
    <app-layout pageTitle="Analytics" [navItems]="navItems" (logout)="auth.logout()">
      @if (stats) {
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">report_problem</i></div><div class="stat-info"><div class="stat-value">{{ stats.totalIssues }}</div><div class="stat-label">Total Issues</div></div></div>
          <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">{{ stats.openIssues }}</div><div class="stat-label">Open</div></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div><div class="stat-info"><div class="stat-value">{{ stats.resolvedIssues }}</div><div class="stat-label">Resolved</div></div></div>
          <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">schedule</i></div><div class="stat-info"><div class="stat-value">{{ stats.avgResolutionTimeDays }}</div><div class="stat-label">Avg Days to Resolve</div></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Issues by Category</h3></div>
          <div class="card-body">
            @for (entry of categoryEntries; track entry[0]) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:13px;width:140px;color:var(--text-secondary);">{{ entry[0] | titlecase }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="barWidth(entry[1])" style="background:var(--primary);height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:40px;text-align:right;">{{ entry[1] }}</span>
              </div>
            }
          </div>
        </div>
      } @else if (loading) {
        <div class="card"><div class="card-body" style="padding:48px;text-align:center;color:var(--text-muted);">Loading analytics...</div></div>
      }
    </app-layout>
  `,
})
export class AnalyticsPageComponent implements OnInit {
  stats: DashboardStats | null = null;
  categoryEntries: [string, number][] = [];
  loading = true;
  navItems = [{ icon: 'arrow_back', label: 'Back', route: '/mayor' }];

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.api.getIssueStats().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.stats = res.data;
          this.categoryEntries = Object.entries(res.data.issuesByCategory);
        }
      },
      error: () => { this.loading = false; },
    });
  }

  barWidth(count: number): number {
    const max = Math.max(...this.categoryEntries.map(e => e[1]), 1);
    return (count / max) * 100;
  }
}