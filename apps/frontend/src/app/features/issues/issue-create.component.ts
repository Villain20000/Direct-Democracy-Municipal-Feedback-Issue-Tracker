import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { IssueCategory, IssueTemplate } from '@dd/shared-types';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent],
  template: `
    <app-layout pageTitle="Report New Issue" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) { <div class="error-msg" style="margin-bottom:16px;">{{ error }}</div> }
      @if (aiSuggestion) {
        <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary);">
          <div class="card-body" style="font-size:13px;">
            <strong>AI Suggestion:</strong> Category {{ aiSuggestion.category }} ({{ (aiSuggestion.confidence * 100) | number:'1.0-0' }}% confidence)
          </div>
        </div>
      }

      <div class="card" style="max-width:720px;">
        <div class="card-body">
          <form (ngSubmit)="onSubmit()">
            @if (templates.length) {
              <div class="form-group">
                <label>Use a Template (optional)</label>
                <select (change)="applyTemplate($event)" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                  <option value="">-- Select a template --</option>
                  @for (t of templates; track t.id) { <option [value]="t.id">{{ t.title }}</option> }
                </select>
              </div>
            }
            <div class="form-group">
              <label>Title</label>
              <input type="text" [(ngModel)]="title" name="title" required placeholder="Brief summary of the issue" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="description" name="description" required rows="4" placeholder="Describe the issue in detail" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;resize:vertical;"></textarea>
              <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" (click)="suggestCategory()" [disabled]="!description.trim() || aiLoading">
                @if (aiLoading) { Analyzing... } @else { 🤖 Suggest Category }
              </button>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select [(ngModel)]="category" name="category" required style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
              </select>
            </div>
            <div class="form-group">
              <label>Location</label>
              <input type="text" [(ngModel)]="location" name="location" required placeholder="Street address or landmark" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>Latitude (optional)</label>
                <input type="number" step="any" [(ngModel)]="latitude" name="latitude" placeholder="e.g. 40.7128" />
              </div>
              <div class="form-group">
                <label>Longitude (optional)</label>
                <input type="number" step="any" [(ngModel)]="longitude" name="longitude" placeholder="e.g. -74.0060" />
              </div>
            </div>
            <div class="form-group">
              <label>Photo Attachment (optional)</label>
              <input type="file" accept="image/*,.pdf" (change)="onFileSelect($event)" />
            </div>
            <div style="display:flex;gap:12px;margin-top:8px;">
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                @if (loading) { Submitting... } @else { Submit Issue }
              </button>
              <button type="button" class="btn btn-secondary" routerLink="/issues">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </app-layout>
  `,
})
export class IssueCreateComponent {
  title = '';
  description = '';
  category: IssueCategory = IssueCategory.INFRASTRUCTURE;
  location = '';
  latitude: number | null = null;
  longitude: number | null = null;
  selectedFile: File | null = null;
  loading = false;
  aiLoading = false;
  error = '';
  aiSuggestion: { category: string; confidence: number } | null = null;

  categories = Object.values(IssueCategory);
  templates: IssueTemplate[] = [];
  navItems = [{ icon: 'arrow_back', label: 'Back to Issues', route: '/issues' }];

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {
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
          }
        }
      },
      error: () => { this.aiLoading = false; },
    });
  }

  onSubmit() {
    if (!this.title.trim() || !this.description.trim() || !this.location.trim()) {
      this.error = 'Please fill in all required fields.';
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

    this.api.createIssue(payload as any).subscribe({
      next: (res) => {
        if (!res.success) {
          this.loading = false;
          this.error = 'Failed to create issue.';
          return;
        }
        const issueId = res.data.id;
        if (this.selectedFile) {
          this.api.uploadAttachment(issueId, this.selectedFile).subscribe({
            next: () => this.router.navigate(['/issues', issueId]),
            error: () => this.router.navigate(['/issues', issueId]),
          });
        } else {
          this.loading = false;
          this.router.navigate(['/issues', issueId]);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to create issue. Please try again.';
      },
    });
  }
}