import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { getFieldErrors, groupFieldErrorsByField, toApiError } from '../../core/errors/api-error';
import { IssueCategory, IssueTemplate } from '@dd/shared-types';

interface DuplicateMatch {
  id: string;
  title?: string;
  category?: string;
  score: number;
  reason?: string;
}

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, TranslatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('issues.title')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) { <div class="error-msg" style="margin-bottom:16px;">{{ error }}</div> }

      @if (aiSuggestion) {
        <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary);">
          <div class="card-body" style="font-size:13px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:20px;">🤖</span>              <div style="flex:1;">
              <strong>{{ 'issues.aiSuggestion' | t }}</strong>
              {{ 'issues.category' | t }} <strong>{{ i18n.tCategory(aiSuggestion.category) }}</strong>
              ({{ i18n.t('issues.aiConfidence', { pct: ((aiSuggestion.confidence * 100) | number:'1.0-0') }) }})
            </div>
            @if (aiDepartment) {
              <span class="badge badge-purple">📍 {{ aiDepartment.department }} ({{ i18n.t('issues.aiConfidence', { pct: ((aiDepartment.confidence * 100) | number:'1.0-0') }) }})</span>
            }
          </div>
        </div>
      }

      @if (duplicates.length > 0) {
        <div class="card" style="margin-bottom:16px;border-left:4px solid #D97706;background:#FFFBEB;">
          <div class="card-body" style="font-size:13px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:18px;">🔍</span>
              <strong>{{ 'issues.duplicatesFound' | t }}</strong>
            </div>
            <div style="color:var(--text-secondary);margin-bottom:10px;">
              {{ i18n.t('issues.checkDuplicatesDesc', { n: duplicates.length }) }}
            </div>
            @for (dup of duplicates; track dup.id) {
              <a [routerLink]="['/issues', dup.id]" class="duplicate-item">
                <span class="badge badge-amber">{{ i18n.t('issues.matchPct', { pct: (((dup.score || 0) * 100) | number:'1.0-0') }) }}</span>
                <span style="font-weight:600;">{{ dup.title }}</span>
                @if (dup.category) { <span class="badge badge-slate">{{ dup.category }}</span> }
              </a>
            }
          </div>
        </div>
      }

      @if (aiTags.length > 0) {
        <div class="card" style="margin-bottom:16px;">
          <div class="card-body" style="font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:18px;">🏷️</span>
            <strong>{{ 'issues.suggestedTags' | t }}</strong>
            @for (tag of aiTags; track tag) {
              <span class="badge badge-blue">#{{ tag }}</span>
            }
          </div>
        </div>
      }

      <div class="card" style="max-width:760px;">
        <div class="card-body">
          <form (ngSubmit)="onSubmit()">
            @if (templates.length) {
              <div class="form-group">
                <label>{{ 'issues.useTemplate' | t }}</label>
                <select (change)="applyTemplate($event)" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                  <option value="">{{ 'issues.selectTemplate' | t }}</option>
                  @for (t of templates; track t.id) { <option [value]="t.id">{{ t.title }}</option> }
                </select>
              </div>
            }
            <div class="form-group">
              <label>{{ 'issues.titleField' | t }}</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" [(ngModel)]="title" (ngModelChange)="clearFieldError('title')" name="title" required [placeholder]="i18n.t('issues.briefSummary')" [class.input-error]="!!getFieldError('title')" style="flex:1;" />
                <button type="button" class="btn btn-secondary btn-sm" (click)="generateDescription()" [disabled]="!title.trim() || descLoading" [title]="i18n.t('issues.autoDescribe')">
                  @if (descLoading) { {{ 'issues.writing' | t }} } @else { {{ 'issues.autoDescribe' | t }} }
                </button>
              </div>
              @if (getFieldError('title')) { <div class="field-error">⚠ {{ getFieldError('title') }}</div> }
            </div>
            <div class="form-group">
              <label>{{ 'issues.description' | t }}</label>
              <textarea
                [ngModel]="description"
                (ngModelChange)="onDescriptionChange($event)"
                name="description"
                required
                rows="4"
                [placeholder]="i18n.t('issues.describeDetail')"
                [class.input-error]="!!getFieldError('description')"
                style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"
              ></textarea>
              @if (getFieldError('description')) { <div class="field-error">⚠ {{ getFieldError('description') }}</div> }
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" (click)="suggestCategory()" [disabled]="!description.trim() || aiLoading">
                  @if (aiLoading) { {{ 'issues.analyzing' | t }} } @else { {{ 'issues.suggestCategory' | t }} }
                </button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="checkDuplicates()" [disabled]="!description.trim() || dupLoading">
                  @if (dupLoading) { {{ 'issues.checking' | t }} } @else { {{ 'issues.checkDuplicates' | t }} }
                </button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="extractTags()" [disabled]="!description.trim() || tagLoading">
                  @if (tagLoading) { {{ 'issues.extracting' | t }} } @else { {{ 'issues.suggestTags' | t }} }
                </button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="suggestDepartment()" [disabled]="!description.trim() || deptLoading">
                  @if (deptLoading) { {{ 'issues.checking' | t }} } @else { {{ 'issues.suggestDepartment' | t }} }
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'issues.category' | t }}</label>
              <select
                [ngModel]="category"
                (ngModelChange)="onCategoryChange($event)"
                name="category"
                required
                [class.input-error]="!!getFieldError('category')"
                style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;"
              >
                @for (c of categories; track c) { <option [value]="c">{{ i18n.tCategory(c) }}</option> }
              </select>
              @if (getFieldError('category')) { <div class="field-error">⚠ {{ getFieldError('category') }}</div> }
            </div>
            <div class="form-group">
              <label>{{ 'issues.location' | t }}</label>
              <input type="text" [(ngModel)]="location" (ngModelChange)="clearFieldError('location')" name="location" required [placeholder]="i18n.t('issues.streetPlaceholder')" [class.input-error]="!!getFieldError('location')" />
              @if (getFieldError('location')) { <div class="field-error">⚠ {{ getFieldError('location') }}</div> }
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>{{ 'issues.latitude' | t }}</label>
                <input type="number" step="any" [(ngModel)]="latitude" (ngModelChange)="clearFieldError('latitude')" name="latitude" [placeholder]="i18n.t('issues.latPlaceholder')" [class.input-error]="!!getFieldError('latitude')" />
                @if (getFieldError('latitude')) { <div class="field-error">⚠ {{ getFieldError('latitude') }}</div> }
              </div>
              <div class="form-group">
                <label>{{ 'issues.longitude' | t }}</label>
                <input type="number" step="any" [(ngModel)]="longitude" (ngModelChange)="clearFieldError('longitude')" name="longitude" [placeholder]="i18n.t('issues.lngPlaceholder')" [class.input-error]="!!getFieldError('longitude')" />
                @if (getFieldError('longitude')) { <div class="field-error">⚠ {{ getFieldError('longitude') }}</div> }
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'issues.photo' | t }}</label>
              <input type="file" accept="image/*,.pdf" (change)="onFileSelect($event)" />
              @if (photoAnalyzing) {
                <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">{{ 'issues.photoAnalyzing' | t }}</p>
              }
            </div>
            <div class="form-group">
              <label>{{ 'issues.voiceInput' | t }}</label>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" (click)="toggleVoiceRecording()" [disabled]="transcribing">
                  @if (recording) { ⏹ {{ 'issues.stopRecording' | t }} } @else { 🎤 {{ 'issues.startRecording' | t }} }
                </button>
                @if (transcribing) {
                  <span style="font-size:12px;color:var(--text-muted);">{{ 'issues.transcribing' | t }}</span>
                }
              </div>
            </div>
            <div class="form-group" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <label style="margin:0;">{{ 'issues.translateTo' | t }}</label>
              <select [(ngModel)]="translateLanguage" name="translateLanguage" (change)="translateDescription()" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                <option value="">{{ 'common.none' | t }}</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                <option value="Vietnamese">Vietnamese</option>
                <option value="Arabic">Arabic</option>
                <option value="Korean">Korean</option>
                <option value="Greek">Greek</option>
                <option value="English">English</option>
              </select>
              @if (translatedDescription) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="clearTranslation()">{{ 'issues.restoreOriginal' | t }}</button>
              }
            </div>
            @if (translatedDescription) {
              <div class="form-group">
                <label>{{ i18n.t('issues.translatedDescription', { lang: translateLanguage }) }}</label>
                <textarea [(ngModel)]="translatedDescription" name="translatedDescription" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;background:#F0F9FF;"></textarea>
              </div>
            }
            <div style="display:flex;gap:12px;margin-top:8px;">
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                @if (loading) { {{ 'issues.submitting' | t }} } @else { {{ 'issues.submitIssue' | t }} }
              </button>
              <button type="button" class="btn btn-secondary" routerLink="/issues">{{ 'common.cancel' | t }}</button>
            </div>
          </form>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    .duplicate-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      margin-top: 6px;
      background: white;
      border: 1px solid #FDE68A;
      border-radius: var(--radius);
      text-decoration: none;
      color: inherit;
      transition: background 0.2s, transform 0.1s;
    }
    .duplicate-item:hover {
      background: #FEF3C7;
      transform: translateX(2px);
    }
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
export class IssueCreateComponent implements OnInit, OnDestroy {
  title = '';
  description = '';
  category: IssueCategory = IssueCategory.INFRASTRUCTURE;
  location = '';
  latitude: number | null = null;
  longitude: number | null = null;
  selectedFile: File | null = null;
  loading = false;
  error = '';
  /**
   * Inline field-level errors populated from the backend's
   * ZodError / BadRequestError `details` bag. Cleared on next submit
   * or when the user edits the field. Forms can read a single field's
   * error via `getFieldError(name)`.
   */
  fieldErrors: Record<string, string> = {};

  // AI state
  aiLoading = false;
  aiSuggestion: { category: string; confidence: number } | null = null;
  aiDepartment: { department: string; confidence: number } | null = null;
  aiTags: string[] = [];
  duplicates: DuplicateMatch[] = [];
  descLoading = false;
  dupLoading = false;
  tagLoading = false;
  deptLoading = false;
  translateLanguage = '';
  translatedDescription = '';
  private originalDescription = '';
  photoAnalyzing = false;
  recording = false;
  transcribing = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  /** RxJS subjects for real-time AI assist (debounced as user types). */
  private readonly descInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private lastAutoChecked = '';
  private candidatesCache: Array<{ id: string; title: string; description: string; category: string }> = [];
  private candidatesLoadedAt = 0;
  private candidatesLoading: Promise<typeof this.candidatesCache> | null = null;

  /**
   * Tracks whether the user has manually interacted with the category
   * `<select>`. Once true, the real-time AI assist will never overwrite
   * their deliberate choice.
   */
  private userTouchedCategory = false;

  categories = Object.values(IssueCategory);
  templates: IssueTemplate[] = [];
  navItems = [{ icon: 'arrow_back', label: 'nav.backToIssues', route: '/issues' }] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  offlineQueue = inject(OfflineQueueService);
  toast = inject(ToastService);
  router = inject(Router);
  i18n = inject(TranslationService);

  ngOnInit() {
    this.api.getIssueTemplates().subscribe({
      next: (res) => { if (res.success) this.templates = res.data; },
    });

    // Real-time AI assist pipeline: when the user pauses typing for 800ms,
    // we automatically run duplicate detection, category suggestion, and
    // department suggestion. The first call uses title+description; once we
    // detect duplicates we fetch a one-time snapshot of recent issues to use
    // as candidates for the dedup endpoint.
    this.descInput$
      .pipe(
        debounceTime(800),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((text) => this.runAutoAssist(text));
  }

  ngOnDestroy() {
    this.stopRecording();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private aiLocale(): string {
    return this.i18n.current();
  }

  /**
   * Called by the template (ngModelChange) so the debounce pipeline
   * fires as the citizen types, not only when they click a button.
   */
  onDescriptionChange(value: string) {
    this.description = value;
    // User is editing the description — drop any inline error we showed
    // for it on the previous failed submit.
    this.clearFieldError('description');
    if (!value || value.trim().length < 15) {
      // Not enough signal yet — clear stale results.
      this.duplicates = [];
      this.aiSuggestion = null;
      this.aiDepartment = null;
      return;
    }
    this.descInput$.next(value);
  }

  /**
   * Inline field-error accessor used by the template. Returns the
   * translated message for `field` (or empty string when none).
   *
   * Lookup order:
   *   1. `errorFields.<rawField>` (e.g. `errorFields.title`)
   *   2. `errorFields.<zodCode>` (e.g. `errorFields.too_small`) if the
   *      server-attached meta has a Zod `code`
   *   3. The raw backend message
   *
   * This lets the form display "Password must be at least 8
   * characters" in Greek when running in el mode, even though the
   * backend's ZodError was English.
   */
  getFieldError(field: string): string {
    const raw = this.fieldErrors[field];
    if (!raw) return '';
    const rawKey = `errorFields.${field}` as any;
    const translatedRaw = this.i18n.t(rawKey);
    if (translatedRaw && translatedRaw !== rawKey) return translatedRaw;
    // Fall back to the backend's verbatim message — still better than
    // blank, and useful for fields we haven't added explicit i18n for.
    return raw;
  }

  /**
   * Drop the inline error for `field` (called from each input's
   * `ngModelChange`). The form-level `error` is left alone so any
   * cross-field error message remains visible.
   */
  clearFieldError(field: string) {
    if (this.fieldErrors[field]) {
      delete this.fieldErrors[field];
    }
  }

  private runAutoAssist(text: string) {
    if (!text || text.trim().length < 15) return;
    const combined = `${this.title}. ${text}`.trim();
    this.lastAutoChecked = combined;

    // Kick off categorization & department in parallel (no candidates needed).
    this.api.aiCategorize(combined, this.aiLocale()).subscribe({
      next: (res: any) => {
        if (this.lastAutoChecked !== combined) return;
        if (res.success && res.data?.category) {
          this.aiSuggestion = res.data;
          // Auto-apply only if the user hasn't picked one yet (don't fight
          // a deliberate choice) and confidence is reasonable.
          if (!this.userTouchedCategory &&
              this.categories.includes(res.data.category) &&
              res.data.confidence >= 0.55) {
            this.category = res.data.category;
          }
        }
      },
      error: () => { /* silently degrade — button fallback still works */ },
    });

    this.api.aiSuggestDepartment(combined, this.category).subscribe({
      next: (res: any) => {
        if (this.lastAutoChecked !== combined) return;
        if (res.success && res.data?.department) {
          this.aiDepartment = res.data;
        }
      },
      error: () => { /* silently degrade */ },
    });

    // Duplicate detection needs a list of recent issues. We cache the list
    // for 60 seconds so the user gets instant checks while still typing.
    this.ensureCandidates().then((candidates) => {
      if (this.lastAutoChecked !== combined) return; // user typed more
      this.api.aiDuplicates(combined, candidates).subscribe({
        next: (res: any) => {
          if (this.lastAutoChecked !== combined) return; // stale
          if (res.success && Array.isArray(res.data?.matches)) {
            this.duplicates = res.data.matches.filter(
              (m: DuplicateMatch) => (m.score || 0) >= 0.35,
            );
          }
        },
        error: () => { /* silently degrade */ },
      });
    });
  }

  private ensureCandidates(): Promise<typeof this.candidatesCache> {
    const now = Date.now();
    if (this.candidatesCache.length && now - this.candidatesLoadedAt < 60_000) {
      return Promise.resolve(this.candidatesCache);
    }
    // If a fetch is already in flight, share the same promise so all
    // concurrent callers wait for the same result instead of returning [].
    if (this.candidatesLoading) return this.candidatesLoading;
    this.candidatesLoading = new Promise((resolve) => {
      // Pull from all open-ish states (anything that could be a real duplicate
      // of a fresh report) so we don't miss matches against in-progress ones.
      this.api.getIssues({ pageSize: '30' }).subscribe({
        next: (issueRes: any) => {
          this.candidatesCache = (issueRes.data || []).map((i: any) => ({
            id: i.id, title: i.title, description: i.description, category: i.category,
          }));
          this.candidatesLoadedAt = Date.now();
          this.candidatesLoading = null;
          resolve(this.candidatesCache);
        },
        error: () => {
          this.candidatesLoading = null;
          resolve(this.candidatesCache);
        },
      });
    });
    return this.candidatesLoading;
  }

  /**
   * Marks the category as user-touched so the real-time AI assist stops
   * auto-overwriting it.
   */
  onCategoryChange(value: IssueCategory) {
    this.category = value;
    this.userTouchedCategory = true;
  }

  applyTemplate(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    const template = this.templates.find(t => t.id === id);
    if (!template) return;
    this.title = template.title;
    this.description = template.description;
    if (this.categories.includes(template.category as IssueCategory)) {
      this.category = template.category as IssueCategory;
    }
    if (template.location) this.location = template.location;
    // A template is a deliberate choice — lock the category from AI override.
    this.userTouchedCategory = true;
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedFile = file;
    if (file?.type.startsWith('image/')) {
      this.analyzePhoto(file);
    }
  }

  analyzePhoto(file: File) {
    this.photoAnalyzing = true;
    this.api.aiDescribeImage(file, this.aiLocale()).subscribe({
      next: (res) => {
        this.photoAnalyzing = false;
        if (res.success && res.data) {
          if (!this.title.trim() && res.data.title) this.title = res.data.title;
          if (!this.description.trim() && res.data.description) {
            this.description = res.data.description;
            this.onDescriptionChange(this.description);
          } else if (res.data.description) {
            this.description = `${this.description.trim()}\n\n${res.data.description}`.trim();
            this.onDescriptionChange(this.description);
          }
          this.toast.success(this.i18n.t('issues.photoAnalyzed'));
        }
      },
      error: () => {
        this.photoAnalyzing = false;
        this.toast.warning(this.i18n.t('issues.photoAnalyzeFailed'));
      },
    });
  }

  async toggleVoiceRecording() {
    if (this.recording) {
      this.stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.toast.error(this.i18n.t('issues.voiceUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        if (blob.size > 0) this.transcribeAudio(blob);
      };
      this.mediaRecorder.start();
      this.recording = true;
    } catch {
      this.toast.error(this.i18n.t('issues.voiceUnavailable'));
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.recording) {
      this.mediaRecorder.stop();
      this.recording = false;
    }
  }

  transcribeAudio(blob: Blob) {
    this.transcribing = true;
    this.api.aiTranscribe(blob, this.aiLocale()).subscribe({
      next: (res) => {
        this.transcribing = false;
        if (res.success && res.data?.transcript) {
          const text = res.data.transcript.trim();
          this.description = this.description.trim() ? `${this.description.trim()}\n${text}` : text;
          this.onDescriptionChange(this.description);
          this.toast.success(this.i18n.t('issues.voiceTranscribed'));
        }
      },
      error: () => {
        this.transcribing = false;
        this.toast.error(this.i18n.t('issues.voiceTranscribeFailed'));
      },
    });
  }

  suggestCategory() {
    if (!this.description.trim()) return;
    this.aiLoading = true;
    this.api.aiCategorize(this.description, this.aiLocale()).subscribe({
      next: (res: any) => {
        this.aiLoading = false;
        if (res.success && res.data) {
          this.aiSuggestion = res.data;
          if (this.categories.includes(res.data.category)) {
            this.category = res.data.category;
            this.toast.success(this.i18n.t('ai.suggestCategoryApplied', { category: res.data.category }));
          }
        }
      },
      error: () => {
        this.aiLoading = false;
        this.toast.error(this.i18n.t('issues.aiCategorize'));
      },
    });
  }

  generateDescription() {
    if (!this.title.trim()) return;
    this.descLoading = true;
    this.api.aiGenerateDescription(this.title, this.category).subscribe({
      next: (res: any) => {
        this.descLoading = false;
        if (res.success && res.data?.description) {
          this.description = res.data.description;
          this.toast.success(this.i18n.t('ai.descriptionGenerated'));
        }
      },
      error: () => {
        this.descLoading = false;
        this.toast.error(this.i18n.t('issues.autoDescribeFailed'));
      },
    });
  }

  checkDuplicates() {
    // Manual trigger: forces a refresh of the candidates and an immediate
    // dedup pass, bypassing the debounce delay.
    if (!this.description.trim()) return;
    this.dupLoading = true;
    this.candidatesLoadedAt = 0; // force a refresh
    this.ensureCandidates().then((issues) => {
      this.api.aiDuplicates(`${this.title}. ${this.description}`, issues).subscribe({
        next: (res: any) => {
          this.dupLoading = false;
          if (res.success && res.data?.matches) {
            this.duplicates = res.data.matches;
            if (this.duplicates.length > 0) {
              this.toast.warning(this.i18n.t('issues.duplicatesFoundToast', { n: this.duplicates.length }));
            } else {
              this.toast.info(this.i18n.t('issues.noDuplicates'));
            }
          }
        },
        error: () => {
          this.dupLoading = false;
          this.toast.error(this.i18n.t('issues.duplicateUnavailable'));
        },
      });
    });
  }

  extractTags() {
    if (!this.description.trim()) return;
    this.tagLoading = true;
    this.api.aiExtractTags(`${this.title}. ${this.description}`).subscribe({
      next: (res: any) => {
        this.tagLoading = false;
        if (res.success && res.data?.tags) {
          this.aiTags = res.data.tags;
          this.toast.success(this.i18n.t('ai.tagsExtracted', { n: this.aiTags.length }));
        }
      },
      error: () => {
        this.tagLoading = false;
        this.toast.error(this.i18n.t('issues.tagFailed'));
      },
    });
  }

  suggestDepartment() {
    if (!this.description.trim()) return;
    this.deptLoading = true;
    this.api.aiSuggestDepartment(`${this.title}. ${this.description}`, this.category).subscribe({
      next: (res: any) => {
        this.deptLoading = false;
        if (res.success && res.data) {
          this.aiDepartment = res.data;
          this.toast.info(this.i18n.t('ai.bestDepartment', { dept: res.data.department }));
        }
      },
      error: () => {
        this.deptLoading = false;
        this.toast.error(this.i18n.t('issues.deptFailed'));
      },
    });
  }

  translateDescription() {
    if (!this.translateLanguage) {
      this.clearTranslation();
      return;
    }
    if (!this.description.trim()) {
      this.toast.warning(this.i18n.t('issues.enterDescFirst'));
      return;
    }
    if (!this.originalDescription) {
      this.originalDescription = this.description;
    }
    this.api.aiTranslate(this.description, this.translateLanguage).subscribe({
      next: (res: any) => {
        if (res.success && res.data?.translation) {
          this.translatedDescription = res.data.translation;
          this.toast.success(this.i18n.t('ai.translatedTo', { lang: this.translateLanguage }));
        }
      },
      error: () => {
        this.toast.error(this.i18n.t('issues.translationFailed'));
      },
    });
  }

  clearTranslation() {
    if (this.originalDescription) {
      this.description = this.originalDescription;
    }
    this.translatedDescription = '';
    this.translateLanguage = '';
    this.originalDescription = '';
  }

  onSubmit() {
    if (!this.title.trim() || !this.description.trim() || !this.location.trim()) {
      this.error = this.i18n.t('issues.titleRequired');
      this.toast.warning(this.i18n.t('issues.titleRequired'));
      return;
    }

    this.loading = true;
    this.error = '';
    this.fieldErrors = {};

    const payload: Record<string, unknown> = {
      title: this.title.trim(),
      description: this.description.trim(),
      category: this.category,
      location: this.location.trim(),
    };
    if (this.latitude != null) payload['latitude'] = this.latitude;
    if (this.longitude != null) payload['longitude'] = this.longitude;
    if (this.aiTags.length) payload['tags'] = this.aiTags;

    this.api.createIssue(payload as any).subscribe({
      next: (res) => {
        if (!res.success) {
          this.loading = false;
          this.error = this.i18n.t('issues.createFailed');
          this.toast.error(this.i18n.t('issues.issueCreatedFailed'));
          return;
        }
        this.toast.success(this.i18n.t('toast.issueSubmitted'), this.i18n.t('app.name'));
        const issueId = res.data.id;
        if (this.selectedFile) {
          this.api.uploadAttachment(issueId, this.selectedFile).subscribe({
            next: () => {
              this.toast.success(this.i18n.t('toast.photoUploaded'));
              this.router.navigate(['/issues', issueId]);
            },
            error: () => {
              this.toast.warning(this.i18n.t('toast.photoFailed'));
              this.router.navigate(['/issues', issueId]);
            },
          });
        } else {
          this.loading = false;
          this.router.navigate(['/issues', issueId]);
        }
      },
      error: (err) => {
        const status = err?.status ?? 0;
        const isOffline = status === 0 || status === 503 || !navigator.onLine;
        if (isOffline) {
          const queuePayload = {
            title: this.title.trim(),
            description: this.description.trim(),
            category: this.category,
            location: this.location.trim(),
            ...(this.latitude != null ? { latitude: this.latitude } : {}),
            ...(this.longitude != null ? { longitude: this.longitude } : {}),
            ...(this.aiTags.length ? { tags: this.aiTags } : {}),
          };
          this.offlineQueue.enqueue(queuePayload, this.selectedFile || undefined)
            .then(() => {
              this.loading = false;
              this.toast.info(this.i18n.t('issues.savedOffline'));
              this.router.navigate(['/issues']);
            })
            .catch(() => {
              this.loading = false;
              this.error = this.i18n.t('issues.issueCreatedFailed');
              this.toast.error(this.error);
            });
          return;
        }
        this.loading = false;
        const apiErr = toApiError(err);
        const fieldErrs = getFieldErrors(apiErr);
        this.fieldErrors = groupFieldErrorsByField(fieldErrs);
        if (fieldErrs.length === 0) {
          this.error = this.i18n.t('issues.issueCreatedFailed');
          this.toast.error(this.error);
        } else {
          this.toast.warning(this.i18n.t('errorCodes.VALIDATION_FAILED'));
        }
      },
    });
  }
}
