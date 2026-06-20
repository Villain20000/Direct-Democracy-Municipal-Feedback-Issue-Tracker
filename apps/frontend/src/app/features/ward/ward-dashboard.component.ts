import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, WardDigestRow } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Event, Issue } from '@dd/shared-types';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';
import { CivicScoreComponent } from '../../shared/civic-score.component';

interface WardCategory {
  name: string;
  count: number;
  pct: number;
  color: string;
}

interface WardEvent {
  title: string;
  month: string;
  day: string;
  time: string;
}

@Component({
  selector: 'app-ward-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, RouterLink, TranslatePipe, ActivityFeedComponent, CivicScoreComponent],
  template: `
    <app-layout
      [pageTitle]="i18n.t('ward.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#0D9488,#0891B2);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">{{ wardTitle }}</h2>
        <p style="opacity:0.8;font-size:13px;">{{ 'ward.repLabel' | t }}</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ activeIssueCount }}</div><div style="opacity:0.7;font-size:12px;">{{ 'ward.activeIssues' | t }}</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ wardIssues.length }}</div><div style="opacity:0.7;font-size:12px;">{{ 'ward.totalIssues' | t }}</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ events.length }}</div><div style="opacity:0.7;font-size:12px;">{{ 'ward.upcomingEvents' | t }}</div></div>
        </div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        <app-civic-score [userId]="auth.user()?.id" />
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="ward-daily-digest">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ 'ward.dailyDigestTitle' | t }}</h3>
          @if (wardDigest) {
            <span style="font-size:12px;color:var(--text-muted);">{{ wardDigest.dateKey }}</span>
          }
        </div>
        <div class="card-body">
          @if (digestLoading && !wardDigest) {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'ward.loadingDigest' | t }}</p>
          } @else if (wardDigest) {
            <p style="font-size:14px;color:var(--text-secondary);line-height:1.7;">{{ wardDigest.body }}</p>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
              {{ i18n.t('ward.digestIssueCount', { n: wardDigest.issueCount }) }}
            </div>
          } @else {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'ward.noDigest' | t }}</p>
          }
          <button type="button" class="btn btn-primary btn-sm" style="margin-top:12px;" (click)="regenerateDigest()" [disabled]="digestLoading">
            <i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i>
            {{ digestLoading ? ('ward.generatingDigest' | t) : ('ward.regenerateDigest' | t) }}
          </button>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <h3>{{ 'ward.mapTitle' | t }}</h3>
            <a routerLink="/ward/map" class="btn btn-primary btn-sm">{{ 'ward.openMap' | t }}</a>
          </div>
          <div class="card-body">
            <div style="height:280px;background:linear-gradient(135deg,#E0F2FE,#DBEAFE);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
              <div style="position:absolute;inset:0;opacity:0.3;">
                @for (pin of mapPins; track pin.x) {
                  <div [style.left.%]="pin.x" [style.top.%]="pin.y" [style.background]="pin.color" style="position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                }
              </div>
              <div style="text-align:center;z-index:1;background:rgba(255,255,255,0.9);padding:16px 24px;border-radius:var(--radius-lg);">
                <i class="material-icons-outlined" style="font-size:48px;color:var(--primary);">map</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">{{ 'ward.heatMap' | t }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ i18n.t('ward.issuesTracked', { n: activeIssueCount }) }}</div>
                <a routerLink="/ward/map" class="btn btn-secondary btn-sm" style="margin-top:12px;">{{ 'ward.viewMap' | t }}</a>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'ward.catsTitle' | t }}</h3></div>
          <div class="card-body">
            @for (cat of wardCategories; track cat.name) {
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <span style="font-size:13px;width:120px;color:var(--text-secondary);">{{ i18n.tCategory(cat.name) }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="cat.pct" [style.background]="cat.color" style="height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:30px;text-align:right;">{{ cat.count }}</span>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'ward.noIssues' | t }}</div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>{{ 'ward.feedbackTitle' | t }}</h3></div>
        <div class="card-body">
          @for (fb of feedback; track fb.id) {
            <a [routerLink]="['/issues', fb.id]" style="display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;text-decoration:none;color:inherit;">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">{{ fb.initials }}</div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <strong style="font-size:13px;">{{ fb.name }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ fb.time }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">{{ fb.text }}</p>
                <div style="display:flex;gap:8px;margin-top:8px;"><span class="badge" [class]="fb.sentimentBadge">{{ fb.sentiment }}</span><span class="badge badge-slate">{{ i18n.tCategory(fb.category) }}</span></div>
              </div>
            </a>
          } @empty {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'ward.noFeedback' | t }}</div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ 'ward.eventsTitle' | t }}</h3>
          <a routerLink="/ward/events" class="btn btn-secondary btn-sm">{{ 'common.viewAll' | t }}</a>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            @for (evt of events; track evt.title) {
              <a routerLink="/ward/events" style="padding:16px;background:var(--bg-primary);border-radius:var(--radius);text-align:center;text-decoration:none;color:inherit;transition:background 0.2s,transform 0.1s;display:block;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ evt.month }}</div>
                <div style="font-size:24px;font-weight:800;color:var(--primary);">{{ evt.day }}</div>
                <div style="font-size:13px;font-weight:600;margin-top:4px;">{{ evt.title }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ evt.time }}</div>
              </a>
            } @empty {
              <div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);">{{ 'ward.noEvents' | t }}</div>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class WardDashboardComponent implements OnInit {
  wardIssues: Issue[] = [];
  wardCategories: WardCategory[] = [];
  events: WardEvent[] = [];
  wardTitle = 'Ward Dashboard';
  mapPins: Array<{ x: number; y: number; color: string }> = [];
  feedback: Array<{ id: string; name: string; initials: string; time: string; text: string; sentiment: string; sentimentBadge: string; category: string }> = [];
  wardDigest: WardDigestRow | null = null;
  digestLoading = false;
  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/ward' },
    { icon: 'map', label: 'nav.map', route: '/ward/map' },
    { icon: 'forum', label: 'nav.feedback', route: '/ward/feedback' },
    { icon: 'groups', label: 'nav.residents', route: '/ward/residents' },
    { icon: 'event', label: 'nav.events', route: '/ward/events' },
  ] as any;

  private readonly categoryColors: Record<string, string> = {
    INFRASTRUCTURE: '#2563EB', PUBLIC_SAFETY: '#DC2626', SANITATION: '#16A34A',
    UTILITIES: '#7C3AED', HOUSING: '#D97706', ENVIRONMENT: '#059669',
    TRANSPORTATION: '#0891B2', EDUCATION: '#4F46E5', HEALTH: '#E11D48', OTHER: '#64748B',
  };

  private readonly locale = 'en-US';

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  get activeIssueCount(): number {
    return this.wardIssues.filter(i => i.status !== 'RESOLVED' && i.status !== 'VERIFIED' && i.status !== 'REJECTED').length;
  }

  ngOnInit() {
    this.loadDigest();
    const wardId = this.auth.user()?.wardId;
    if (wardId) {
      this.api.getIssues({ wardId, pageSize: '20' }).subscribe((res: any) => {
        if (res.data) {
          this.wardIssues = res.data;
          this.buildCategories();
          this.buildFeedback();
          this.buildMapPins();
        }
      });
    }
    this.api.getEvents({ upcoming: 'true', pageSize: '3' }).subscribe((res: any) => {
      const evts: Event[] = res.data || [];
      this.events = evts.map(e => this.mapEvent(e));
    });
  }

  private buildCategories() {
    const counts: Record<string, number> = {};
    for (const issue of this.wardIssues) {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    }
    const entries = Object.entries(counts);
    const max = Math.max(...entries.map(([, c]) => c), 1);
    this.wardCategories = entries.map(([cat, count]) => ({
      name: cat,
      count,
      pct: (count / max) * 100,
      color: this.categoryColors[cat] || '#64748B',
    }));
  }

  private buildFeedback() {
    this.feedback = this.wardIssues.slice(0, 5).map(issue => {
      const reporter = issue.reporter;
      const first = reporter?.firstName?.[0] || '?';
      const last = reporter?.lastName?.[0] || '';
      const sentiment = issue.status === 'RESOLVED' || issue.status === 'VERIFIED'
        ? { label: this.i18n.t('ward.sentimentPositive'), badge: 'badge-green' }
        : issue.status === 'REJECTED'
          ? { label: this.i18n.t('ward.sentimentNegative'), badge: 'badge-red' }
          : { label: this.i18n.t('ward.sentimentOpen'), badge: 'badge-slate' };
      return {
        id: issue.id,
        name: reporter ? `${reporter.firstName} ${reporter.lastName}` : this.i18n.t('detail.resident'),
        initials: `${first}${last}`,
        time: formatDate(issue.createdAt, 'mediumDate', this.locale),
        text: issue.description?.slice(0, 160) + (issue.description && issue.description.length > 160 ? '...' : ''),
        sentiment: sentiment.label,
        sentimentBadge: sentiment.badge,
        category: issue.category,
      };
    });
  }

  private buildMapPins() {
    const withCoords = this.wardIssues.filter(i => i.latitude != null && i.longitude != null);
    if (!withCoords.length) {
      this.mapPins = [];
      return;
    }
    const lats = withCoords.map(i => Number(i.latitude));
    const lngs = withCoords.map(i => Number(i.longitude));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    this.mapPins = withCoords.map(issue => ({
      x: 10 + ((Number(issue.longitude) - minLng) / lngRange) * 80,
      y: 10 + ((maxLat - Number(issue.latitude)) / latRange) * 80,
      color: this.categoryColors[issue.category] || '#64748B',
    }));
  }

  loadDigest() {
    this.digestLoading = true;
    this.api.getLatestWardDigest().subscribe({
      next: (res) => {
        this.wardDigest = res.success ? res.data : null;
        this.digestLoading = false;
      },
      error: () => { this.digestLoading = false; },
    });
  }

  regenerateDigest() {
    if (this.digestLoading) return;
    this.digestLoading = true;
    this.api.generateWardDigest().subscribe({
      next: (res) => {
        if (res.success) this.wardDigest = res.data;
        this.digestLoading = false;
      },
      error: () => { this.digestLoading = false; },
    });
  }

  private mapEvent(event: Event): WardEvent {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      month: formatDate(start, 'MMM', this.locale),
      day: formatDate(start, 'd', this.locale),
      time: formatDate(start, 'shortTime', this.locale),
    };
  }
}
