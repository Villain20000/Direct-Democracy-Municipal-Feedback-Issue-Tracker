import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
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
                <input type="text" [(ngModel)]="title" name="title" required [placeholder]="i18n.t('issues.briefSummary')" style="flex:1;" />
                <button type="button" class="btn btn-secondary btn-sm" (click)="generateDescription()" [disabled]="!title.trim() || descLoading" [title]="i18n.t('issues.autoDescribe')">
                  @if (descLoading) { {{ 'issues.writing' | t }} } @else { {{ 'issues.autoDescribe' | t }} }
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'issues.description' | t }}</label>
              <textarea [(ngModel)]="description" name="description" required rows="4" [placeholder]="i18n.t('issues.describeDetail')" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
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
              <select [(ngModel)]="category" name="category" required style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                @for (c of categories; track c) { <option [value]="c">{{ i18n.tCategory(c) }}</option> }
              </select>
            </div>
            <div class="form-group">
              <label>{{ 'issues.location' | t }}</label>
              <input type="text" [(ngModel)]="location" name="location" required [placeholder]="i18n.t('issues.streetPlaceholder')" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>{{ 'issues.latitude' | t }}</label>
                <input type="number" step="any" [(ngModel)]="latitude" name="latitude" [placeholder]="i18n.t('issues.latPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ 'issues.longitude' | t }}</label>
                <input type="number" step="any" [(ngModel)]="longitude" name="longitude" [placeholder]="i18n.t('issues.lngPlaceholder')" />
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'issues.photo' | t }}</label>
              <input type="file" accept="image/*,.pdf" (change)="onFileSelect($event)" />
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
  `],
})
export class IssueCreateComponent implements OnInit {
  title = '';
  description = '';
  category: IssueCategory = IssueCategory.INFRASTRUCTURE;
  location = '';
  latitude: number | null = null;
  longitude: number | null = null;
  selectedFile: File | null = null;
  loading = false;
  error = '';

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

  categories = Object.values(IssueCategory);
  templates: IssueTemplate[] = [];
  navItems = [{ icon: 'arrow_back', label: 'nav.backToIssues', route: '/issues' }] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  router = inject(Router);
  i18n = inject(TranslationService);

  ngOnInit() {
    this.api.getIssueTemplates().subscribe({
      next: (res) => { if (res.success) this.templates = res.data; },
    });
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
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  suggestCategory() {
    if (!this.description.trim()) return;
    this.aiLoading = true;
    this.api.aiCategorize(this.description).subscribe({
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
    if (!this.description.trim()) return;
    this.dupLoading = true;
    this.api.getIssues({ pageSize: '30', status: 'SUBMITTED' }).subscribe({
      next: (issueRes: any) => {
        const issues = (issueRes.data || []).map((i: any) => ({
          id: i.id, title: i.title, description: i.description, category: i.category,
        }));
        this.api.aiDuplicates(`${this.title}. ${this.description}`, issues).subscribe({
          next: (res: any) => {
            this.dupLoading = false;
            if (res.success && res.data?.matches) {
              this.duplicates = res.data.matches;
              if (this.duplicates.length > 0) {
                this.toast.warning(this.i18n.t('ai.tagsExtracted', { n: this.duplicates.length }));
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
      },
      error: () => {
        this.dupLoading = false;
        this.toast.error(this.i18n.t('issues.duplicateUnavailable'));
      },
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
        this.loading = false;
        this.error = err.error?.error || this.i18n.t('issues.issueCreatedFailed');
        this.toast.error(this.error);
      },
    });
  }
}
