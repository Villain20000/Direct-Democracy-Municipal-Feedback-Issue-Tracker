import { Component, input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, ActivityFeedItem } from '../core/services/api.service';
import { TranslationService } from '../core/i18n/translation.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { SkeletonComponent } from './skeleton.component';

/**
 * Vertical timeline of recent platform activity (issues filed, status
 * changes, upvotes, comments). Backed by GET /api/v1/activity.
 *
 * Inputs:
 *   limit  - max items (default 8)
 *   scope  - 'all' | 'me' (default 'all')
 *   showHeader - whether to render the card header (default true)
 */
@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, TranslatePipe, SkeletonComponent],
  template: `
    <div class="card">
      @if (showHeader()) {
        <div class="card-header">
          <h3>{{ i18n.t('activity.title') }}</h3>
          <div class="card-actions">
            <button class="btn btn-ghost btn-sm" (click)="reload()" [title]="i18n.t('common.search')">
              <i class="material-icons-outlined" style="font-size:16px;">refresh</i>
            </button>
          </div>
        </div>
      }
      <div class="card-body">
        @if (loading()) {
          <div class="activity-feed">
            @for (s of skeletons; track $index) {
              <div style="display:flex;gap:12px;padding:12px 0;">
                <app-skeleton variant="circle" />
                <div style="flex:1;">
                  <div class="skeleton skeleton-text" style="width:50%;"></div>
                  <div class="skeleton skeleton-text" style="width:80%;"></div>
                </div>
              </div>
            }
          </div>
        } @else if (items().length === 0) {
          <div class="empty-state">
            <i class="material-icons-outlined">inbox</i>
            <p>{{ i18n.t('activity.empty') }}</p>
          </div>
        } @else {
          <div class="activity-feed">
            @for (item of items(); track item.id) {
              <div class="activity-item">
                <div class="activity-icon" [ngClass]="item.type">
                  <i class="material-icons-outlined">{{ iconFor(item.type) }}</i>
                </div>
                <div class="activity-body">
                  <div class="activity-actor">{{ item.actorName }}</div>
                  <div class="activity-action">
                    {{ actionLabel(item.type) }}
                    @if (item.issueTitle) {
                      <span class="activity-target" (click)="openIssue(item.issueId!)">{{ item.issueTitle }}</span>
                    }
                  </div>
                  <div class="activity-time">{{ item.createdAt | date:'short' }}</div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ActivityFeedComponent implements OnInit {
  limit = input<number>(8);
  scope = input<'all' | 'me'>('all');
  showHeader = input<boolean>(true);

  loading = signal(true);
  items = signal<ActivityFeedItem[]>([]);
  skeletons = new Array(5);

  api = inject(ApiService);
  i18n = inject(TranslationService);
  private router = inject(Router);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getActivityFeed({ limit: this.limit(), scope: this.scope() }).subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  iconFor(type: ActivityFeedItem['type']): string {
    switch (type) {
      case 'issue_created': return 'add_circle';
      case 'status_changed': return 'swap_horiz';
      case 'upvote': return 'arrow_upward';
      case 'comment': return 'chat_bubble_outline';
      default: return 'circle';
    }
  }

  actionLabel(type: ActivityFeedItem['type']): string {
    return this.i18n.t(`activity.${type === 'issue_created' ? 'issueCreated' : type === 'status_changed' ? 'statusChanged' : type === 'upvote' ? 'upvote' : 'comment'}`);
  }

  openIssue(issueId: string): void {
    this.router.navigate(['/issues', issueId]);
  }
}
