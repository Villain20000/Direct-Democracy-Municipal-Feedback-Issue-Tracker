import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Announcement, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-announcements-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
    .modal { background: var(--bg-card); border-radius: var(--radius-lg); width: 100%; max-width: 560px; box-shadow: var(--shadow-lg); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .modal-header h3 { font-size: 15px; font-weight: 700; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); width: 28px; height: 28px; border-radius: 50%; }
    .modal-close:hover { background: var(--bg-primary); color: var(--text-primary); }
    .modal-body { padding: 20px; }
    .modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--bg-primary); }
  `],
  template: `
    <app-layout [pageTitle]="i18n.t('announcements.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" [(ngModel)]="searchQuery" (keyup.enter)="loadAnnouncements()" [placeholder]="i18n.t('announcements.searchPlaceholder')" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;width:260px;" />
          <button class="btn btn-secondary btn-sm" (click)="loadAnnouncements()">{{ i18n.t('announcements.searchBtn') }}</button>
        </div>
        @if (canCreate) {
          <button class="btn btn-primary" (click)="openCreateModal()"><i class="material-icons-outlined" style="font-size:18px;">campaign</i> {{ i18n.t('announcements.newBtn') }}</button>
        }
      </div>

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('announcements.loading') }}</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('announcements.header', { n: announcements.length }) }}</h3></div>
          <div class="card-body">
            @for (item of announcements; track item.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <strong>{{ item.title }}</strong>
                    @if (item.isPinned) { <span class="badge badge-amber">{{ i18n.t('announcements.pinned') }}</span> }
                  </div>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <span style="font-size:11px;color:var(--text-muted);">{{ item.publishedAt || item.createdAt | date:'medium' }}</span>
                    @if (canManage(item)) {
                      <button class="btn btn-ghost btn-sm" (click)="togglePin(item)" [title]="item.isPinned ? i18n.t('announcements.unpin') : i18n.t('announcements.pin')">
                        <i class="material-icons-outlined" style="font-size:16px;">{{ item.isPinned ? 'push_pin' : 'push_pin' }}</i>
                      </button>
                      <button class="btn btn-ghost btn-sm" (click)="deleteAnnouncement(item)" [title]="i18n.t('announcements.delete')">
                        <i class="material-icons-outlined" style="font-size:16px;color:var(--danger);">delete</i>
                      </button>
                    }
                  </div>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;white-space:pre-wrap;">{{ isExpanded(item.id) ? item.content : (item.content.length > 280 ? item.content.slice(0, 280) + '…' : item.content) }}</p>
                @if (item.content.length > 280) {
                  <button class="btn btn-ghost btn-sm" (click)="toggleExpand(item.id)" style="font-size:12px;color:var(--primary);">
                    {{ isExpanded(item.id) ? i18n.t('announcements.showLess') : i18n.t('announcements.readMore') }}
                  </button>
                }
                @if (item.author) {
                  <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">{{ i18n.t('announcements.by', { name: item.author.firstName + ' ' + item.author.lastName }) }}</div>
                }
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('announcements.noAnnouncements') }}</div>
            }
          </div>
        </div>
      }

      <!-- Create Announcement Modal -->
      @if (showCreateModal) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ i18n.t('announcements.modalTitle') }}</h3>
              <button class="modal-close" (click)="closeCreateModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>{{ i18n.t('announcements.titleField') }}</label>
                <input type="text" [(ngModel)]="newAnn.title" name="title" />
              </div>
              <div class="form-group">
                <label>{{ i18n.t('announcements.contentField') }}</label>
                <textarea [(ngModel)]="newAnn.content" name="content" rows="5" [placeholder]="i18n.t('announcements.contentPlaceholder')"></textarea>
              </div>
              <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" [(ngModel)]="newAnn.isPinned" name="isPinned" style="width:16px;height:16px;" />
                  <span>{{ i18n.t('announcements.pinCheckbox') }}</span>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeCreateModal()">{{ i18n.t('common.cancel') }}</button>
              <button class="btn btn-primary" (click)="createAnnouncement()" [disabled]="!isAnnValid() || creating">
                @if (creating) { {{ i18n.t('announcements.posting') }} } @else { {{ i18n.t('announcements.postBtn') }} }
              </button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class AnnouncementsPageComponent implements OnInit {
  announcements: Announcement[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  canCreate = false;
  expanded = new Set<string>();

  showCreateModal = false;
  creating = false;
  newAnn = { title: '', content: '', isPinned: false };

  navItems: NavItem[] = [];

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  constructor() {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: this.auth.getDashboardRoute() }];
    this.canCreate = this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD, UserRole.STAFF);
  }

  ngOnInit() { this.loadAnnouncements(); }

  loadAnnouncements() {
    this.loading = true;
    this.error = '';
    this.api.getAnnouncements(this.searchQuery ? { search: this.searchQuery } : {}).subscribe({
      next: (res: any) => {
        this.announcements = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('announcements.loadFailed');
        this.loading = false;
      },
    });
  }

  isExpanded(id: string): boolean { return this.expanded.has(id); }
  toggleExpand(id: string) {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
  }

  canManage(ann: Announcement): boolean {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return ann.authorId === userId || this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR);
  }

  togglePin(ann: Announcement) {
    this.api.updateAnnouncement(ann.id, { isPinned: !ann.isPinned }).subscribe({
      next: (res: any) => {
        if (res.success) {
          ann.isPinned = !ann.isPinned;
          this.toast.success(ann.isPinned ? this.i18n.t('announcements.pinnedToast') : this.i18n.t('announcements.unpinnedToast'));
          this.loadAnnouncements();
        }
      },
      error: (err) => this.toast.error(err.error?.error || this.i18n.t('announcements.updateFailed')),
    });
  }

  deleteAnnouncement(ann: Announcement) {
    if (!confirm(this.i18n.t('announcements.deleteConfirm', { title: ann.title }))) return;
    this.api.deleteAnnouncement(ann.id).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('announcements.deleted'));
        this.announcements = this.announcements.filter(a => a.id !== ann.id);
      },
      error: (err) => this.toast.error(err.error?.error || this.i18n.t('announcements.deleteFailed')),
    });
  }

  openCreateModal() {
    this.newAnn = { title: '', content: '', isPinned: false };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  isAnnValid(): boolean {
    return !!(this.newAnn.title.trim() && this.newAnn.content.trim());
  }

  createAnnouncement() {
    if (!this.isAnnValid()) {
      this.toast.warning(this.i18n.t('announcements.validation'));
      return;
    }
    this.creating = true;
    this.api.createAnnouncement({
      title: this.newAnn.title.trim(),
      content: this.newAnn.content.trim(),
      isPinned: this.newAnn.isPinned,
    }).subscribe({
      next: (res: any) => {
        this.creating = false;
        if (res.success) {
          this.toast.success(this.i18n.t('announcements.posted'));
          this.closeCreateModal();
          this.loadAnnouncements();
        }
      },
      error: (err) => {
        this.toast.error(err.error?.error || this.i18n.t('announcements.postFailed'));
        this.creating = false;
      },
    });
  }
}
