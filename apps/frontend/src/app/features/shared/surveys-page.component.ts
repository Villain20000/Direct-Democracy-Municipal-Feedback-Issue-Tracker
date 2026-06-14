import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Survey } from '@dd/shared-types';

@Component({
  selector: 'app-surveys-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('surveys.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }
      @if (success) {
        <div class="card" style="margin-bottom:24px;border-color:var(--success);">
          <div class="card-body" style="color:var(--success);">{{ success }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('surveys.loading') }}</div></div>
      } @else if (selectedSurvey) {
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>📊 {{ selectedSurvey.title }}</h3>
            <button class="btn btn-secondary btn-sm" (click)="selectedSurvey = null">{{ i18n.t('surveys.back') }}</button>
          </div>
          @if (selectedSurvey.description) {
            <div class="card-body" style="padding-bottom:0;font-size:13px;color:var(--text-secondary);">{{ selectedSurvey.description }}</div>
          }
          <div class="card-body">
            @for (q of selectedSurvey.questions || []; track q.id) {
              <div class="form-group">
                <label>{{ q.text }}</label>
                @if (q.type === 'MULTIPLE_CHOICE' && q.options) {
                  <select [(ngModel)]="answers[q.id]" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                    <option value="">{{ i18n.t('surveys.selectOption') }}</option>
                    @for (opt of q.options; track opt) { <option [value]="opt">{{ opt }}</option> }
                  </select>
                } @else if (q.type === 'YES_NO') {
                  <select [(ngModel)]="answers[q.id]" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                    <option value="">{{ i18n.t('surveys.select') }}</option>
                    <option value="yes">{{ i18n.t('surveys.yes') }}</option>
                    <option value="no">{{ i18n.t('surveys.no') }}</option>
                  </select>
                } @else if (q.type === 'RATING') {
                  <select [(ngModel)]="answers[q.id]" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
                    <option value="">{{ i18n.t('surveys.rate15') }}</option>
                    @for (n of [1,2,3,4,5]; track n) { <option [value]="n">{{ n }}</option> }
                  </select>
                } @else {
                  <textarea [(ngModel)]="answers[q.id]" rows="2" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;"></textarea>
                }
              </div>
            }
            <button class="btn btn-primary" (click)="submitResponse()" [disabled]="submitting">{{ i18n.t('surveys.submit') }}</button>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('surveys.activeHeader') }}</h3></div>
          <div class="card-body">
            @for (survey of surveys; track survey.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;cursor:pointer;" (click)="openSurvey(survey.id)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <strong style="font-size:14px;">{{ survey.title }}</strong>
                  <span class="badge" [class]="survey.isActive ? 'badge-green' : 'badge-gray'">{{ i18n.tPollState(survey.isActive) }}</span>
                </div>
                @if (survey.description) {
                  <p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">{{ survey.description }}</p>
                }
                <div style="font-size:11px;color:var(--text-muted);">
                  {{ i18n.t('surveys.statsLine', { n: survey._count?.responses || 0, q: survey.questions?.length || 0 }) }}
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('surveys.noSurveys') }}</div>
            }
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class SurveysPageComponent implements OnInit {
  surveys: Survey[] = [];
  selectedSurvey: Survey | null = null;
  answers: Record<string, string> = {};
  loading = true;
  submitting = false;
  error = '';
  success = '';
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadSurveys(); }

  loadSurveys() {
    this.loading = true;
    this.api.getSurveys({ activeOnly: 'true', pageSize: '50' }).subscribe({
      next: (res: any) => {
        this.surveys = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('surveys.loadFailed');
        this.loading = false;
      },
    });
  }

  openSurvey(id: string) {
    this.answers = {};
    this.api.getSurvey(id).subscribe({
      next: (res) => { this.selectedSurvey = res.data; },
      error: (err) => { this.error = err.error?.error || this.i18n.t('surveys.loadDetailFailed'); },
    });
  }

  submitResponse() {
    if (!this.selectedSurvey) return;
    this.submitting = true;
    this.error = '';
    this.api.submitSurveyResponse(this.selectedSurvey.id, this.answers).subscribe({
      next: () => {
        this.success = this.i18n.t('surveys.thanks');
        this.selectedSurvey = null;
        this.submitting = false;
        this.loadSurveys();
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('surveys.submitFailed');
        this.submitting = false;
      },
    });
  }
}
