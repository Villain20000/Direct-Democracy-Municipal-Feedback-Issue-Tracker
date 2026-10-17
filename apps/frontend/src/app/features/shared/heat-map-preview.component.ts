import { Component, Input, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../core/i18n/translation.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';
import * as L from 'leaflet';
import 'leaflet.heat';

/**
 * Live geographic heat preview (PLAN feature 22 — "Map visualization
 * showing issue density by ward/district with drill-down").
 *
 * Replaces the static illustration placeholders that previously sat on
 * the Ward and Media dashboards. Renders a small, non-interactive
 * Leaflet map with a priority-weighted heat overlay, plus a link that
 * drills down to the full map page.
 *
 * Inputs:
 *   wardId — optional server-side ward filter
 *   linkRoute — where "open full map" navigates (defaults to /issues)
 */
@Component({
  selector: 'app-heat-map-preview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div style="position:relative;height:{{ height }}px;border-radius:var(--radius);overflow:hidden;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);">
      <div [id]="mapId" style="position:absolute;inset:0;"></div>
      <div style="position:absolute;bottom:10px;left:10px;z-index:1000;background:rgba(255,255,255,0.92);padding:6px 12px;border-radius:var(--radius);font-size:12px;font-weight:600;box-shadow:var(--shadow-md);">
        🔥 {{ i18n.t('issuesMap.heatToggle') }}
        <span style="color:var(--text-muted);font-weight:400;margin-left:6px;">{{ i18n.t('issuesMap.mappedCount', { n: mappedCount }) }}</span>
      </div>
      <div style="position:absolute;top:10px;right:10px;z-index:1000;">
        <a [routerLink]="linkRoute" class="btn btn-secondary btn-sm">{{ i18n.t('issuesMap.openFullMap') }}</a>
      </div>
      @if (loading) {
        <div style="position:absolute;inset:0;z-index:2000;background:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">
          {{ i18n.t('issuesMap.loading') }}
        </div>
      }
    </div>
  `,
})
export class HeatMapPreviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() wardId: string | null = null;
  @Input() linkRoute: string = '/issues';
  @Input() height = 240;

  loading = true;
  mappedCount = 0;

  i18n = inject(TranslationService);
  private api = inject(ApiService);

  private map: L.Map | null = null;
  private heat: L.HeatLayer | null = null;
  private viewReady = false;
  private dataReady = false;
  private points: Array<[number, number, number]> = [];
  private pendingFit: Array<[number, number]> = [];

  readonly mapId = `heat-preview-${Math.random().toString(36).slice(2, 10)}`;

  ngOnInit() {
    const params: Record<string, string> = { pageSize: '500' };
    if (this.wardId) params['wardId'] = this.wardId;
    this.api.getIssues(params).subscribe({
      next: (res: any) => {
        const issues: Issue[] = res.data || [];
        this.points = issues
          .filter((i) => i.latitude != null && i.longitude != null)
          .map((i) => [i.latitude!, i.longitude!, i.priority ?? 3] as [number, number, number]);
        this.mappedCount = this.points.length;
        this.loading = false;
        this.dataReady = true;
        this.tryInit();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInit();
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = null;
  }

  private tryInit() {
    if (!this.viewReady || !this.dataReady || this.map) return;
    const el = document.getElementById(this.mapId);
    if (!el) return;

    this.map = L.map(this.mapId, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    if (this.points.length === 0) {
      this.map.setView([40.7128, -74.006], 11);
      return;
    }

    this.heat = L.heatLayer(this.points, {
      radius: 26,
      blur: 18,
      maxZoom: 14,
      max: 5,
      gradient: { 0.2: '#10B981', 0.5: '#F59E0B', 0.8: '#DC2626' },
    });
    this.heat.addTo(this.map);
    this.map.fitBounds(L.latLngBounds(this.points.map((p) => [p[0], p[1]] as [number, number])), {
      padding: [24, 24],
    });
  }
}
