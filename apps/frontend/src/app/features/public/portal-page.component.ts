/**
 * Phase D2 — Transparency Portal page.
 *
 * Public, no-auth single-page dashboard that aggregates everything the
 * municipality wants to show to the world:
 *   - Top-line stats (issues, resolved, referendums, events, departments, wards)
 *   - Recent + top-voted public issues
 *   - Department breakdown with budgets
 *   - Public referendums with tallies
 *   - Public announcements
 *   - Past meetings + upcoming events
 *
 * All data is fetched from /api/v1/portal/* (no auth header needed). If
 * the user is also signed in, we show a small "Open the full app" CTA
 * in the top right.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface PortalStats {
  totalIssues: number;
  resolvedIssues: number;
  openIssues: number;
  resolutionRate: number;
  recentIssuesCount: number;
  activeReferendums: number;
  upcomingEvents: number;
  totalDepartments: number;
  totalWards: number;
  issuesByStatus: Record<string, number>;
  issuesByCategory: Record<string, number>;
  issuesByDepartment: Record<string, number>;
}

@Component({
  selector: 'app-portal-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="portal-page" data-testid="portal-page">
      <header class="portal-header">
        <div class="portal-header-inner">
          <div>
            <h1>{{ 'portal.title' | t }}</h1>
            <p class="portal-subtitle">{{ 'portal.subtitle' | t }}</p>
          </div>
          <div class="portal-cta">
            @if (auth.isAuthenticated()) {
              <a [routerLink]="dashboardLink()" class="btn btn-primary">{{ 'portal.openApp' | t }}</a>
            } @else {
              <a routerLink="/login" class="btn btn-primary">{{ 'portal.signIn' | t }}</a>
            }
          </div>
        </div>
      </header>

      <main class="portal-main">
        @if (loading()) {
          <p class="loading">{{ 'common.loading' | t }}</p>
        } @else {
          <!-- Top stats -->
          @if (stats(); as s) {
            <section class="stat-grid">
              <div class="stat-card">
                <div class="stat-value">{{ s.totalIssues }}</div>
                <div class="stat-label">{{ 'portal.totalIssues' | t }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ s.resolvedIssues }}</div>
                <div class="stat-label">{{ 'portal.resolved' | t }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ s.resolutionRate }}%</div>
                <div class="stat-label">{{ 'portal.resolutionRate' | t }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ s.activeReferendums }}</div>
                <div class="stat-label">{{ 'portal.activeReferendums' | t }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ s.upcomingEvents }}</div>
                <div class="stat-label">{{ 'portal.upcomingEvents' | t }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ s.totalDepartments }} / {{ s.totalWards }}</div>
                <div class="stat-label">{{ 'portal.deptsWards' | t }}</div>
              </div>
            </section>
          }

          <!-- Two-column layout below the stats -->
          <div class="portal-grid">
            <!-- Recent public issues -->
            <section class="card">
              <h2>{{ 'portal.recentIssues' | t }}</h2>
              @if (recentIssues().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <ul class="issue-list">
                  @for (issue of recentIssues(); track issue.id) {
                    <li>
                      <a [routerLink]="['/issues', issue.id]">
                        <span class="issue-title">{{ issue.title }}</span>
                        <span class="issue-meta">
                          <span class="badge" [class]="'badge-' + (issue.status | lowercase)">{{ issue.status }}</span>
                          @if (issue.department) {
                            <span class="dept">{{ issue.department.name }}</span>
                          }
                          <span class="date">{{ issue.createdAt | date:'mediumDate' }}</span>
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Top-voted issues -->
            <section class="card">
              <h2>{{ 'portal.topIssues' | t }}</h2>
              @if (topIssues().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <ol class="issue-list numbered">
                  @for (issue of topIssues(); track issue.id; let idx = $index) {
                    <li>
                      <a [routerLink]="['/issues', issue.id]">
                        <span class="issue-title">{{ issue.title }}</span>
                        <span class="issue-meta">
                          <span class="upvotes">▲ {{ issue.upvotes }}</span>
                          @if (issue.department) {
                            <span class="dept">{{ issue.department.name }}</span>
                          }
                        </span>
                      </a>
                    </li>
                  }
                </ol>
              }
            </section>

            <!-- Department breakdown -->
            <section class="card span-2">
              <h2>{{ 'portal.departments' | t }}</h2>
              @if (departments().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <div class="dept-grid">
                  @for (d of departments(); track d.id) {
                    <div class="dept-card">
                      <div class="dept-name">{{ d.name }}</div>
                      <div class="dept-code">{{ d.code }}</div>
                      @if (d.budget) {
                        <div class="dept-budget">€{{ d.budget | number:'1.0-0' }}</div>
                      }
                      <div class="dept-issues">
                        <strong>{{ d.totalIssues }}</strong> {{ 'portal.issues' | t }}
                        @if (d.resolvedIssues > 0) {
                          · <strong>{{ d.resolvedIssues }}</strong> {{ 'portal.resolved' | t | lowercase }}
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </section>

            <!-- Active referendums -->
            <section class="card span-2">
              <h2>{{ 'portal.referendums' | t }}</h2>
              @if (referendums().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <div class="ref-list">
                  @for (ref of referendums(); track ref.id) {
                    <div class="ref-card">
                      <div class="ref-header">
                        <span class="ref-title">{{ ref.title }}</span>
                        <span class="badge" [class]="'badge-' + (ref.status | lowercase)">{{ ref.status }}</span>
                      </div>
                      <p class="ref-desc">{{ ref.description }}</p>
                      <div class="ref-tallies">
                        <div class="tally tally-yes">
                          <span class="tally-label">{{ 'portal.yes' | t }}</span>
                          <span class="tally-value">{{ ref.yesCount }}</span>
                        </div>
                        <div class="tally tally-no">
                          <span class="tally-label">{{ 'portal.no' | t }}</span>
                          <span class="tally-value">{{ ref.noCount }}</span>
                        </div>
                        <div class="tally tally-abstain">
                          <span class="tally-label">{{ 'portal.abstain' | t }}</span>
                          <span class="tally-value">{{ ref.abstainCount }}</span>
                        </div>
                        <div class="tally tally-total">
                          <span class="tally-label">{{ 'portal.totalVotes' | t }}</span>
                          <span class="tally-value">{{ ref.totalVotes }}</span>
                        </div>
                      </div>
                      <div class="ref-window">
                        {{ ref.opensAt | date:'mediumDate' }} → {{ ref.closesAt | date:'mediumDate' }}
                        · {{ (ref.passThreshold * 100).toFixed(0) }}% {{ 'portal.threshold' | t }}
                      </div>
                    </div>
                  }
                </div>
              }
            </section>

            <!-- Announcements -->
            <section class="card">
              <h2>{{ 'portal.announcements' | t }}</h2>
              @if (announcements().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <ul class="announcement-list">
                  @for (a of announcements(); track a.id) {
                    <li>
                      <div class="ann-title">{{ a.title }}</div>
                      <div class="ann-content">{{ a.content }}</div>
                      <div class="ann-meta">
                        @if (a.author) {
                          <span>{{ a.author.firstName }} {{ a.author.lastName }}</span>
                        }
                        <span>{{ a.publishedAt | date:'mediumDate' }}</span>
                      </div>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Upcoming events -->
            <section class="card">
              <h2>{{ 'portal.upcomingEvents' | t }}</h2>
              @if (upcomingEvents().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <ul class="event-list">
                  @for (e of upcomingEvents(); track e.id) {
                    <li>
                      <div class="event-title">{{ e.title }}</div>
                      <div class="event-meta">
                        <span class="event-type">{{ e.type }}</span>
                        <span>{{ e.startTime | date:'medium' }}</span>
                        @if (e.location) {
                          <span>· {{ e.location }}</span>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Citizen FAQ -->
            <section class="card span-2" data-testid="portal-faq">
              <h2>{{ 'portal.faq' | t }}</h2>
              <p class="faq-subtitle">{{ 'portal.faqSubtitle' | t }}</p>
              @if (faqEntries().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <div class="faq-list">
                  @for (entry of faqEntries(); track entry.id) {
                    <details class="faq-item">
                      <summary>
                        @if (entry.category) {
                          <span class="badge">{{ entry.category }}</span>
                        }
                        {{ entry.question }}
                      </summary>
                      <p>{{ entry.answer }}</p>
                    </details>
                  }
                </div>
              }
            </section>

            <!-- Past meetings -->
            <section class="card span-2">
              <h2>{{ 'portal.pastMeetings' | t }}</h2>
              @if (meetings().length === 0) {
                <p class="empty">{{ 'portal.empty' | t }}</p>
              } @else {
                <table class="meetings-table">
                  <thead>
                    <tr>
                      <th>{{ 'portal.meeting' | t }}</th>
                      <th>{{ 'portal.type' | t }}</th>
                      <th>{{ 'portal.date' | t }}</th>
                      <th>{{ 'portal.attendees' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of meetings(); track m.id) {
                      <tr>
                        <td>{{ m.title }}</td>
                        <td><span class="badge" [class]="'badge-' + (m.type | lowercase)">{{ m.type }}</span></td>
                        <td>{{ m.startTime | date:'mediumDate' }}</td>
                        <td>{{ m._count.rsvps }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </section>
          </div>
        }
      </main>

      <footer class="portal-footer">
        <p>{{ 'portal.footer' | t }}</p>
      </footer>
    </div>
  `,
  styles: [`
    .portal-page { min-height: 100vh; background: #f8fafc; }
    .portal-header { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 32px 24px; }
    .portal-header-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .portal-header h1 { margin: 0; font-size: 28px; }
    .portal-subtitle { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .portal-cta .btn { background: white; color: #1e3a8a; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .portal-main { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .portal-footer { text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px; }
    .loading { color: var(--text-muted); padding: 48px; text-align: center; }
    .empty { color: var(--text-muted); font-size: 14px; padding: 16px 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #1e3a8a; }
    .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .portal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .card h2 { margin: 0 0 16px; font-size: 16px; }
    .card.span-2 { grid-column: 1 / -1; }
    @media (max-width: 768px) { .portal-grid { grid-template-columns: 1fr; } .card.span-2 { grid-column: 1; } }
    .issue-list, .announcement-list, .event-list { list-style: none; padding: 0; margin: 0; }
    .issue-list li, .announcement-list li, .event-list li { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .issue-list li:last-child, .announcement-list li:last-child, .event-list li:last-child { border-bottom: none; }
    .issue-list a { text-decoration: none; color: inherit; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .issue-list .issue-title { font-weight: 500; }
    .issue-list .issue-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
    .issue-list.numbered { counter-reset: rank; padding-left: 0; }
    .issue-list.numbered li { counter-increment: rank; }
    .issue-list.numbered li::before { content: counter(rank); font-weight: 700; color: #1e3a8a; margin-right: 8px; min-width: 20px; display: inline-block; }
    .upvotes { background: #f0fdf4; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #f1f5f9; color: #475569; }
    .badge-submitted { background: #dbeafe; color: #1e40af; }
    .badge-resolved { background: #dcfce7; color: #166534; }
    .badge-in_progress, .badge-acknowledged { background: #fef3c7; color: #92400e; }
    .badge-pending_review { background: #fce7f3; color: #9d174d; }
    .badge-rejected, .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-verified, .badge-passed { background: #d1fae5; color: #065f46; }
    .badge-rejected, .badge-open { background: #dbeafe; color: #1e3a8a; }
    .badge-closed { background: #e2e8f0; color: #334155; }
    .dept-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .dept-card { padding: 12px; background: #f8fafc; border-radius: 8px; }
    .dept-name { font-weight: 600; }
    .dept-code { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    .dept-budget { font-size: 18px; font-weight: 700; color: #1e3a8a; margin-top: 4px; }
    .dept-issues { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .ref-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .ref-card { padding: 16px; background: #f8fafc; border-radius: 8px; }
    .ref-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
    .ref-title { font-weight: 600; }
    .ref-desc { font-size: 13px; color: var(--text-muted); margin: 0 0 12px; }
    .ref-tallies { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .tally { flex: 1; min-width: 70px; padding: 8px; background: white; border-radius: 6px; text-align: center; }
    .tally-yes { border-left: 3px solid #16a34a; }
    .tally-no { border-left: 3px solid #dc2626; }
    .tally-abstain { border-left: 3px solid #94a3b8; }
    .tally-total { border-left: 3px solid #1e3a8a; }
    .tally-label { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    .tally-value { display: block; font-size: 18px; font-weight: 700; margin-top: 2px; }
    .ref-window { font-size: 11px; color: var(--text-muted); }
    .announcement-list li { padding: 12px 0; }
    .ann-title { font-weight: 600; }
    .ann-content { font-size: 13px; color: #475569; margin: 4px 0; }
    .ann-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 12px; }
    .event-list .event-title { font-weight: 500; }
    .event-list .event-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; }
    .event-type { text-transform: uppercase; font-weight: 600; }
    .meetings-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .meetings-table th, .meetings-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .meetings-table th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .faq-subtitle { font-size: 13px; color: var(--text-muted); margin: -8px 0 16px; }
    .faq-list { display: flex; flex-direction: column; gap: 8px; }
    .faq-item { background: #f8fafc; border-radius: 8px; padding: 12px 14px; }
    .faq-item summary { cursor: pointer; font-weight: 600; font-size: 14px; list-style: none; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .faq-item p { margin: 10px 0 0; font-size: 13px; color: #475569; line-height: 1.6; }
  `],
})
export class PortalPageComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  router = inject(Router);

  loading = signal(true);
  stats = signal<PortalStats | null>(null);
  recentIssues = signal<any[]>([]);
  topIssues = signal<any[]>([]);
  departments = signal<any[]>([]);
  referendums = signal<any[]>([]);
  announcements = signal<any[]>([]);
  upcomingEvents = signal<any[]>([]);
  meetings = signal<any[]>([]);
  faqEntries = signal<any[]>([]);

  async ngOnInit() {
    try {
      const [stats, recent, top, depts, refs, anns, evts, meetings, faq] = await Promise.all([
        firstValueFrom(this.api.getPortalStats()).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalRecentIssues(10)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalTopIssues(10)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalDepartments()).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalReferendums(10)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalAnnouncements(10)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalUpcomingEvents(10)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalMeetings(20)).then((r: any) => r.data),
        firstValueFrom(this.api.getPortalFaq(15)).then((r: any) => r.data),
      ]);
      this.stats.set(stats);
      this.recentIssues.set(recent);
      this.topIssues.set(top);
      this.departments.set(depts);
      this.referendums.set(refs);
      this.announcements.set(anns);
      this.upcomingEvents.set(evts);
      this.meetings.set(meetings);
      this.faqEntries.set(faq);
    } catch (err) {
      console.error('[portal] load failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  dashboardLink(): string[] {
    return [this.auth.getDashboardRoute()];
  }
}
