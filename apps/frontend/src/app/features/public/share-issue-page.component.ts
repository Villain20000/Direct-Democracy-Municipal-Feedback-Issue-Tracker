import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus as formatStatusI18n } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-share-issue-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TranslatePipe],
  styles: [`
    .share-page { min-height: 100vh; background: #f8fafc; }
    .share-header { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 24px; }
    .share-header-inner { max-width: 800px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .share-main { max-width: 800px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 24px; }
    .share-cta .btn { background: white; color: #1e3a8a; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; }
    .error-card { color: #b91c1c; }
  `],
  template: `
    <div class="share-page" data-testid="share-issue-page">
      <header class="share-header">
        <div class="share-header-inner">
          <div>
            <h1 style="margin:0;font-size:22px;">{{ 'share.pageTitle' | t }}</h1>
            <p style="margin:4px 0 0;opacity:0.85;font-size:13px;">{{ 'share.subtitle' | t }}</p>
          </div>
          <div class="share-cta">
            <a routerLink="/portal" class="btn">{{ 'share.viewPortal' | t }}</a>
            <a routerLink="/login" class="btn" style="margin-left:8px;">{{ 'share.signIn' | t }}</a>
          </div>
        </div>
      </header>

      <main class="share-main">
        @if (loading) {
          <p style="color:var(--text-muted);text-align:center;padding:48px;">{{ 'common.loading' | t }}</p>
        } @else if (loadError) {
          <div class="card error-card">{{ loadError }}</div>
        } @else if (issue) {
          <div class="card">
            <h2 style="font-size:22px;font-weight:800;margin-bottom:12px;">{{ issue.title }}</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
              <span class="badge badge-blue">{{ i18n.tCategory(issue.category) }}</span>
              <span class="status-badge" [ngClass]="issueStatusClass(issue.status)">{{ formatIssueStatus(issue.status) }}</span>
              <span class="badge badge-slate">▲ {{ issue.upvotes }}</span>
            </div>
            <p style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin-bottom:16px;">{{ issue.description }}</p>
            <div style="display:flex;gap:20px;font-size:13px;color:var(--text-muted);flex-wrap:wrap;">
              <span>📍 {{ issue.location }}</span>
              <span>📅 {{ issue.createdAt | date:'medium' }}</span>
              <span>👁 {{ issue.viewCount }} {{ 'share.views' | t }}</span>
            </div>
          </div>
        }
      </main>
    </div>
  `,
})
export class ShareIssuePageComponent implements OnInit {
  issue: Issue | null = null;
  loading = true;
  loadError = '';

  issueStatusClass = issueStatusClass;
  formatIssueStatus(status: string) { return formatStatusI18n(status, this.i18n); }

  api = inject(ApiService);
  route = inject(ActivatedRoute);
  i18n = inject(TranslationService);

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loadError = this.i18n.t('share.notFound');
      this.loading = false;
      return;
    }
    this.api.resolveShareLink(token).subscribe({
      next: (res) => {
        if (res.success && res.data?.issue) {
          this.issue = res.data.issue;
        } else {
          this.loadError = this.i18n.t('share.notFound');
        }
        this.loading = false;
      },
      error: () => {
        this.loadError = this.i18n.t('share.notFound');
        this.loading = false;
      },
    });
  }
}