import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  documentSource: string;
  documentDate: string | null;
  chunkIndex: number;
  content: string;
  score: number;
}

interface DocumentChunk {
  id: string;
  chunkIndex: number;
  content: string;
}

interface FullDocument {
  id: string;
  title: string;
  type: string;
  source: string;
  description?: string | null;
  documentDate?: string | null;
  contentHash: string;
  charCount: number;
  chunkCount: number;
  createdAt: string;
  chunks: DocumentChunk[];
}

@Component({
  selector: 'app-admin-documents-browse-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, TranslatePipe, DatePipe],
  template: `
    <app-layout
      [pageTitle]="i18n.t('adminDocsBrowse.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div class="content-grid" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 20px;">

        <!-- Search + results -->
        <div style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">

          <!-- Search controls -->
          <div class="card">
            <div class="card-header">
              <h3>🔎 {{ i18n.t('adminDocsBrowse.searchHeader') }}</h3>
            </div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">{{ i18n.t('adminDocsBrowse.queryField') }}</label>
                <input
                  class="form-input"
                  type="text"
                  [(ngModel)]="query"
                  (keydown.enter)="search()"
                  [placeholder]="i18n.t('adminDocsBrowse.queryPlaceholder')"
                  style="width:100%;"
                  autofocus />
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                    <label style="font-size:13px;font-weight:600;">{{ i18n.t('adminDocsBrowse.topKField') }}</label>
                    <span style="font-size:13px;font-weight:700;color:var(--primary);">{{ topK }}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    [(ngModel)]="topK"
                    (ngModelChange)="scheduleSearch()"
                    style="width:100%;accent-color:var(--primary);" />
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px;">
                    <span>1</span><span>20</span>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                    <label style="font-size:13px;font-weight:600;">{{ i18n.t('adminDocsBrowse.minScoreField') }}</label>
                    <span style="font-size:13px;font-weight:700;color:var(--primary);">{{ minScoreLabel }}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    [(ngModel)]="minScore"
                    (ngModelChange)="scheduleSearch()"
                    style="width:100%;accent-color:var(--primary);" />
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px;">
                    <span>0.00</span><span>1.00</span>
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:8px;align-items:center;">
                <button
                  type="button"
                  class="btn btn-primary"
                  (click)="search()"
                  [disabled]="searching || !query.trim() || query.trim().length < 3">
                  @if (searching) { {{ i18n.t('adminDocsBrowse.searching') }} }
                  @else { 🔎 {{ i18n.t('adminDocsBrowse.searchBtn') }} }
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  (click)="resetForm()"
                  [disabled]="searching">
                  {{ i18n.t('adminDocsBrowse.resetBtn') }}
                </button>
                @if (lastQuery) {
                  <div style="font-size:12px;color:var(--text-muted);margin-left:auto;">
                    {{ i18n.t('adminDocsBrowse.lastQuery', { q: lastQuery, n: results.length }) }}
                  </div>
                }
              </div>

              @if (searchError) {
                <div style="background:#FEE2E2;color:#991B1B;padding:10px 12px;border-radius:var(--radius);font-size:13px;">
                  {{ searchError }}
                </div>
              }
            </div>
          </div>

          <!-- Results list -->
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>📑 {{ i18n.t('adminDocsBrowse.resultsHeader', { n: results.length }) }}</h3>
              @if (lastQuery) {
                <span style="font-size:12px;color:var(--text-muted);">{{ i18n.t('adminDocsBrowse.topKOf', { k: topK }) }}</span>
              }
            </div>
            <div class="card-body" style="padding:0;">
              @if (!lastQuery && !searching) {
                <div style="padding:48px;text-align:center;color:var(--text-muted);">
                  <i class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">manage_search</i>
                  {{ i18n.t('adminDocsBrowse.empty') }}
                </div>
              } @else if (searching) {
                <div style="padding:32px;text-align:center;color:var(--text-muted);">{{ i18n.t('common.loading') }}</div>
              } @else if (results.length === 0) {
                <div style="padding:48px;text-align:center;color:var(--text-muted);">
                  <i class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">search_off</i>
                  {{ i18n.t('adminDocsBrowse.noResults', { q: lastQuery }) }}
                </div>
              } @else {
                <div style="display:flex;flex-direction:column;">
                  @for (r of results; track r.chunkId) {
                    <button
                      type="button"
                      (click)="selectChunk(r)"
                      [class.chunk-row]="true"
                      [class.chunk-row-selected]="selectedChunkId === r.chunkId"
                      [class.chunk-row-dim]="selectedDocumentId && selectedDocumentId === r.documentId && selectedChunkId !== r.chunkId"
                      style="text-align:left;background:none;border:0;border-bottom:1px solid var(--border-light);padding:14px 16px;cursor:pointer;font:inherit;color:inherit;width:100%;">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px;">
                        <div style="flex:1;min-width:0;">
                          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                            <strong style="font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r.documentTitle }}</strong>
                            <span class="badge badge-blue" style="flex-shrink:0;">{{ r.documentType }}</span>
                          </div>
                          @if (r.documentDate) {
                            <div style="font-size:11px;color:var(--text-muted);">📅 {{ r.documentDate }} · chunk #{{ r.chunkIndex }}</div>
                          } @else {
                            <div style="font-size:11px;color:var(--text-muted);">chunk #{{ r.chunkIndex }}</div>
                          }
                        </div>
                        <div style="flex-shrink:0;text-align:right;">
                          <div [style.background]="scoreColor(r.score)" [style.color]="'#fff'" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">
                            {{ (r.score * 100).toFixed(1) }}%
                          </div>
                          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">{{ i18n.t('adminDocsBrowse.similarity') }}</div>
                        </div>
                      </div>
                      <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;font-family:monospace;background:var(--bg-primary);padding:8px 10px;border-radius:var(--radius);border-left:3px solid var(--primary);">
                        {{ r.content.slice(0, 280) }}{{ r.content.length > 280 ? '…' : '' }}
                      </div>
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Document detail panel -->
        <div style="min-width:0;position:sticky;top:0;">
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>📄 {{ selectedDocumentTitle() }}</h3>
              <button type="button" class="btn btn-secondary btn-sm" (click)="closeDetail()" [disabled]="!selectedDocumentId">
                ✕
              </button>
            </div>
            <div class="card-body">
              @if (!selectedDocumentId) {
                <div style="padding:32px;text-align:center;color:var(--text-muted);">
                  <i class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">article</i>
                  {{ i18n.t('adminDocsBrowse.detailEmpty') }}
                </div>
              } @else if (detailLoading) {
                <div style="padding:32px;text-align:center;color:var(--text-muted);">{{ i18n.t('common.loading') }}</div>
              } @else if (detailError) {
                <div style="background:#FEE2E2;color:#991B1B;padding:10px 12px;border-radius:var(--radius);font-size:13px;">
                  {{ detailError }}
                </div>
              } @else if (selectedDocument) {
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                  <span class="badge badge-blue">{{ selectedDocument.type }}</span>
                  @if (selectedDocument.documentDate) {
                    <span class="badge">📅 {{ selectedDocument.documentDate }}</span>
                  }
                  <span class="badge">{{ selectedDocument.chunkCount }} chunks</span>
                  <span class="badge">{{ selectedDocument.charCount }} chars</span>
                </div>
                @if (selectedDocument.description) {
                  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5;">
                    {{ selectedDocument.description }}
                  </div>
                }
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;word-break:break-all;">
                  <strong>{{ i18n.t('adminDocsBrowse.source') }}:</strong> {{ selectedDocument.source }}
                </div>
                <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
                  {{ i18n.t('adminDocsBrowse.chunksHeader') }}
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;max-height:520px;overflow-y:auto;">
                  @for (chunk of selectedDocument.chunks; track chunk.id) {
                    <div
                      [class.chunk-detail]="true"
                      [class.chunk-detail-active]="chunk.chunkIndex === selectedChunkIndex"
                      style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;background:var(--bg-primary);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:11px;font-weight:700;color:var(--text-muted);">CHUNK #{{ chunk.chunkIndex }}</span>
                        @if (chunk.chunkIndex === selectedChunkIndex) {
                          <span style="font-size:10px;background:var(--primary);color:#fff;padding:2px 8px;border-radius:999px;font-weight:700;">
                            {{ i18n.t('adminDocsBrowse.matched') }}
                          </span>
                        }
                      </div>
                      <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;color:var(--text-primary);">{{ chunk.content }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    .chunk-row:hover {
      background: var(--bg-primary);
    }
    .chunk-row-selected {
      background: #EFF6FF !important;
      border-left: 3px solid var(--primary) !important;
    }
    .chunk-row-dim {
      opacity: 0.55;
    }
    .chunk-detail-active {
      border-color: var(--primary) !important;
      background: #EFF6FF !important;
    }
    input[type="range"] {
      cursor: pointer;
    }
  `],
})
export class AdminDocumentsBrowsePageComponent implements OnInit {
  query = '';
  topK = 5;
  minScore = 0.3;
  searching = false;
  searchError = '';

  results: RetrievedChunk[] = [];
  lastQuery = '';

  selectedDocumentId: string | null = null;
  selectedChunkId: string | null = null;
  selectedChunkIndex: number | null = null;
  selectedDocument: FullDocument | null = null;
  detailLoading = false;
  detailError = '';

  // Slider throttle: re-search only after the user pauses adjusting.
  private sliderTimer: ReturnType<typeof setTimeout> | null = null;
  // Monotonic counter so a slow earlier request can't overwrite a newer one's results.
  private searchSeq = 0;

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/admin' },
    { icon: 'people', label: 'nav.users', route: '/admin/users' },
    { icon: 'apartment', label: 'nav.departments', route: '/admin/departments' },
    { icon: 'map', label: 'nav.wards', route: '/admin/wards' },
    { icon: 'library_books', label: 'nav.documents', route: '/admin/documents' },
    { icon: 'travel_explore', label: 'nav.browse', route: '/admin/documents/browse' },
    { icon: 'settings', label: 'nav.settings', route: '/admin/settings' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  ngOnInit() {
    // No automatic search — admin enters a query first.
  }

  get minScoreLabel(): string {
    return this.minScore.toFixed(2);
  }

  scoreColor(score: number): string {
    // Tailwind-ish: red below 0.5, amber 0.5–0.7, green above 0.7.
    if (score >= 0.7) return '#16A34A';
    if (score >= 0.5) return '#D97706';
    return '#DC2626';
  }

  scheduleSearch() {
    if (!this.query.trim() || this.query.trim().length < 3) return;
    if (this.sliderTimer) clearTimeout(this.sliderTimer);
    this.sliderTimer = setTimeout(() => this.search(), 400);
  }

  search() {
    const q = this.query.trim();
    if (q.length < 3) {
      this.searchError = this.i18n.t('adminDocsBrowse.queryTooShort');
      return;
    }
    this.searchError = '';
    this.searching = true;
    const seq = ++this.searchSeq;
    this.api.retrieveDocuments(q, this.topK, this.minScore).subscribe({
      next: (res: any) => {
        // Drop stale responses from earlier in-flight requests.
        if (seq !== this.searchSeq) return;
        this.searching = false;
        this.lastQuery = q;
        this.results = (res?.data?.chunks || []) as RetrievedChunk[];
        // If the user previously had a document open and it's still in the result set, keep it.
        if (this.selectedDocumentId && !this.results.find(r => r.documentId === this.selectedDocumentId)) {
          this.closeDetail();
        }
      },
      error: (err) => {
        if (seq !== this.searchSeq) return;
        this.searching = false;
        this.searchError = err.error?.error || 'Search failed.';
      },
    });
  }

  resetForm() {
    this.query = '';
    this.topK = 5;
    this.minScore = 0.3;
    this.results = [];
    this.lastQuery = '';
    this.searchError = '';
    this.closeDetail();
  }

  selectChunk(r: RetrievedChunk) {
    this.selectedChunkId = r.chunkId;
    this.selectedChunkIndex = r.chunkIndex;
    if (this.selectedDocumentId === r.documentId && this.selectedDocument) {
      // Already loaded — just scroll the matched chunk into view.
      return;
    }
    this.loadDocument(r.documentId);
  }

  selectedDocumentTitle(): string {
    if (this.selectedDocument) return this.selectedDocument.title;
    if (this.selectedChunkId) {
      const r = this.results.find(x => x.chunkId === this.selectedChunkId);
      if (r) return r.documentTitle;
    }
    return this.i18n.t('adminDocsBrowse.detailTitle');
  }

  private loadDocument(id: string) {
    this.selectedDocumentId = id;
    this.selectedDocument = null;
    this.detailError = '';
    this.detailLoading = true;
    this.api.getDocument(id).subscribe({
      next: (res: any) => {
        this.detailLoading = false;
        this.selectedDocument = res?.data as FullDocument;
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError = err.error?.error || 'Failed to load document.';
      },
    });
  }

  closeDetail() {
    this.selectedDocumentId = null;
    this.selectedChunkId = null;
    this.selectedChunkIndex = null;
    this.selectedDocument = null;
    this.detailError = '';
  }
}
