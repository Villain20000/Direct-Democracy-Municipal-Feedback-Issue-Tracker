import { Component, HostListener, signal } from '@angular/core';

/**
 * Fixed gradient scroll-progress bar at the very top of the viewport.
 * Width is bound to the document scroll percentage. Pure CSS animation
 * drives the gradient shimmer; this component only updates width on
 * scroll. Cheap: passive listener, no Angular CD per frame.
 */
@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  template: `<div class="scroll-progress" [style.width.%]="progress()"></div>`,
})
export class ScrollProgressComponent {
  progress = signal(0);

  @HostListener('window:scroll')
  onScroll(): void {
    if (typeof document === 'undefined') return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.progress.set(height > 0 ? Math.min(100, (scrollTop / height) * 100) : 0);
  }
}
