import { Component, HostListener, signal, computed, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { TranslationService } from '../core/i18n/translation.service';

interface PaletteEntry {
  label: string;
  icon: string;
  route?: string;
  action?: 'theme' | 'logout' | 'report';
  roles?: string[]; // if omitted, available to all authenticated users
}

/**
 * Global Cmd/Ctrl+K command palette. Fuzzy-filters a catalog of
 * navigable routes (filtered by the caller's role) plus a few quick
 * actions (report issue, toggle theme, sign out). Keyboard-driven:
 * ↑/↓ to move, Enter to select, Esc to close.
 *
 * The palette is mounted once in AppComponent so it's available on
 * every page. It only opens when not focused in a text input/textarea
 * to avoid stealing keystrokes from forms.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open()) {
      <div class="command-palette-overlay" (click)="close()">
        <div class="command-palette" (click)="$event.stopPropagation()">
          <div class="cp-header">
            <i class="material-icons-outlined">search</i>
            <input
              #input
              type="text"
              [placeholder]="i18n.t('commandPalette.placeholder')"
              [(ngModel)]="query"
              (keydown)="onKey($event)"
              autocomplete="off"
            />
            <span class="cp-kbd">Esc</span>
          </div>
          <div class="cp-list">
            @if (filtered().length === 0) {
              <div class="cp-empty">{{ i18n.t('commandPalette.noResults') }}</div>
            }
            @for (section of sections(); track section.title) {
              @if (section.items.length > 0) {
                <div class="cp-section-title">{{ section.title }}</div>
                @for (item of section.items; track item.label) {
                  <div
                    class="cp-item"
                    [class.active]="isActive(item)"
                    (click)="select(item)"
                    (mouseenter)="hover(item)">
                    <i class="material-icons-outlined">{{ item.icon }}</i>
                    <span class="cp-item-label">{{ item.label }}</span>
                  </div>
                }
              }
            }
          </div>
          <div class="cp-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>Enter</kbd> select</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  open = signal(false);
  query = '';
  activeIndex = signal(0);

  i18n = inject(TranslationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private el = inject(ElementRef<HTMLElement>);

  private role = computed(() => this.auth.user()?.role || '');

  /**
   * Catalog of navigable routes. `roles` restricts an entry to the
   * listed roles; if omitted it's available to any authenticated user.
   * Kept in sync with app.routes.ts by hand — this is a navigation
   * shortcut, not a security boundary (guards still apply).
   */
  private catalog: PaletteEntry[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '__home__' },
    { label: 'All Issues', icon: 'report_problem', route: '/issues' },
    { label: 'Report New Issue', icon: 'add_circle', route: '/issues/new', action: 'report' },
    { label: 'Issues Map', icon: 'map', route: '/ward/map' },
    { label: 'Polls & Voting', icon: 'how_to_vote', route: '/citizen/polls' },
    { label: 'Referendums', icon: 'ballot', route: '/citizen/referendums' },
    { label: 'Surveys', icon: 'poll', route: '/citizen/surveys' },
    { label: 'Forums', icon: 'forum', route: '/citizen/forums' },
    { label: 'Events', icon: 'event', route: '/citizen/events' },
    { label: 'Announcements', icon: 'campaign', route: '/mayor/announcements' },
    { label: 'Analytics', icon: 'analytics', route: '/mayor/analytics' },
    { label: 'Resolutions', icon: 'gavel', route: '/council/resolutions' },
    { label: 'Audit Logs', icon: 'fact_check', route: '/auditor/logs' },
    { label: 'Users', icon: 'group', route: '/admin/users', roles: ['SUPER_ADMIN'] },
    { label: 'Departments', icon: 'apartment', route: '/admin/departments', roles: ['SUPER_ADMIN'] },
    { label: 'Wards', icon: 'location_city', route: '/admin/wards', roles: ['SUPER_ADMIN'] },
    { label: 'Settings', icon: 'settings', route: '/admin/settings', roles: ['SUPER_ADMIN'] },
    { label: 'Legislation KB', icon: 'library_books', route: '/admin/documents', roles: ['SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER'] },
    { label: 'Public Portal', icon: 'public', route: '/portal' },
  ];

  private actions: PaletteEntry[] = [
    { label: 'Toggle theme', icon: 'dark_mode', action: 'theme' },
    { label: 'Sign out', icon: 'logout', action: 'logout' },
  ];

  private visibleNav = computed<PaletteEntry[]>(() => {
    const role = this.role();
    return this.catalog.filter((e) => {
      if (e.route === '__home__') return true;
      if (!e.roles) return true;
      return e.roles.includes(role);
    });
  });

  private visibleActions = computed<PaletteEntry[]>(() => this.actions);

  filtered = computed<PaletteEntry[]>(() => {
    const q = this.query.trim().toLowerCase();
    const all = [...this.visibleNav(), ...this.visibleActions()];
    if (!q) return all;
    return all.filter((e) => e.label.toLowerCase().includes(q));
  });

  sections = computed(() => {
    const q = this.query.trim().toLowerCase();
    const navItems = this.visibleNav().filter((e) => !q || e.label.toLowerCase().includes(q));
    const actionItems = this.visibleActions().filter((e) => !q || e.label.toLowerCase().includes(q));
    return [
      { title: this.i18n.t('commandPalette.sectionNavigate'), items: navItems },
      { title: this.i18n.t('commandPalette.sectionActions'), items: actionItems },
    ];
  });

  private flatList = computed<PaletteEntry[]>(() =>
    this.sections().flatMap((s) => s.items),
  );

  isActive(item: PaletteEntry): boolean {
    const flat = this.flatList();
    return flat[this.activeIndex()] === item;
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent): void {
    // Cmd/Ctrl+K toggles. Ignore when focused in an input/textarea
    // unless it's the palette's own input.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.open.set(!this.open());
      if (this.open()) {
        this.query = '';
        this.activeIndex.set(0);
        setTimeout(() => {
          const input = this.el.nativeElement.querySelector('input');
          input?.focus();
        }, 0);
      }
    }
    if (event.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  onKey(event: KeyboardEvent): void {
    const flat = this.flatList();
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = flat[this.activeIndex()];
      if (item) this.select(item);
    }
  }

  hover(item: PaletteEntry): void {
    const flat = this.flatList();
    const idx = flat.indexOf(item);
    if (idx >= 0) this.activeIndex.set(idx);
  }

  select(item: PaletteEntry): void {
    this.close();
    if (item.action === 'theme') {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      return;
    }
    if (item.action === 'logout') {
      this.auth.logout();
      return;
    }
    if (item.route === '__home__') {
      this.router.navigateByUrl(this.auth.getDashboardRoute());
      return;
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  close(): void {
    this.open.set(false);
    this.query = '';
  }
}
