import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService, LanguageCode } from '../core/i18n/translation.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-switcher">
      <button class="lang-btn" (click)="toggle($event)">
        <span class="flag">{{ i18n.currentFlag() }}</span>
        <span class="code">{{ i18n.currentLanguage().code.toUpperCase() }}</span>
        <i class="material-icons-outlined chev">expand_more</i>
      </button>
      @if (open()) {
        <div class="lang-menu" (click)="$event.stopPropagation()">
          @for (lang of i18n.languages(); track lang.code) {
            <button
              class="lang-option"
              [class.active]="lang.code === i18n.currentLanguage().code"
              (click)="select(lang.code)"
            >
              <span class="flag">{{ lang.flag }}</span>
              <span class="name">{{ lang.name }}</span>
              @if (lang.code === i18n.currentLanguage().code) {
                <i class="material-icons-outlined check">check</i>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .lang-switcher {
      position: relative;
    }

    .lang-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .lang-btn:hover {
      background: var(--bg-card);
      border-color: var(--primary);
      color: var(--primary);
    }
    .lang-btn .flag { font-size: 14px; line-height: 1; }
    .lang-btn .code { letter-spacing: 0.05em; }
    .lang-btn .chev { font-size: 16px; }

    .lang-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 180px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      z-index: 250;
      padding: 4px;
      animation: langIn 0.15s ease;
    }

    @keyframes langIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .lang-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: none;
      border: none;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text-primary);
      cursor: pointer;
      border-radius: var(--radius);
      font-family: inherit;
      transition: background 0.15s;
    }
    .lang-option:hover { background: var(--bg-primary); }
    .lang-option.active { background: #EFF6FF; color: var(--primary); font-weight: 600; }
    .lang-option .flag { font-size: 16px; line-height: 1; }
    .lang-option .name { flex: 1; text-align: left; }
    .lang-option .check { font-size: 16px; color: var(--primary); }
  `],
  host: {
    '(document:click)': 'close()',
  },
})
export class LanguageSwitcherComponent {
  i18n = inject(TranslationService);
  open = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update(v => !v);
  }

  close(): void {
    if (this.open()) this.open.set(false);
  }

  select(code: LanguageCode): void {
    this.i18n.setLanguage(code);
    this.close();
  }
}
