import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Ward, Department, UserRole } from '@dd/shared-types';
import * as L from 'leaflet';

type WardWithDepts = Ward & {
  departments?: Array<{ department: { id: string; name: string; code: string } }>;
};

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
                    <tr><th>{{ i18n.t('adminWards.colName') }}</th><th>{{ i18n.t('adminWards.colCode') }}</th><th>{{ i18n.t('adminWards.colDescription') }}</th><th>{{ i18n.t('adminWards.colBoundary') }}</th><th>{{ i18n.t('adminWards.colDepts') }}</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (ward of wards; track ward.id) {
                      <tr [style.background]="selectedId === ward.id ? 'var(--bg-primary)' : 'transparent'">
                        <td><strong>{{ ward.name }}</strong></td>
                        <td><span class="badge badge-blue">{{ ward.code }}</span></td>
                        <td style="font-size:12px;color:var(--text-secondary);">{{ ward.description || '-' }}</td>
                        <td>
                          @if (ward.boundary) {
                            <span class="badge badge-green">{{ i18n.t('adminWards.hasBoundary') }}</span>
                          } @else {
                            <span class="badge badge-slate">{{ i18n.t('adminWards.noBoundary') }}</span>
                          }
                        </td>
                        <td style="font-size:12px;color:var(--text-secondary);">{{ deptCodes(ward) || '-' }}</td>
                        <td>
                          <div style="display:flex;gap:4px;">
                            <button type="button" class="btn btn-secondary btn-sm" (click)="selectWard(ward)">{{ i18n.t('adminWards.editBtn') }}</button>
                            <button type="button" class="btn btn-secondary btn-sm" [disabled]="deletingId === ward.id" (click)="deleteWard(ward)">{{ deletingId === ward.id ? i18n.t('adminWards.deleting') : i18n.t('adminWards.deleteBtn') }}</button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('adminWards.noWards') }}</td></tr>
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

        @if (selected) {
          <div class="card" style="margin-top:24px;" data-testid="ward-editor">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>{{ i18n.t('adminWards.editHeader', { name: selected.name }) }}</h3>
              <button type="button" class="btn btn-ghost btn-sm" (click)="closeEditor()">✕</button>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
              @if (saveMsg) {
                <div style="padding:10px 14px;border-radius:var(--radius);font-size:13px;" [style.background]="saveOk ? '#ECFDF5' : '#FEF2F2'" [style.color]="saveOk ? '#065F46' : 'var(--danger)'">{{ saveMsg }}</div>
              }
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <input type="text" [(ngModel)]="editName" [placeholder]="i18n.t('adminWards.namePlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <input type="text" [(ngModel)]="editDescription" [placeholder]="i18n.t('adminWards.descPlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
              </div>

              <div>
                <div style="font-size:13px;font-weight:700;margin-bottom:6px;">{{ i18n.t('adminWards.boundaryLabel') }}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">{{ i18n.t('adminWards.boundaryHint') }}</div>
                <div id="ward-edit-map" style="height:260px;width:100%;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                  @if (!drawing) {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="startDraw()">✏️ {{ i18n.t('adminWards.drawBoundary') }}</button>
                  } @else {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="stopDraw()">✕ {{ i18n.t('adminWards.stopDraw') }} ({{ drawVertices.length }})</button>
                    <button type="button" class="btn btn-primary btn-sm" (click)="useDrawnShape()" [disabled]="drawVertices.length < 3">✓ {{ i18n.t('adminWards.useDrawn') }}</button>
                  }
                  <button type="button" class="btn btn-ghost btn-sm" (click)="clearDraw()">{{ i18n.t('adminWards.clearDraw') }}</button>
                </div>
                <textarea [(ngModel)]="boundaryText" rows="5" spellcheck="false"
                  [placeholder]="i18n.t('adminWards.boundaryPlaceholder')"
                  data-testid="ward-boundary-input"
                  style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;font-family:monospace;resize:vertical;"></textarea>
                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="saving" (click)="saveWard()" data-testid="ward-save">
                    {{ saving ? i18n.t('adminWards.saving') : i18n.t('adminWards.saveBtn') }}
                  </button>
                  @if (selected.boundary) {
                    <button type="button" class="btn btn-secondary btn-sm" [disabled]="saving" (click)="clearBoundary()">{{ i18n.t('adminWards.clearBoundary') }}</button>
                  }
                </div>
              </div>

              <div>
                <div style="font-size:13px;font-weight:700;margin-bottom:6px;">{{ i18n.t('adminWards.departmentsLabel') }}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">{{ i18n.t('adminWards.assignHint') }}</div>
                @if (deptLoading) {
                  <div style="font-size:12px;color:var(--text-muted);">{{ i18n.t('adminWards.loading') }}</div>
                } @else {
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    @for (d of departments; track d.id) {
                      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                        <input type="checkbox" [checked]="assignedDeptIds.has(d.id)" (change)="onToggleDept(d, $any($event.target).checked)" [disabled]="assigning" />
                        <strong>{{ d.name }}</strong>
                        <span class="badge badge-blue">{{ d.code }}</span>
                      </label>
                    } @empty {
                      <div style="font-size:12px;color:var(--text-muted);">{{ i18n.t('adminWards.noDepartments') }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
      }
    </app-layout>
  `,
})
export class AdminWardsPageComponent implements OnInit, OnDestroy {
  wards: WardWithDepts[] = [];
  departments: Department[] = [];
  loading = true;
  creating = false;
  error = '';
  authorized = false;
  newWard = { name: '', code: '', description: '' };
  navItems: NavItem[] = [];

  deletingId = '';

  // Editor state
  selected: WardWithDepts | null = null;
  selectedId = '';
  editName = '';
  editDescription = '';
  boundaryText = '';
  saving = false;
  saveMsg = '';
  saveOk = false;
  deptLoading = false;
  assigning = false;
  assignedDeptIds = new Set<string>();

  // Mini-map drawing state
  drawing = false;
  drawVertices: Array<[number, number]> = [];
  private editMap: L.Map | null = null;
  private drawLayer: L.Polyline | null = null;
  private drawMarkers: L.CircleMarker[] = [];
  private previewPolygon: L.Polygon | null = null;
  private drawClick: ((e: L.LeafletMouseEvent) => void) | null = null;

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

  ngOnDestroy() {
    this.destroyEditMap();
  }

  deptCodes(ward: WardWithDepts): string {
    return (ward.departments || []).map((d) => d.department.code).join(', ');
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

  // P2-15 — ward delete with reassignment guards. A 409 body carries
  // `blockers: string[]` naming the issues / residents / digests that
  // still reference the ward.
  deleteWard(ward: WardWithDepts) {
    if (this.deletingId) return;
    if (!window.confirm(this.i18n.t('adminWards.deleteConfirm', { name: ward.name }))) return;
    this.deletingId = ward.id;
    this.error = '';
    this.api.deleteWard(ward.id).subscribe({
      next: (res: any) => {
        this.deletingId = '';
        if (res.success) {
          if (this.selectedId === ward.id) this.closeEditor();
          this.wards = this.wards.filter((w) => w.id !== ward.id);
        }
      },
      error: (err) => {
        this.deletingId = '';
        const blockers = err.error?.blockers?.join(' ');
        this.error = blockers || err.error?.error || this.i18n.t('adminWards.deleteFailed');
      },
    });
  }

  // -----------------------------------------------------------------
  // Ward editor (P1-11 — polygon edit + Department↔Ward assignments)
  // -----------------------------------------------------------------
  selectWard(ward: WardWithDepts) {
    this.closeEditor();
    this.selected = ward;
    this.selectedId = ward.id;
    this.editName = ward.name;
    this.editDescription = ward.description || '';
    this.boundaryText = ward.boundary ? JSON.stringify(ward.boundary, null, 2) : '';
    this.saveMsg = '';
    this.assignedDeptIds = new Set((ward.departments || []).map((d) => d.department.id));
    this.loadDepartments();
    // The editor card renders after this tick — init the map then.
    setTimeout(() => this.initEditMap(), 0);
  }

  closeEditor() {
    this.selected = null;
    this.selectedId = '';
    this.boundaryText = '';
    this.saveMsg = '';
    this.drawing = false;
    this.drawVertices = [];
    this.destroyEditMap();
  }

  private loadDepartments() {
    this.deptLoading = true;
    this.api.getDepartments().subscribe({
      next: (res: any) => {
        this.departments = res.data || [];
        this.deptLoading = false;
      },
      error: () => { this.deptLoading = false; },
    });
  }

  onToggleDept(dept: Department, checked: boolean) {
    if (!this.selected || this.assigning) return;
    this.assigning = true;
    this.saveMsg = '';
    const req = checked
      ? this.api.assignWardDepartment(this.selected.id, dept.id)
      : this.api.unassignWardDepartment(this.selected.id, dept.id);
    req.subscribe({
      next: () => {
        if (checked) this.assignedDeptIds.add(dept.id);
        else this.assignedDeptIds.delete(dept.id);
        this.refreshWardRow();
        this.assigning = false;
      },
      error: (err) => {
        this.saveOk = false;
        this.saveMsg = err.error?.error || this.i18n.t('adminWards.saveFailed');
        this.assigning = false;
      },
    });
  }

  private refreshWardRow() {
    if (!this.selected) return;
    const deptList = this.departments.filter((d) => this.assignedDeptIds.has(d.id));
    this.wards = this.wards.map((w) =>
      w.id === this.selected!.id
        ? { ...w, departments: deptList.map((d) => ({ department: { id: d.id, name: d.name, code: d.code } })) }
        : w,
    );
    const updated = this.wards.find((w) => w.id === this.selected!.id);
    if (updated) this.selected = updated;
  }

  saveWard() {
    if (!this.selected || this.saving) return;
    this.saving = true;
    this.saveMsg = '';
    let boundary: Ward['boundary'] | null | undefined;
    const text = this.boundaryText.trim();
    if (text) {
      try {
        boundary = JSON.parse(text);
      } catch {
        this.saveOk = false;
        this.saveMsg = this.i18n.t('adminWards.invalidGeoJson');
        this.saving = false;
        return;
      }
    } else {
      boundary = null;
    }
    this.api.updateWard(this.selected.id, {
      name: this.editName || undefined,
      description: this.editDescription || undefined,
      boundary: boundary as any,
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.wards = this.wards.map((w) => (w.id === this.selected!.id ? { ...w, ...res.data } : w));
          this.selected = { ...this.selected!, ...res.data };
          this.saveOk = true;
          this.saveMsg = this.i18n.t('adminWards.saveOk');
          this.renderPreview();
        }
        this.saving = false;
      },
      error: (err) => {
        this.saveOk = false;
        const details = err.error?.details?.map((d: any) => d.message).join('; ');
        this.saveMsg = details || err.error?.error || this.i18n.t('adminWards.saveFailed');
        this.saving = false;
      },
    });
  }

  clearBoundary() {
    this.boundaryText = '';
    this.saveWard();
  }

  // -----------------------------------------------------------------
  // Mini-map polygon drawing
  // -----------------------------------------------------------------
  private initEditMap() {
    const el = document.getElementById('ward-edit-map');
    if (!el || this.editMap) return;
    this.editMap = L.map('ward-edit-map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.editMap);
    const ring = this.parseBoundaryText();
    if (ring && ring.length) {
      this.previewPolygon = L.polygon(ring, { color: '#7C3AED', weight: 2, fillOpacity: 0.15 }).addTo(this.editMap);
      this.editMap.fitBounds(this.previewPolygon.getBounds(), { padding: [24, 24] });
    } else {
      this.editMap.setView([40.7128, -74.006], 12);
    }
  }

  private destroyEditMap() {
    if (this.drawClick && this.editMap) this.editMap.off('click', this.drawClick);
    this.drawClick = null;
    this.editMap?.remove();
    this.editMap = null;
    this.drawLayer = null;
    this.drawMarkers = [];
    this.previewPolygon = null;
  }

  startDraw() {
    if (!this.editMap || this.drawing) return;
    this.drawing = true;
    this.drawVertices = [];
    this.clearDrawLayers();
    if (this.previewPolygon) {
      this.editMap.removeLayer(this.previewPolygon);
      this.previewPolygon = null;
    }
    this.drawClick = (e: L.LeafletMouseEvent) => {
      if (!this.editMap) return;
      this.drawVertices.push([e.latlng.lat, e.latlng.lng]);
      const marker = L.circleMarker(e.latlng, { radius: 5, color: '#2563EB', weight: 2, fillColor: '#FFF', fillOpacity: 1 })
        .addTo(this.editMap);
      marker.bindTooltip(`#${this.drawVertices.length}`);
      this.drawMarkers.push(marker);
      // Rebuild the preview polyline from the vertex list.
      if (this.drawLayer) this.editMap.removeLayer(this.drawLayer);
      if (this.drawVertices.length >= 2) {
        this.drawLayer = L.polyline(this.drawVertices, { color: '#2563EB', weight: 2, dashArray: '4 4' }).addTo(this.editMap);
      }
    };
    this.editMap.on('click', this.drawClick);
  }

  stopDraw() {
    if (this.editMap && this.drawClick) this.editMap.off('click', this.drawClick);
    this.drawClick = null;
    this.drawing = false;
  }

  clearDraw() {
    this.stopDraw();
    this.drawVertices = [];
    this.clearDrawLayers();
  }

  useDrawnShape() {
    if (this.drawVertices.length < 3 || !this.selected) return;
    const ring = [...this.drawVertices.map(([lat, lng]) => [lng, lat]), [this.drawVertices[0][1], this.drawVertices[0][0]]];
    this.boundaryText = JSON.stringify({
      type: 'Feature',
      properties: { code: this.selected.code },
      geometry: { type: 'Polygon', coordinates: [ring] },
    }, null, 2);
    this.stopDraw();
    this.renderPreview();
  }

  private clearDrawLayers() {
    if (!this.editMap) return;
    for (const m of this.drawMarkers) this.editMap.removeLayer(m);
    this.drawMarkers = [];
    if (this.drawLayer) {
      this.editMap.removeLayer(this.drawLayer);
      this.drawLayer = null;
    }
  }

  private parseBoundaryText(): Array<[number, number]> | null {
    try {
      const text = this.boundaryText.trim();
      if (!text) return null;
      const feature = JSON.parse(text);
      const geom = feature?.geometry;
      if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return null;
      const rings = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.coordinates.map((p: number[][][]) => p[0]);
      const ring = rings[0];
      if (!Array.isArray(ring)) return null;
      // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
      return ring.map(([lng, lat]: number[]) => [lat, lng] as [number, number]);
    } catch {
      return null;
    }
  }

  private renderPreview() {
    if (!this.editMap) return;
    if (this.previewPolygon) {
      this.editMap.removeLayer(this.previewPolygon);
      this.previewPolygon = null;
    }
    const ring = this.parseBoundaryText();
    if (ring && ring.length) {
      this.previewPolygon = L.polygon(ring, { color: '#7C3AED', weight: 2, fillOpacity: 0.15 }).addTo(this.editMap);
      this.editMap.fitBounds(this.previewPolygon.getBounds(), { padding: [24, 24] });
    }
  }
}
