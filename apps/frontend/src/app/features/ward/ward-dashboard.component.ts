import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Event, Issue } from '@dd/shared-types';

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
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="Ward Dashboard"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#0D9488,#0891B2);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">{{ wardTitle }}</h2>
        <p style="opacity:0.8;font-size:13px;">Ward representative dashboard</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ activeIssueCount }}</div><div style="opacity:0.7;font-size:12px;">Active Issues</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ wardIssues.length }}</div><div style="opacity:0.7;font-size:12px;">Total Ward Issues</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ events.length }}</div><div style="opacity:0.7;font-size:12px;">Upcoming Events</div></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🗺 Neighborhood Issues Map</h3></div>
          <div class="card-body">
            <div style="height:280px;background:linear-gradient(135deg,#E0F2FE,#DBEAFE);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
              <div style="position:absolute;inset:0;opacity:0.3;">
                @for (pin of mapPins; track pin.x) {
                  <div [style.left.%]="pin.x" [style.top.%]="pin.y" [style.background]="pin.color" style="position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                }
              </div>
              <div style="text-align:center;z-index:1;background:rgba(255,255,255,0.9);padding:16px 24px;border-radius:var(--radius-lg);">
                <i class="material-icons-outlined" style="font-size:48px;color:var(--primary);">map</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">Interactive Heat Map</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ activeIssueCount }} issues tracked</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📊 Issue Categories in Ward</h3></div>
          <div class="card-body">
            @for (cat of wardCategories; track cat.name) {
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <span style="font-size:13px;width:120px;color:var(--text-secondary);">{{ cat.name }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="cat.pct" [style.background]="cat.color" style="height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:30px;text-align:right;">{{ cat.count }}</span>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No ward issues found.</div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>Community Feedback Feed</h3></div>
        <div class="card-body">
          @for (fb of feedback; track fb.id) {
            <div style="display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">{{ fb.initials }}</div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <strong style="font-size:13px;">{{ fb.name }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ fb.time }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">{{ fb.text }}</p>
                <div style="display:flex;gap:8px;margin-top:8px;"><span class="badge" [class]="fb.sentimentBadge">{{ fb.sentiment }}</span><span class="badge badge-slate">{{ fb.category }}</span></div>
              </div>
            </div>
          } @empty {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">No recent ward feedback.</div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>🤝 Upcoming Community Events</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            @for (evt of events; track evt.title) {
              <div style="padding:16px;background:var(--bg-primary);border-radius:var(--radius);text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ evt.month }}</div>
                <div style="font-size:24px;font-weight:800;color:var(--primary);">{{ evt.day }}</div>
                <div style="font-size:13px;font-weight:600;margin-top:4px;">{{ evt.title }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ evt.time }}</div>
              </div>
            } @empty {
              <div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);">No upcoming events.</div>
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
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/ward' },
    { icon: 'map', label: 'Ward Map', route: '/ward/map' },
    { icon: 'forum', label: 'Feedback', route: '/ward/feedback' },
    { icon: 'groups', label: 'Residents', route: '/ward/residents' },
    { icon: 'event', label: 'Events', route: '/ward/events' },
  ];

  private readonly categoryColors: Record<string, string> = {
    INFRASTRUCTURE: '#2563EB', PUBLIC_SAFETY: '#DC2626', SANITATION: '#16A34A',
    UTILITIES: '#7C3AED', HOUSING: '#D97706', ENVIRONMENT: '#059669',
    TRANSPORTATION: '#0891B2', EDUCATION: '#4F46E5', HEALTH: '#E11D48', OTHER: '#64748B',
  };

  constructor(public auth: AuthService, private api: ApiService, private datePipe: DatePipe) {}

  get activeIssueCount(): number {
    return this.wardIssues.filter(i => i.status !== 'RESOLVED' && i.status !== 'VERIFIED' && i.status !== 'REJECTED').length;
  }

  ngOnInit() {
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
      name: cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
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
        ? { label: 'Positive', badge: 'badge-green' }
        : issue.status === 'REJECTED'
          ? { label: 'Negative', badge: 'badge-red' }
          : { label: 'Open', badge: 'badge-slate' };
      return {
        id: issue.id,
        name: reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Resident',
        initials: `${first}${last}`,
        time: this.datePipe.transform(issue.createdAt, 'mediumDate') || '',
        text: issue.description?.slice(0, 160) + (issue.description && issue.description.length > 160 ? '...' : ''),
        sentiment: sentiment.label,
        sentimentBadge: sentiment.badge,
        category: issue.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
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

  private mapEvent(event: Event): WardEvent {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      month: this.datePipe.transform(start, 'MMM') || '',
      day: this.datePipe.transform(start, 'd') || '',
      time: this.datePipe.transform(start, 'shortTime') || '',
    };
  }
}