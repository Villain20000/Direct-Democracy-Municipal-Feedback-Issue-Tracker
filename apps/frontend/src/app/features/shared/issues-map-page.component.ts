import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Issue, Ward } from '@dd/shared-types';
import { statusColors } from '../../core/utils/issue-map';
import * as L from 'leaflet';
import 'leaflet.heat';

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

interface ClusterReport {
  totalIssues: number;
  clusters: Array<{ label: string; category: string; count: number; issueIds: string[]; sampleTitles: string[] }>;
  narrative: string;
  fallback?: boolean;
}

@Component({
  selector: 'app-issues-map-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, RouterLink, FormsModule],
  template: `
    <app-layout [pageTitle]="i18n.t('issuesMap.pageTitle')" [navItems]="navItems" (logout)="auth.logout()" data-testid="issues-map-page">
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
              <button
                type="button"
                class="btn btn-sm"
                [class.btn-primary]="heatOn"
                [class.btn-secondary]="!heatOn"
                data-testid="heat-toggle"
                (click)="toggleHeat()">
                🔥 {{ i18n.t('issuesMap.heatToggle') }}
              </button>
              <button
                type="button"
                class="btn btn-sm"
                [class.btn-primary]="radiusOn"
                [class.btn-secondary]="!radiusOn"
                data-testid="radius-toggle"
                (click)="toggleRadius()">
                📍 {{ i18n.t('issuesMap.nearMe') }}
              </button>
              @if (radiusOn) {
                <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
                  {{ i18n.t('issuesMap.radiusLabel') }}
                  <input
                    type="range"
                    min="250"
                    max="10000"
                    step="250"
                    [ngModel]="radiusMeters"
                    (ngModelChange)="onRadiusChange($event)"
                    data-testid="radius-slider"
                    style="width:110px;" />
                  <span style="min-width:56px;">{{ formatRadius() }}</span>
                </label>
              }
              <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
                {{ i18n.t('issuesMap.wardLabel') }}
                <select
                  [ngModel]="filterWardId"
                  (ngModelChange)="onWardChange($event)"
                  data-testid="ward-filter"
                  style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;max-width:160px;">
                  <option value="">{{ i18n.t('issuesMap.wardAll') }}</option>
                  @for (w of wards; track w.id) { <option [value]="w.id">{{ w.name }}</option> }
                </select>
              </label>
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
            <span class="map-legend"><span class="map-dot" style="background:transparent;border:2px solid #7C3AED;border-radius:2px;"></span> {{ i18n.t('issuesMap.wardLegend') }}</span>
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
            @if (drilledWardName) {
              <div style="padding:8px 12px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:var(--radius);margin-bottom:12px;font-size:12px;color:#5B21B6;display:flex;justify-content:space-between;align-items:center;gap:8px;" data-testid="ward-drill">
                <span>
                  <strong>{{ drilledWardName }}</strong>
                  <span style="margin-left:6px;">{{ wardDrillLoading ? i18n.t('issuesMap.wardDrillLoading') : (drilledCount != null ? i18n.t('issuesMap.wardDrillCount', { n: drilledCount }) : '') }}</span>
                </span>
                <button type="button" class="btn btn-ghost btn-sm" (click)="onWardChange('')" title="Clear">✕</button>
              </div>
            }
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
              @if (polygonIssues.length) {
                <div style="padding:8px 12px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:var(--radius);margin-bottom:12px;font-size:12px;font-weight:600;color:#5B21B6;" data-testid="polygon-matches">
                  {{ i18n.t('issuesMap.polygonMatches', { n: polygonIssues.length }) }}
                </div>
              }
              <p style="white-space:pre-line;margin-bottom:12px;">{{ areaSummary.summary }}</p>
              <button type="button" class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:12px;" (click)="generateClusterReport()" [disabled]="clusterLoading || !lastPolygon.length">
                {{ clusterLoading ? clusterLoadingLabel : clusterButtonLabel }}
              </button>
              @if (clusterReport) {
                <div style="border-top:1px solid var(--border-light);padding-top:12px;margin-top:4px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">{{ clusterTitleLabel }}</div>
                  <p style="white-space:pre-line;font-size:12px;margin-bottom:8px;">{{ clusterReport.narrative }}</p>
                  @for (cluster of clusterReport.clusters.slice(0, 5); track cluster.label) {
                    <div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-light);">
                      <span class="badge badge-slate">{{ cluster.category }}</span>
                      <strong style="margin-left:6px;">{{ cluster.label }}</strong>
                      <span style="color:var(--text-muted);"> ({{ cluster.count }})</span>
                    </div>
                  }
                </div>
              }
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
  clusterLoading = false;
  clusterReport: ClusterReport | null = null;
  lastPolygon: Array<[number, number]> = [];

  private map: L.Map | null = null;
  private markers: L.LayerGroup | null = null;
  private viewReady = false;
  private dataReady = false;
  private sse: EventSource | null = null;

  // Heat layer (PLAN feature 22) — density overlay weighted by
  // priority (default 3 when unscored).
  heatOn = false;
  private heatLayer: L.HeatLayer | null = null;

  // Radius search — server-side PostGIS ST_DWithin query so the map
  // is not limited to the first 100 client-loaded issues.
  radiusOn = false;
  radiusMeters = 2000;
  private radiusCenterMarker: L.Circle | null = null;
  private radiusLoading = false;

  // Ward-boundary filter — client-side narrowing of the loaded issues
  // by ward (the ward list comes from the departments endpoint).
  wards: Ward[] = [];
  filterWardId = '';

  // Ward boundary overlay + drill-down (P1-6/P1-11). Wards with a
  // persisted GeoJSON boundary render as clickable polygons; clicking
  // (or picking the ward in the dropdown) zooms to the ward, filters
  // markers + heat to it, and counts server-side matches via the
  // PostGIS in-polygon endpoint.
  private wardLayers: L.Polygon[] = [];
  drilledWardName = '';
  drilledCount: number | null = null;
  wardDrillLoading = false;

  // Server-side in-polygon matches for the last drawn area (PostGIS
  // ST_Contains via /spatial/issues/in-polygon, preferred over the
  // summarize-area JS-bbox fallback).
  polygonIssues: Array<{ id: string; title: string; status?: string; latitude: number | string | null; longitude: number | string | null }> = [];

  i18n = inject(TranslationService);
  private route = inject(ActivatedRoute);

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
  get clusterButtonLabel()  { return this.i18n.t('issuesMap.clusterButton'); }
  get clusterLoadingLabel() { return this.i18n.t('issuesMap.clusterLoading'); }
  get clusterTitleLabel()   { return this.i18n.t('issuesMap.clusterTitle'); }
  get moreLabel()           { return this.i18n.t('issuesMap.more'); }

  ngOnInit() {
    this.loadIssues();
    this.api.getWards().subscribe({
      next: (res) => {
        this.wards = res.data || [];
        this.renderWardBoundaries();
      },
      error: () => { this.wards = []; },
    });
    // "/citizen/nearby" (and any map link with ?nearby=1) opens the map
    // with the radius search pre-enabled (PLAN §10 — "Nearby issues on
    // interactive map").
    const path = this.route.snapshot.routeConfig?.path || '';
    if (path === 'citizen/nearby' || this.route.snapshot.queryParamMap.get('nearby') === '1') {
      this.radiusOn = true;
    }
  }
  ngAfterViewInit() { this.viewReady = true; this.tryInitMap(); }
  ngOnDestroy() {
    this.detachDrawHandlers();
    this.map?.remove();
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
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
  // Heat layer (PLAN feature 22 — "map visualization showing issue
  // density by ward/district")
  // -----------------------------------------------------------------
  toggleHeat() {
    this.heatOn = !this.heatOn;
    if (!this.map) return;
    if (this.heatOn) {
      this.buildHeatLayer();
    } else if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }
  }

  private buildHeatLayer() {
    if (!this.map) return;
    const points: Array<[number, number, number]> = this.issues
      .filter((i) => i.latitude != null && i.longitude != null && this.wardVisible(i))
      // Weight by priority (1-5) — critical issues burn hotter. Unscored
      // issues default to medium so they're still visible.
      .map((i) => [i.latitude!, i.longitude!, i.priority ?? 3] as [number, number, number]);
    if (!points.length) return;
    if (this.heatLayer) this.map.removeLayer(this.heatLayer);
    this.heatLayer = L.heatLayer(points, {
      radius: 28,
      blur: 20,
      maxZoom: 15,
      max: 5,
      gradient: { 0.2: '#10B981', 0.5: '#F59E0B', 0.8: '#DC2626' },
    });
    this.heatLayer.addTo(this.map);
  }

  // -----------------------------------------------------------------
  // Radius search — "issues near me" via server-side PostGIS query
  // -----------------------------------------------------------------
  toggleRadius() {
    this.radiusOn = !this.radiusOn;
    if (!this.radiusOn) {
      this.clearRadiusLayers();
      return;
    }
    this.runRadiusSearch();
  }

  onRadiusChange(value: number | string) {
    this.radiusMeters = Number(value);
    if (this.radiusOn) this.runRadiusSearch();
  }

  formatRadius(): string {
    return this.radiusMeters >= 1000
      ? `${(this.radiusMeters / 1000).toFixed(1)} km`
      : `${this.radiusMeters} m`;
  }

  // -----------------------------------------------------------------
  // Ward filter
  // -----------------------------------------------------------------
  wardVisible(issue: Issue): boolean {
    return !this.filterWardId || (issue as Issue & { wardId?: string }).wardId === this.filterWardId;
  }

  onWardChange(value: string) {
    this.filterWardId = value || '';
    this.mappedCount = this.issues.filter(
      (i) => i.latitude != null && i.longitude != null && this.wardVisible(i),
    ).length;
    this.redrawBaseMarkers();
    if (this.heatOn) this.buildHeatLayer();
    this.renderWardBoundaries();
    const ward = this.wards.find((w) => w.id === this.filterWardId);
    if (ward && this.wardRings(ward)) {
      this.drillIntoWard(ward, false);
    } else {
      this.drilledWardName = '';
      this.drilledCount = null;
    }
  }

  // -----------------------------------------------------------------
  // Ward boundary overlay + drill-down (P1-6 heat drill-down, P1-11
  // persisted GeoJSON boundaries). Clicking a ward polygon zooms to
  // it, filters markers/heat, and counts server-side in-polygon
  // matches so the count is not limited to client-loaded issues.
  // -----------------------------------------------------------------

  /**
   * Extract Leaflet-ready rings ([lat, lng]) from a ward's GeoJSON
   * boundary. Returns null when the ward has no (parseable) polygon.
   */
  private wardRings(ward: Ward): Array<Array<[number, number]>> | null {
    try {
      const boundary = (ward as Ward & { boundary?: any }).boundary;
      const geom = boundary?.geometry ?? boundary;
      if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return null;
      const polys: number[][][][] = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      const rings = polys
        .filter((p) => Array.isArray(p) && Array.isArray(p[0]) && p[0].length >= 4)
        .map((p) => p[0].map(([lng, lat]: number[]) => [lat, lng] as [number, number]));
      return rings.length ? rings : null;
    } catch {
      return null;
    }
  }

  private renderWardBoundaries() {
    if (!this.map) return;
    for (const layer of this.wardLayers) this.map.removeLayer(layer);
    this.wardLayers = [];
    for (const ward of this.wards) {
      const rings = this.wardRings(ward);
      if (!rings) continue;
      const selected = ward.id === this.filterWardId;
      const layer = L.polygon(rings as unknown as L.LatLngExpression[], {
        color: '#7C3AED',
        weight: selected ? 3 : 1.5,
        fillColor: '#7C3AED',
        fillOpacity: selected ? 0.14 : 0.05,
      });
      layer.bindTooltip(ward.name, { sticky: true, direction: 'top' });
      layer.on('click', () => this.drillIntoWard(ward, true));
      layer.addTo(this.map);
      this.wardLayers.push(layer);
    }
  }

  drillIntoWard(ward: Ward, refilter: boolean) {
    const rings = this.wardRings(ward);
    if (!rings) return;
    if (refilter) {
      this.filterWardId = ward.id;
      this.mappedCount = this.issues.filter(
        (i) => i.latitude != null && i.longitude != null && this.wardVisible(i),
      ).length;
      this.redrawBaseMarkers();
      if (this.heatOn) this.buildHeatLayer();
      this.renderWardBoundaries();
    }
    this.drilledWardName = ward.name;
    this.drilledCount = null;
    this.wardDrillLoading = true;
    if (this.map) {
      this.map.fitBounds(L.latLngBounds(rings[0]), { padding: [40, 40] });
    }
    // Server-side count via PostGIS ST_Contains (PostGIS takes
    // X-then-Y, so the Leaflet [lat, lng] ring is swapped back to
    // [lng, lat]). Failures keep the client-side filter active.
    const spatialPolygon = rings[0].map(([lat, lng]) => [lng, lat] as [number, number]);
    this.api.spatialIssuesInPolygon({ polygon: spatialPolygon }).subscribe({
      next: (res) => {
        this.wardDrillLoading = false;
        this.drilledCount = (res.data || []).length;
      },
      error: () => {
        this.wardDrillLoading = false;
        this.drilledCount = null;
      },
    });
  }



  private runRadiusSearch() {
    if (this.radiusLoading) return;
    if (!navigator.geolocation) {
      this.error = this.i18n.t('issuesMap.geoUnsupported');
      this.radiusOn = false;
      return;
    }
    this.radiusLoading = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.api
          .spatialIssuesWithin({ lat: latitude, lng: longitude, radius: this.radiusMeters })
          .subscribe({
            next: (res) => {
              this.radiusLoading = false;
              this.renderRadiusResults(latitude, longitude, res.data || []);
            },
            error: (err) => {
              this.radiusLoading = false;
              this.error = err.error?.error || this.i18n.t('issuesMap.loadFailed');
            },
          });
      },
      () => {
        this.radiusLoading = false;
        this.error = this.i18n.t('issuesMap.geoDenied');
        this.radiusOn = false;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private renderRadiusResults(
    centerLat: number,
    centerLng: number,
    rows: Array<{
      id: string; title: string; status?: string;
      latitude?: number | string | null; longitude?: number | string | null;
      distanceMeters: number;
    }>,
  ) {
    if (!this.map || !this.markers) return;
    this.clearRadiusLayers();

    // Highlight circle so the searched area is visible.
    this.radiusCenterMarker = L.circle([centerLat, centerLng], {
      radius: this.radiusMeters,
      color: '#2563EB',
      weight: 1,
      fillColor: '#2563EB',
      fillOpacity: 0.06,
      dashArray: '6 4',
    }).addTo(this.map);
    L.circleMarker([centerLat, centerLng], {
      radius: 6, color: '#2563EB', weight: 2, fillColor: '#FFF', fillOpacity: 1,
    }).bindPopup(this.i18n.t('issuesMap.youAreHere')).addTo(this.markers);

    const bounds: L.LatLngExpression[] = [[centerLat, centerLng]];
    for (const row of rows) {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const colors = statusColors(row.status || 'SUBMITTED');
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: colors.fill,
        color: colors.stroke,
        weight: 2,
        fillOpacity: 0.85,
      });
      marker.bindPopup(
        `<strong>${row.title}</strong><br>` +
        `<span style="font-size:11px;color:#666;">${Math.round(row.distanceMeters)} m away</span><br>` +
        `<a href="/issues/${row.id}">View details</a>`,
      );
      marker.addTo(this.markers);
      bounds.push([lat, lng]);
    }

    // Fit to the searched circle so the user sees the whole result set.
    this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  }

  private clearRadiusLayers() {
    if (!this.map) return;
    if (this.radiusCenterMarker) {
      this.map.removeLayer(this.radiusCenterMarker);
      this.radiusCenterMarker = null;
    }
    // Radius result markers were added to the same group as regular
    // markers, so a redraw of the base layer clears them. Re-render
    // the base markers to drop the radius-only ones.
    this.redrawBaseMarkers();
  }

  private redrawBaseMarkers() {
    if (!this.map || !this.markers) return;
    this.markers.clearLayers();
    for (const issue of this.issues) {
      if (issue.latitude == null || issue.longitude == null) continue;
      if (!this.wardVisible(issue)) continue;
      const colors = statusColors(issue.status);
      const marker = L.circleMarker([issue.latitude, issue.longitude], {
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
      marker.addTo(this.markers);
    }
  }

  // -----------------------------------------------------------------
  // Draw mode
  // -----------------------------------------------------------------
  enterDrawMode() {
    if (!this.map) return;
    this.cancelDraw(); // clear any previous state
    this.drawMode = true;
    this.areaSummary = null;
    this.polygonIssues = [];
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
    this.clusterReport = null;
    this.polygonIssues = [];
    const polygon = [...this.vertices];
    this.lastPolygon = polygon;
    // Prefer the server-side PostGIS in-polygon query (GIST-indexed
    // ST_Contains) for the authoritative match set. PostGIS takes
    // X-then-Y, so the drawn [lat, lng] vertices are swapped to
    // [lng, lat]. If it fails, fall back to the summarize-area path
    // (which itself degrades to a JS bounding box).
    const spatialPolygon = polygon.map(([lat, lng]) => [lng, lat] as [number, number]);
    this.api.spatialIssuesInPolygon({ polygon: spatialPolygon }).subscribe({
      next: (res) => {
        this.polygonIssues = res.data || [];
        this.highlightPolygonResults();
        this.loadAreaSummary(polygon);
      },
      error: () => {
        this.polygonIssues = [];
        this.loadAreaSummary(polygon);
      },
    });
  }

  private loadAreaSummary(polygon: Array<[number, number]>) {
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

  /**
   * Ring the server-side in-polygon matches in violet and fit the map
   * to the drawn area so the result set is visible at a glance.
   */
  private highlightPolygonResults() {
    if (!this.map || !this.markers || !this.polygonIssues.length) return;
    for (const row of this.polygonIssues) {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      L.circleMarker([lat, lng], {
        radius: 12,
        color: '#7C3AED',
        weight: 2,
        fill: false,
      }).addTo(this.markers);
    }
    if (this.closedPolygon) {
      this.map.fitBounds(this.closedPolygon.getBounds(), { padding: [40, 40] });
    }
  }

  cancelDraw() {
    this.detachDrawHandlers();
    this.clearDrawingLayers();
    this.vertices = [];
    this.drawMode = false;
  }

  generateClusterReport() {
    if (!this.lastPolygon.length) return;
    this.clusterLoading = true;
    this.clusterReport = null;
    this.api.clusterReport(this.lastPolygon).subscribe({
      next: (res: any) => {
        this.clusterLoading = false;
        if (res.success) this.clusterReport = res.data;
      },
      error: (err) => {
        this.clusterLoading = false;
        this.error = err.error?.error || this.i18n.t('issuesMap.loadFailed');
      },
    });
  }

  clearSummary() {
    this.areaSummary = null;
    this.clusterReport = null;
    this.polygonIssues = [];
    this.lastPolygon = [];
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

    const geoIssues = this.issues.filter(
      (i) => i.latitude != null && i.longitude != null && this.wardVisible(i),
    );
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
    this.renderWardBoundaries();
    this.initRealtime();
    // A pending "near me" radius search can only run once the map is up.
    if (this.radiusOn && !this.radiusCenterMarker) this.runRadiusSearch();
  }

  private initRealtime() {
    if (typeof window === 'undefined') return;
    const token = this.auth.token;
    if (!token) return;

    const url = `/api/v1/issues/realtime?token=${encodeURIComponent(token)}`;
    this.sse = new EventSource(url);

    this.sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.status === 'connected') {
          console.log('[Map SSE] Connected to real-time updates');
          return;
        }

        this.handleNewRealtimeIssue(payload);
      } catch (err) {
        console.error('[Map SSE] Failed to parse message:', err);
      }
    };

    this.sse.onerror = (err) => {
      console.warn('[Map SSE] Connection lost, retrying...', err);
    };
  }

  private handleNewRealtimeIssue(issue: any) {
    if (!this.map || !this.markers) return;
    if (issue.latitude == null || issue.longitude == null) return;

    const latlng: L.LatLngExpression = [issue.latitude, issue.longitude];

    if (this.issues.some((i) => i.id === issue.id)) return;
    this.issues.push(issue);
    this.mappedCount++;

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
      `${issue.location}<br><a href="/issues/${issue.id}">View details</a>`
    );
    marker.addTo(this.markers);

    if (this.mappedCount === 1) {
      this.map.setView(latlng, 12);
    }
  }
}
