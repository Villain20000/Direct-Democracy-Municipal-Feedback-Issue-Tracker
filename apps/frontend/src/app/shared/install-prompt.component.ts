import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OfflineQueueService } from '../core/services/offline-queue.service';
import { TranslationService } from '../core/i18n/translation.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/**
 * Captures the browser's `beforeinstallprompt` event and shows a
 * small banner with a custom "Install" button. The native install
 * dialog is a black box and easy to miss; surfacing it in our own
 * UI bumps install rates ~3-4x (per Chrome's own A/B test data).
 *
 * Two displays:
 *   1. **Install prompt** — shown when the browser offers to
 *      install and the user hasn't dismissed it this session.
 *   2. **Offline queue badge** — shown when the offline queue has
 *      pending or dead-letter entries. Clicking it could open a
 *      detail panel, but for v1 we just show the count.
 */
@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (showInstall()) {
      <div class="install-banner" role="status">
        <span class="install-icon">📲</span>
        <span class="install-text">{{ 'pwa.installText' | t }}</span>
        <div class="install-actions">
          <button type="button" class="install-btn" (click)="install()">
            {{ 'pwa.installBtn' | t }}
          </button>
          <button type="button" class="install-dismiss" (click)="dismiss()" aria-label="Dismiss">×</button>
        </div>
      </div>
    }

    @if (queue.hasPending()) {
      <div class="queue-badge" role="status">
        🔄 {{ pendingCount() }}
        {{ 'pwa.reportsWaiting' | t }}
      </div>
    }

    @if (queue.hasDeadLetters()) {
      <div class="queue-badge queue-badge--error" role="alert">
        ⚠ {{ deadCount() }}
        {{ 'pwa.reportsFailed' | t }}
      </div>
    }
  `,
  styles: [`
    .install-banner {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card, #1e293b);
      color: var(--text-primary, #f8fafc);
      border: 1px solid var(--border, #334155);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      max-width: 480px;
      font-size: 14px;
      animation: install-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .install-icon { font-size: 20px; }
    .install-text { flex: 1; }
    .install-actions { display: flex; gap: 6px; align-items: center; }
    .install-btn {
      background: var(--primary, #2563eb);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .install-btn:hover { background: #1d4ed8; }
    .install-dismiss {
      background: transparent;
      border: none;
      color: var(--text-muted, #94a3b8);
      font-size: 20px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
    }
    .install-dismiss:hover { background: rgba(255, 255, 255, 0.08); }

    .queue-badge {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--primary, #2563eb);
      color: white;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
      z-index: 999;
    }
    .queue-badge--error {
      background: #DC2626;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }

    @keyframes install-in {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `],
})
export class InstallPromptComponent implements OnInit {
  queue = inject(OfflineQueueService);
  i18n = inject(TranslationService);

  private deferredPrompt: any = null;
  private dismissed = false;
  showInstall = signal(false);

  // Angular templates can't run arrow functions inside `{{ }}`,
  // so we expose precomputed counts as signals and read them from
  // the view. These re-run whenever `queue.pending()` changes.
  readonly pendingCount = computed(
    () => this.queue.pending().filter((q) => !q.dead).length,
  );
  readonly deadCount = computed(
    () => this.queue.pending().filter((q) => q.dead).length,
  );

  ngOnInit() {
    if (typeof window === 'undefined') return;
    // The browser fires `beforeinstallprompt` once per page-load
    // when the PWA is installable (manifest present, SW registered,
    // served over HTTPS in production). We hold onto the event so
    // our custom button can call `prompt()` later.
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (!this.dismissed) this.showInstall.set(true);
    });

    // Once installed, the event never fires again. `appinstalled`
    // is the success signal — we hide the banner.
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.showInstall.set(false);
    });
  }

  install() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      this.showInstall.set(false);
    });
  }

  dismiss() {
    this.dismissed = true;
    this.showInstall.set(false);
    // Persist the dismissal for the rest of the session. We don't
    // write to localStorage so a returning user (who may have
    // changed their mind) sees the banner again.
  }
}
