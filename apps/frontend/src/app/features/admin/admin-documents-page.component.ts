import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { getFieldErrors, groupFieldErrorsByField, toApiError } from '../../core/errors/api-error';

interface AdminDocument {
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
  _count?: { chunks: number };
}

@Component({
  selector: 'app-admin-documents-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, TranslatePipe, DatePipe],
  template: `
    <app-layout
      [pageTitle]="i18n.t('adminDocs.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()"
      data-testid="admin-documents-page">

      <div class="content-grid" style="grid-template-columns: 1fr 380px; align-items: start;">

        <!-- Document list -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>📚 {{ i18n.t('adminDocs.header', { n: documents.length }) }}</h3>
            <button type="button" class="btn btn-secondary btn-sm" (click)="reload()" [disabled]="loading">
              {{ loading ? i18n.t('common.loading') : i18n.t('adminDocs.refresh') }}
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            @if (loading) {
              <div style="padding:32px;text-align:center;color:var(--text-muted);">{{ i18n.t('adminDocs.loading') }}</div>
            } @else if (documents.length === 0) {
              <div style="padding:48px;text-align:center;color:var(--text-muted);">
                <i class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">description</i>
                {{ i18n.t('adminDocs.empty') }}
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ i18n.t('adminDocs.titleCol') }}</th>
                    <th>{{ i18n.t('adminDocs.typeCol') }}</th>
                    <th>{{ i18n.t('adminDocs.chunksCol') }}</th>
                    <th>{{ i18n.t('adminDocs.uploadedCol') }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (doc of documents; track doc.id) {
                    <tr>
                      <td>
                        <strong>{{ doc.title }}</strong>
                        @if (doc.description) {
                          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">{{ doc.description }}</div>
                        }
                        @if (doc.documentDate) {
                          <div style="font-size:11px;color:var(--text-muted);">📅 {{ doc.documentDate }}</div>
                        }
                      </td>
                      <td><span class="badge badge-blue">{{ doc.type }}</span></td>
                      <td>{{ doc._count?.chunks ?? doc.chunkCount }}</td>
                      <td style="font-size:12px;color:var(--text-muted);">{{ doc.createdAt | date:'short' }}</td>
                      <td>
                        <button type="button" class="btn btn-danger btn-sm" (click)="deleteDoc(doc)" [disabled]="deletingId === doc.id">
                          @if (deletingId === doc.id) { … } @else { {{ i18n.t('common.delete') }} }
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>

        <!-- Upload form -->
        <div class="card">
          <div class="card-header"><h3>📤 {{ i18n.t('adminDocs.uploadHeader') }}</h3></div>
          <div class="card-body">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              <button type="button" class="btn btn-sm" [class.btn-primary]="mode === 'file'" [class.btn-secondary]="mode !== 'file'" (click)="mode = 'file'">
                {{ i18n.t('adminDocs.modeFile') }}
              </button>
              <button type="button" class="btn btn-sm" [class.btn-primary]="mode === 'paste'" [class.btn-secondary]="mode !== 'paste'" (click)="mode = 'paste'">
                {{ i18n.t('adminDocs.modePaste') }}
              </button>
            </div>

            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.titleField') }} *</label>
            <input class="form-input" [(ngModel)]="form.title" (ngModelChange)="clearFieldError('title')" placeholder="{{ i18n.t('adminDocs.titlePlaceholder') }}" [class.input-error]="!!getFieldError('title')" style="width:100%;margin-bottom:4px;" />
            @if (getFieldError('title')) { <div class="field-error" style="margin-bottom:8px;">⚠ {{ getFieldError('title') }}</div> }
            @else { <div style="margin-bottom:12px;"></div> }

            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.typeField') }} *</label>
            <select class="form-input" [(ngModel)]="form.type" (ngModelChange)="clearFieldError('type')" [class.input-error]="!!getFieldError('type')" style="width:100%;margin-bottom:4px;">
              <option value="">--</option>
              <option value="ORDINANCE">ORDINANCE</option>
              <option value="DECISION">DECISION</option>
              <option value="REGULATION">REGULATION</option>
              <option value="GUIDE">GUIDE</option>
              <option value="OTHER">OTHER</option>
            </select>
            @if (getFieldError('type')) { <div class="field-error" style="margin-bottom:8px;">⚠ {{ getFieldError('type') }}</div> }
            @else { <div style="margin-bottom:12px;"></div> }

            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.sourceField') }} *</label>
            <input class="form-input" [(ngModel)]="form.source" (ngModelChange)="clearFieldError('source')" placeholder="{{ i18n.t('adminDocs.sourcePlaceholder') }}" [class.input-error]="!!getFieldError('source')" style="width:100%;margin-bottom:4px;" />
            @if (getFieldError('source')) { <div class="field-error" style="margin-bottom:8px;">⚠ {{ getFieldError('source') }}</div> }
            @else { <div style="margin-bottom:12px;"></div> }

            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.dateField') }}</label>
            <input class="form-input" [(ngModel)]="form.documentDate" (ngModelChange)="clearFieldError('documentDate')" placeholder="2026-06-14" [class.input-error]="!!getFieldError('documentDate')" style="width:100%;margin-bottom:12px;" />

            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.descField') }}</label>
            <input class="form-input" [(ngModel)]="form.description" (ngModelChange)="clearFieldError('description')" placeholder="{{ i18n.t('adminDocs.descPlaceholder') }}" [class.input-error]="!!getFieldError('description')" style="width:100%;margin-bottom:12px;" />

            @if (mode === 'file') {
              <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.fileField') }} *</label>
              <input type="file" accept=".pdf,.txt,application/pdf,text/plain" (change)="onFile($event)" class="form-input" [class.input-error]="!!getFieldError('file')" style="width:100%;margin-bottom:4px;" />
              @if (selectedFile) {
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">
                  📎 {{ selectedFile.name }} · {{ (selectedFile.size / 1024).toFixed(1) }} KB
                </div>
              }
              @if (getFieldError('file')) { <div class="field-error" style="margin-bottom:8px;">⚠ {{ getFieldError('file') }}</div> }
              @else { <div style="margin-bottom:12px;"></div> }
            } @else {
              <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">{{ i18n.t('adminDocs.contentField') }} *</label>
              <textarea class="form-input" rows="8" [(ngModel)]="form.content" (ngModelChange)="clearFieldError('content')" placeholder="{{ i18n.t('adminDocs.contentPlaceholder') }}" [class.input-error]="!!getFieldError('content')" style="width:100%;margin-bottom:4px;font-family:monospace;font-size:12px;"></textarea>
              @if (getFieldError('content')) { <div class="field-error" style="margin-bottom:8px;">⚠ {{ getFieldError('content') }}</div> }
              @else { <div style="margin-bottom:12px;"></div> }
            }

            @if (uploadError) {
              <div style="background:#FEE2E2;color:#991B1B;padding:10px 12px;border-radius:var(--radius);font-size:13px;margin-bottom:12px;">
                {{ uploadError }}
              </div>
            }
            @if (uploadSuccess) {
              <div style="background:#D1FAE5;color:#065F46;padding:10px 12px;border-radius:var(--radius);font-size:13px;margin-bottom:12px;">
                {{ uploadSuccess }}
              </div>
            }

            <button type="button" class="btn btn-primary" style="width:100%;" (click)="upload()" [disabled]="uploading">
              @if (uploading) { {{ i18n.t('adminDocs.uploading') }} }
              @else { {{ i18n.t('adminDocs.uploadBtn') }} }
            </button>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    .field-error {
      margin-top: 6px;
      font-size: 12px;
      color: #B91C1C;
      background: #FEF2F2;
      border-left: 3px solid #DC2626;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .input-error {
      border-color: #DC2626 !important;
      background: #FFF5F5;
    }
  `],
})
export class AdminDocumentsPageComponent implements OnInit {
  documents: AdminDocument[] = [];
  loading = false;
  uploading = false;
  deletingId: string | null = null;
  uploadError = '';
  uploadSuccess = '';
  mode: 'file' | 'paste' = 'file';
  selectedFile: File | null = null;

  form = {
    title: '',
    type: '',
    source: '',
    documentDate: '',
    description: '',
    content: '',
  };
  /**
   * Inline field-level errors for the upload form. Populated from
   * the backend's typed errors (ZodError issues + BadRequestError
   * `{field, minLength}` bag). Cleared on each input's
   * `ngModelChange`.
   */
  fieldErrors: Record<string, string> = {};

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/admin' },
    { icon: 'people', label: 'nav.users', route: '/admin/users' },
    { icon: 'apartment', label: 'nav.departments', route: '/admin/departments' },
    { icon: 'map', label: 'nav.wards', route: '/admin/wards' },
    { icon: 'library_books', label: 'nav.documents', route: '/admin/documents' },
    { icon: 'settings', label: 'nav.settings', route: '/admin/settings' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  ngOnInit() { this.reload(); }

  reload() {
    this.loading = true;
    this.api.listDocuments().subscribe({
      next: (res: any) => {
        if (res.success) this.documents = res.data;
        this.loading = false;
      },
      error: (err) => { this.loading = false; this.uploadError = err.error?.error || 'Failed to load documents.'; },
    });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
    if (this.selectedFile && !this.form.title) {
      this.form.title = this.selectedFile.name.replace(/\.[^.]+$/, '');
    }
  }

  upload() {
    this.uploadError = '';
    this.uploadSuccess = '';
    this.fieldErrors = {};
    // Local client-side checks: surface as inline field errors so
    // the user sees the failure next to the offending input.
    if (!this.form.title) this.fieldErrors['title'] = 'Title is required.';
    if (!this.form.type) this.fieldErrors['type'] = 'Type is required.';
    if (!this.form.source) this.fieldErrors['source'] = 'Source is required.';
    if (this.mode === 'file' && !this.selectedFile) {
      this.fieldErrors['file'] = 'Please choose a file to upload.';
    }
    if (this.mode === 'paste' && (!this.form.content || this.form.content.length < 50)) {
      this.fieldErrors['content'] = 'Content must be at least 50 characters.';
    }
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.uploading = true;
    this.api.uploadDocument({
      title: this.form.title,
      type: this.form.type,
      source: this.form.source,
      documentDate: this.form.documentDate || undefined,
      description: this.form.description || undefined,
      file: this.mode === 'file' ? this.selectedFile || undefined : undefined,
      content: this.mode === 'paste' ? this.form.content : undefined,
    }).subscribe({
      next: (res: any) => {
        this.uploading = false;
        this.uploadSuccess = res.message || 'Uploaded.';
        this.resetForm();
        this.reload();
      },
      error: (err) => {
        this.uploading = false;
        const apiErr = toApiError(err);
        const fieldErrs = getFieldErrors(apiErr);
        this.fieldErrors = groupFieldErrorsByField(fieldErrs);
        // Keep the top-of-form banner for any non-field error
        // (unsupported file type, generic 5xx, etc.) so the user
        // doesn't miss a failure when no `details.field` is attached.
        if (fieldErrs.length === 0) {
          this.uploadError = apiErr.message;
        }
      },
    });
  }

  /**
   * Inline field-error accessor used by the template. Tries
   * `errorFields.<field>` first, then falls back to the raw
   * backend message. Returns '' when no error is set.
   */
  getFieldError(field: string): string {
    const raw = this.fieldErrors[field];
    if (!raw) return '';
    const key = `errorFields.${field}` as any;
    const translated = this.i18n.t(key);
    if (translated && translated !== key) return translated;
    return raw;
  }

  /**
   * Drop the inline error for `field` (called from each input's
   * `ngModelChange`).
   */
  clearFieldError(field: string) {
    if (this.fieldErrors[field]) {
      delete this.fieldErrors[field];
    }
  }

  deleteDoc(doc: AdminDocument) {
    if (!confirm(`Delete "${doc.title}"? This removes all ${doc._count?.chunks ?? doc.chunkCount} chunks.`)) return;
    this.deletingId = doc.id;
    this.api.deleteDocument(doc.id).subscribe({
      next: () => { this.deletingId = null; this.reload(); },
      error: (err) => { this.deletingId = null; this.uploadError = err.error?.error || 'Delete failed.'; },
    });
  }

  private resetForm() {
    this.form = { title: '', type: '', source: '', documentDate: '', description: '', content: '' };
    this.selectedFile = null;
  }
}
