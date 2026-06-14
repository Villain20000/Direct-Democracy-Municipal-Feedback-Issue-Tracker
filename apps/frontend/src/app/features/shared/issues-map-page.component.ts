import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Issue } from '@dd/shared-types';
import { statusColors } from '../../core/utils/issue-map';
import * as L from 'leaflet';

interface AreaSummaryIssue {
  id: string;
  title: string;
  category: string;
  status: string;
  department: string | null;
}

interface AreaSummary {
  count: number;
  issues: AreaSummaryIssue[];
  summary: string;
  fallback?: boolean;
}

@Component({
  selector: 'app-issues-map-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, RouterLink],
  template: `
    <app-layout [pageTitle]="i18n.t('issuesMap.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start;">
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <h3>{{ i18n.t('issuesMap.header') }}</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--text-muted);">{{ i18n.t('issuesMap.mappedCount', { n: mappedCount }) }}</span>
              @if (!drawMode) {
                <button type="button" class="btn btn-primary btn-sm" (click)="enterDrawMode()">
                  ✏️ {{ drawButtonLabel }}
                </button>
              } @else {
                <button type="button" class="btn btn-secondary btn-sm" (click)="cancelDraw()">
                  ✕ {{ cancelDrawLabel }}
                </button>
                <button type="button" class="btn btn-success btn-sm" (click)="finishPolygon()" [disabled]="vertices.length < 3 || summarizing">
                  ✓ {{ doneButtonLabel }} ({{ vertices.length }})
                </button>
              }
            </div>
          </div>
          <div class="card-body" style="padding:0;position:relative;">
            @if (loading) {
              <div style="position:absolute;inset:0;z-index:1000;background:rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;color:var(--text-muted);">
                {{ i18n.t('issuesMap.loading') }}
              </div>
            }
            @if (drawMode) {
              <div style="position:absolute;top:12px;left:12px;z-index:1000;background:rgba(37,99,235,0.95);color:white;padding:8px 14px;border-radius:var(--radius);font-size:12px;font-weight:600;box-shadow:var(--shadow-md);">
                🖱 {{ drawHintLabel }}
              </div>
            }
            <div id="issues-map" style="height:520px;width:100%;border-radius:0 0 var(--radius) var(--radius);"></div>
          </div>
          <div class="card-body" style="padding:12px 16px;display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid var(--border-light);">
            <span class="map-legend"><span class="map-dot" style="background:#DC2626;"></span> Open</span>
            <span class="map-legend"><span class="map-dot" style="background:#F59E0B;"></span> In Progress</span>
            <span class="map-legend"><span class="map-dot" style="background:#10B981;"></span> Resolved</span>
          </div>
        </div>

        <div class="card" style="position:sticky;top:16px;">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>🤖 {{ summaryTitleLabel }}</h3>
            @if (areaSummary) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="clearSummary()" title="Clear">✕</button>
            }
          </div>
          <div class="card-body" style="font-size:13px;line-height:1.6;">
            @if (summarizing) {
              <div style="display:flex;gap:8px;align-items:center;color:var(--text-muted);">
                <span class="spinner" style="width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;"></span>
                {{ summaryLoadingLabel }}
              </div>
            } @else if (areaSummary) {
              <div style="padding:10px 12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:700;">{{ areaSummary.count }} {{ summaryIssuesFoundLabel }}</span>
                @if (areaSummary.fallback) { <span class="badge badge-amber">fallback</span> }
              </div>
              <p style="white-space:pre-line;margin-bottom:12px;">{{ areaSummary.summary }}</p>
              @if (areaSummary.issues.length) {
                <div style="border-top:1px solid var(--border-light);padding-top:10px;">
                  <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;letter-spacing:0.04em;">{{ summarySampleLabel }}</div>
                  @for (issue of areaSummary.issues.slice(0, 8); track issue.id) {
                    <a [routerLink]="['/issues', issue.id]" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-light);text-decoration:none;color:inherit;font-size:12px;">
                      <span class="badge badge-slate">{{ issue.category }}</span>
                      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ issue.title }}</span>
                    </a>
                  }
                  @if (areaSummary.issues.length > 8) {
                    <div style="text-align:center;padding-top:6px;font-size:11px;color:var(--text-muted);">+{{ areaSummary.issues.length - 8 }} {{ moreLabel }}</div>
                  }
                </div>
              }
            } @else {
              <p style="color:var(--text-muted);font-size:13px;">{{ summaryEmptyLabel }}</p>
            }
          </div>
        </div>
      </div>

      @if (!loading && mappedCount === 0) {
        <div class="card" style="margin-top:16px;">
          <div class="card-body" style="text-align:center;padding:32px;color:var(--text-muted);">
            {{ i18n.t('issuesMap.noGeo') }}
          </div>
        </div>
      }
    </app-layout>
  `,
  styles: [`
    .map-legend { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
    .map-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 900px) {
      :host > app-layout > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
    }
  `],
})
export class IssuesMapPageComponent implements OnInit, AfterViewInit, OnDestroy {
  issues: Issue[] = [];
  loading = true;
  error = '';
  mappedCount = 0;
  navItems: NavItem[] = [];

  // Draw state
  drawMode = false;
  vertices: Array<[number, number]> = [];
  private drawPolyline: L.Polyline | null = null;
  private vertexMarkers: L.CircleMarker[] = [];
  private previewLine: L.Polyline | null = null;
  private closedPolygon: L.Polygon | null = null;
  private clickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private dblClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

  // Summary state
  summarizing = false;
  areaSummary: AreaSummary | null = null;

  private map: L.Map | null = null;
  private markers: L.LayerGroup | null = null;
  private viewReady = false;
  private dataReady = false;

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
  }

  // i18n-derived labels (kept as getters so they react to language changes)
  get drawButtonLabel()    { return this.i18n.t('issuesMap.drawButton'); }
  get doneButtonLabel()     { return this.i18n.t('issuesMap.doneButton'); }
  get cancelDrawLabel()     { return this.i18n.t('issuesMap.cancelDraw'); }
  get drawHintLabel()       { return this.i18n.t('issuesMap.drawHint'); }
  get summaryTitleLabel()   { return this.i18n.t('issuesMap.summaryTitle'); }
  get summaryEmptyLabel()   { return this.i18n.t('issuesMap.summaryEmpty'); }
  get summaryLoadingLabel() { return this.i18n.t('issuesMap.summaryLoading'); }
  get summaryIssuesFoundLabel() { return this.i18n.t('issuesMap.summaryIssuesFound'); }
  get summarySampleLabel()  { return this.i18n.t('issuesMap.summarySample'); }
  get moreLabel()           { return this.i18n.t('issuesMap.more'); }

  ngOnInit() { this.loadIssues(); }
  ngAfterViewInit() { this.viewReady = true; this.tryInitMap(); }
  ngOnDestroy() {
    this.detachDrawHandlers();
    this.map?.remove();
  }

  loadIssues() {
    this.loading = true;
    this.error = '';
    this.api.getIssues({ pageSize: '100' }).subscribe({
      next: (res: any) => {
        this.issues = res.data || [];
        this.loading = false;
        this.dataReady = true;
        this.tryInitMap();
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('issuesMap.loadFailed');
        this.loading = false;
      },
    });
  }

  // -----------------------------------------------------------------
  // Draw mode
  // -----------------------------------------------------------------
  enterDrawMode() {
    if (!this.map) return;
    this.cancelDraw(); // clear any previous state
    this.drawMode = true;
    this.areaSummary = null;
    // Disable Leaflet's default double-click zoom while drawing so the
    // user can double-click to close the polygon.
    this.map.doubleClickZoom.disable();

    this.clickHandler = (e: L.LeafletMouseEvent) => {
      this.vertices.push([e.latlng.lat, e.latlng.lng]);
      this.addVertexMarker(e.latlng);
      this.updatePolylinePreview();
    };

    this.dblClickHandler = () => {
      // Prevent the default map zoom-on-dbl-click and finalize the polygon.
      if (this.vertices.length >= 3) this.finishPolygon();
    };

    this.mouseMoveHandler = (e: L.LeafletMouseEvent) => {
      this.updateRubberBand(e.latlng);
    };

    this.map.on('click', this.clickHandler);
    this.map.on('dblclick', this.dblClickHandler);
    this.map.on('mousemove', this.mouseMoveHandler);
  }

  private addVertexMarker(latlng: L.LatLng) {
    if (!this.map) return;
    const marker = L.circleMarker(latlng, {
      radius: 5,
      color: '#2563EB',
      weight: 2,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
    }).addTo(this.map);
    this.vertexMarkers.push(marker);
  }

  private updatePolylinePreview() {
    if (!this.map) return;
    if (this.drawPolyline) this.map.removeLayer(this.drawPolyline);
    if (this.vertices.length >= 2) {
      this.drawPolyline = L.polyline(this.vertices, {
        color: '#2563EB',
        weight: 2,
        dashArray: '4 4',
      }).addTo(this.map);
    } else {
      this.drawPolyline = null;
    }
  }

  private updateRubberBand(latlng: L.LatLng) {
    if (!this.map) return;
    if (this.vertices.length === 0) return;
    if (this.previewLine) this.map.removeLayer(this.previewLine);
    const last = this.vertices[this.vertices.length - 1];
    this.previewLine = L.polyline([last, [latlng.lat, latlng.lng]], {
      color: '#2563EB',
      weight: 1,
      dashArray: '2 6',
      opacity: 0.6,
    }).addTo(this.map);
  }

  finishPolygon() {
    if (!this.map || this.vertices.length < 3) return;
    // Clean up the live drawing layers.
    this.detachDrawHandlers();

    // Render the closed polygon with a translucent fill.
    if (this.closedPolygon) this.map.removeLayer(this.closedPolygon);
    this.closedPolygon = L.polygon(this.vertices, {
      color: '#7C3AED',
      weight: 2,
      fillColor: '#7C3AED',
      fillOpacity: 0.15,
    }).addTo(this.map);

    this.summarizing = true;
    this.areaSummary = null;
    const polygon = [...this.vertices];
    this.api.summarizeArea(polygon).subscribe({
      next: (res: any) => {
        this.summarizing = false;
        if (res.success) this.areaSummary = res.data;
        // Stay in drawMode=false but keep the polygon on the map.
        this.drawMode = false;
      },
      error: (err) => {
        this.summarizing = false;
        this.error = err.error?.error || this.i18n.t('issuesMap.loadFailed');
        this.drawMode = false;
      },
    });
  }

  cancelDraw() {
    this.detachDrawHandlers();
    this.clearDrawingLayers();
    this.vertices = [];
    this.drawMode = false;
  }

  clearSummary() {
    this.areaSummary = null;
    if (this.closedPolygon && this.map) {
      this.map.removeLayer(this.closedPolygon);
      this.closedPolygon = null;
    }
  }

  private detachDrawHandlers() {
    if (this.map) {
      if (this.clickHandler)     this.map.off('click',     this.clickHandler);
      if (this.dblClickHandler)  this.map.off('dblclick',  this.dblClickHandler);
      if (this.mouseMoveHandler) this.map.off('mousemove', this.mouseMoveHandler);
      this.map.doubleClickZoom.enable();
    }
    this.clickHandler = this.dblClickHandler = this.mouseMoveHandler = null;
  }

  private clearDrawingLayers() {
    if (!this.map) return;
    for (const m of this.vertexMarkers) this.map.removeLayer(m);
    this.vertexMarkers = [];
    if (this.drawPolyline) { this.map.removeLayer(this.drawPolyline); this.drawPolyline = null; }
    if (this.previewLine)  { this.map.removeLayer(this.previewLine);  this.previewLine  = null; }
    if (this.closedPolygon){ this.map.removeLayer(this.closedPolygon); this.closedPolygon = null; }
  }

  // -----------------------------------------------------------------
  // Map init (unchanged from before)
  // -----------------------------------------------------------------
  private tryInitMap() {
    if (!this.viewReady || !this.dataReady || this.map) return;
    const el = document.getElementById('issues-map');
    if (!el) return;

    const geoIssues = this.issues.filter(i => i.latitude != null && i.longitude != null);
    this.mappedCount = geoIssues.length;

    this.map = L.map('issues-map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markers = L.layerGroup().addTo(this.map);

    if (geoIssues.length === 0) {
      this.map.setView([40.7128, -74.006], 12);
      return;
    }

    const bounds: L.LatLngExpression[] = [];
    for (const issue of geoIssues) {
      const latlng: L.LatLngExpression = [issue.latitude!, issue.longitude!];
      bounds.push(latlng);
      const colors = statusColors(issue.status);
      const marker = L.circleMarker(latlng, {
        radius: 8,
        fillColor: colors.fill,
        color: colors.stroke,
        weight: 2,
        fillOpacity: 0.85,
      });
      marker.bindPopup(
        `<strong>${issue.title}</strong><br>` +
        `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${colors.fill}22;color:${colors.stroke};font-size:11px;font-weight:700;margin:4px 0;">${issue.status}</span><br>` +
        `${issue.location}<br><a href="/issues/${issue.id}">View details</a>`,
      );
      marker.addTo(this.markers!);
    }

    this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  }
}
