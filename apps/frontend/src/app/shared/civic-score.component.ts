import { Component, input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, CivicScoreData } from '../core/services/api.service';
import { TranslationService } from '../core/i18n/translation.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { CountUpDirective } from './count-up.directive';

/**
 * Reusable civic score widget. Shows the user's gamification tier,
 * points (animated count-up), progress to the next tier, and a
 * breakdown of how points were earned.
 *
 * Usage:
 *   <app-civic-score [userId]="auth.user()?.id" />
 *   <app-civic-score [userId]="someUserId" [showBreakdown]="false" />
 *
 * If `userId` is null/undefined the component shows a skeleton loader
 * and does not fire a request until a valid id arrives.
 */
@Component({
  selector: 'app-civic-score',
  standalone: true,
  imports: [CommonModule, TranslatePipe, CountUpDirective],
  template: `
    @if (score()) {
      <div class="civic-score-card">
        <div class="civic-tier-badge"
          [style.background]="score()!.tier.color + '22'"
          [style.color]="score()!.tier.color">
          <i class="material-icons-outlined">{{ score()!.tier.icon }}</i>
          {{ score()!.tier.name }}
        </div>
        <div class="civic-points" [countUp]="score()!.points">0</div>
        <div class="civic-points-label">{{ i18n.t('civicScore.points') }}</div>
        @if (score()!.nextTier) {
          <div class="civic-progress">
            <div class="civic-progress-fill" [style.width.%]="score()!.progressToNext"></div>
          </div>
          <div class="civic-next-tier">
            {{ i18n.t('civicScore.progressToNext', { tier: score()!.nextTier.name }) }}
          </div>
        }
        @if (showBreakdown()) {
          <div class="civic-breakdown">
            <div class="civic-breakdown-item">
              <div class="label">{{ i18n.t('civicScore.issuesReported') }}</div>
              <div class="value">{{ score()!.breakdown.issuesReported.count }}</div>
            </div>
            <div class="civic-breakdown-item">
              <div class="label">{{ i18n.t('civicScore.upvotesReceived') }}</div>
              <div class="value">{{ score()!.breakdown.upvotesReceived.count }}</div>
            </div>
            <div class="civic-breakdown-item">
              <div class="label">{{ i18n.t('civicScore.votesCast') }}</div>
              <div class="value">{{ score()!.breakdown.votesCast.count }}</div>
            </div>
            <div class="civic-breakdown-item">
              <div class="label">{{ i18n.t('civicScore.issuesResolved') }}</div>
              <div class="value">{{ score()!.breakdown.issuesResolved.count }}</div>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="civic-score-card">
        <div class="skeleton skeleton-circle" style="margin:0 auto 12px;"></div>
        <div class="skeleton skeleton-title" style="margin:0 auto 12px;width:120px;height:36px;"></div>
        <div class="skeleton skeleton-text" style="width:40%;margin:0 auto;"></div>
        <div class="skeleton skeleton-block" style="margin-top:16px;height:6px;"></div>
      </div>
    }
  `,
})
export class CivicScoreComponent implements OnInit {
  userId = input<string | null | undefined>(null);
  showBreakdown = input<boolean>(true);

  score = signal<CivicScoreData | null>(null);

  api = inject(ApiService);
  i18n = inject(TranslationService);

  ngOnInit(): void {
    const id = this.userId();
    if (id) {
      this.load(id);
    }
  }

  private load(id: string): void {
    this.api.getCivicScore(id).subscribe({
      next: (res: any) => {
        if (res.success) this.score.set(res.data);
      },
      error: () => { /* leave skeleton on error */ },
    });
  }
}
