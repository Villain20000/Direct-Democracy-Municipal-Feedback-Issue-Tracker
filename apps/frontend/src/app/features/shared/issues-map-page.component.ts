import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';
import * as L from 'leaflet';

@Component({
  selector: 'app-issues-map-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  template: `
    <app-layout pageTitle="Issues Map" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      <div class="card">
        <div class="card-header">
          <h3>📍 Issue Locations</h3>
          <span style="font-size:12px;color:var(--text-muted);">{{ mappedCount }} issues on map</span>
        </div>
        <div class="card-body" style="padding:0;position:relative;">
          @if (loading) {
            <div style="position:absolute;inset:0;z-index:1000;background:rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;color:var(--text-muted);">
              Loading issues...
            </div>
          }
          <div id="issues-map" style="height:500px;width:100%;border-radius:0 0 var(--radius) var(--radius);"></div>
        </div>
      </div>

      @if (!loading && mappedCount === 0) {
        <div class="card" style="margin-top:16px;">
          <div class="card-body" style="text-align:center;padding:32px;color:var(--text-muted);">
            No issues with location coordinates found.
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class IssuesMapPageComponent implements OnInit, AfterViewInit, OnDestroy {
  issues: Issue[] = [];
  loading = true;
  error = '';
  mappedCount = 0;
  navItems: NavItem[] = [];
  private map: L.Map | null = null;
  private markers: L.LayerGroup | null = null;
  private viewReady = false;
  private dataReady = false;

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadIssues(); }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitMap();
  }

  ngOnDestroy() {
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
        this.error = err.error?.error || 'Failed to load issues.';
        this.loading = false;
      },
    });
  }

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
      const marker = L.circleMarker(latlng, {
        radius: 8,
        fillColor: '#2563EB',
        color: '#1D4ED8',
        weight: 2,
        fillOpacity: 0.8,
      });
      marker.bindPopup(`<strong>${issue.title}</strong><br>${issue.location}<br><a href="/issues/${issue.id}">View details</a>`);
      marker.addTo(this.markers!);
    }

    this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  }
}