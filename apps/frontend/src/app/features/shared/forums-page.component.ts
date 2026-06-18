import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Forum, ForumPost, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-forums-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('forums.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
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

      @if (canCreateForum) {
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header"><h3>{{ i18n.t('forums.startDiscussion') }}</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>{{ i18n.t('forums.topicTitle') }}</label>
              <input type="text" [(ngModel)]="newTitle" [placeholder]="i18n.t('forums.topicPlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ i18n.t('forums.descriptionField') }}</label>
              <textarea [(ngModel)]="newDescription" rows="2" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;"></textarea>
            </div>
            <button class="btn btn-primary btn-sm" (click)="createForum()" [disabled]="!newTitle.trim() || creating">{{ i18n.t('forums.createBtn') }}</button>
          </div>
        </div>
      }

      @if (canModerate && flaggedPosts.length) {
        <div class="card" style="margin-bottom:24px;border-left:4px solid var(--danger);" data-testid="flagged-posts">
          <div class="card-header"><h3>{{ i18n.t('forums.flaggedTitle') }}</h3></div>
          <div class="card-body">
            @for (post of flaggedPosts; track post.id) {
              <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <strong style="font-size:13px;">{{ post.forum?.title }}</strong>
                  <span class="badge badge-red">{{ post.moderationSeverity || 'flagged' }}</span>
                </div>
                <p style="font-size:13px;margin:0 0 6px;">{{ post.content }}</p>
                <p style="font-size:12px;color:var(--text-muted);">{{ post.moderationReason }}</p>
              </div>
            }
          </div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('forums.loading') }}</div></div>
      } @else if (selectedForum) {
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>💬 {{ selectedForum.title }}</h3>
            <button class="btn btn-secondary btn-sm" (click)="selectedForum = null">{{ i18n.t('forums.back') }}</button>
          </div>
          @if (selectedForum.description) {
            <div class="card-body" style="padding-bottom:0;font-size:13px;color:var(--text-secondary);">{{ selectedForum.description }}</div>
          }
          <div class="card-body">
            @for (post of selectedForum.posts || []; track post.id) {
              <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <strong style="font-size:13px;">{{ post.author?.firstName }} {{ post.author?.lastName }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ post.createdAt | date:'medium' }}</span>
                </div>
                <p style="font-size:13px;margin:0;">{{ post.content }}</p>
              </div>
            } @empty {
              <div style="text-align:center;padding:24px;color:var(--text-muted);">{{ i18n.t('forums.noPostsYet') }}</div>
            }
            <div style="margin-top:16px;">
              <textarea [(ngModel)]="newPost" rows="3" [placeholder]="i18n.t('forums.replyPlaceholder')" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:8px;"></textarea>
              <button class="btn btn-primary btn-sm" (click)="submitPost()" [disabled]="!newPost.trim() || posting">{{ i18n.t('forums.postReply') }}</button>
            </div>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('forums.header') }}</h3></div>
          <div class="card-body">
            @for (forum of forums; track forum.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;cursor:pointer;" (click)="openForum(forum.id)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <strong style="font-size:14px;">{{ forum.title }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ forum.updatedAt | date:'medium' }}</span>
                </div>
                @if (forum.description) {
                  <p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">{{ forum.description }}</p>
                }
                <div style="font-size:11px;color:var(--text-muted);">
                  {{ i18n.t('forums.postsCount', { n: forum._count?.posts || 0 }) }}
                  @if (forum.creator) { · {{ i18n.t('forums.startedBy', { name: forum.creator.firstName + ' ' + forum.creator.lastName }) }} }
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('forums.noForums') }}</div>
            }
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class ForumsPageComponent implements OnInit {
  forums: Forum[] = [];
  selectedForum: Forum | null = null;
  loading = true;
  error = '';
  success = '';
  newTitle = '';
  newDescription = '';
  newPost = '';
  creating = false;
  posting = false;
  canCreateForum = false;
  canModerate = false;
  flaggedPosts: any[] = [];
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
    this.canCreateForum = auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.COUNCIL_MEMBER, UserRole.WARD_REP);
    this.canModerate = auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.COUNCIL_MEMBER);
  }

  ngOnInit() {
    this.loadForums();
    if (this.canModerate) this.loadFlaggedPosts();
  }

  loadFlaggedPosts() {
    this.api.getFlaggedForumPosts().subscribe({
      next: (res) => { this.flaggedPosts = res.data || []; },
    });
  }

  loadForums() {
    this.loading = true;
    this.error = '';
    this.api.getForums({ pageSize: '50' }).subscribe({
      next: (res: any) => {
        this.forums = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('forums.loadFailed');
        this.loading = false;
      },
    });
  }

  openForum(id: string) {
    this.api.getForum(id).subscribe({
      next: (res) => { this.selectedForum = res.data; },
      error: (err) => { this.error = err.error?.error || this.i18n.t('forums.loadFailed'); },
    });
  }

  createForum() {
    if (!this.newTitle.trim()) return;
    this.creating = true;
    this.api.createForum({ title: this.newTitle.trim(), description: this.newDescription.trim() || undefined }).subscribe({
      next: () => {
        this.newTitle = '';
        this.newDescription = '';
        this.creating = false;
        this.success = this.i18n.t('forums.created');
        this.loadForums();
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('forums.createFailed');
        this.creating = false;
      },
    });
  }

  submitPost() {
    if (!this.selectedForum || !this.newPost.trim()) return;
    this.posting = true;
    this.api.addForumPost(this.selectedForum.id, this.newPost.trim()).subscribe({
      next: (res) => {
        this.selectedForum!.posts = [...(this.selectedForum!.posts || []), res.data];
        this.newPost = '';
        this.posting = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('forums.postFailed');
        this.posting = false;
      },
    });
  }
}
