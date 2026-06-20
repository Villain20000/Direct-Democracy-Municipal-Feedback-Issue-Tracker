import { Component, HostListener, signal, inject } from '@angular/core';
import { TranslationService } from '../core/i18n/translation.service';

/**
 * Floating "back to top" button. Hidden until the user scrolls past
 * 400px, then fades/slides in. Smooth-scrolls to top on click.
 */
@Component({
  selector: 'app-scroll-top',
  standalone: true,
  template: `
    <button
      class="scroll-top-fab"
      [class.visible]="visible()"
      (click)="scrollTop()"
      [attr.aria-label]="i18n.t('shell.backToTop')"
      [title]="i18n.t('shell.backToTop')">
      <i class="material-icons-outlined">arrow_upward</i>
    </button>
  `,
})
export class ScrollTopComponent {
  visible = signal(false);
  i18n = inject(TranslationService);

  @HostListener('window:scroll')
  onScroll(): void {
    this.visible.set((window.scrollY || 0) > 400);
  }

  scrollTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
