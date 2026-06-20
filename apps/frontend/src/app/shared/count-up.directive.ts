import { Directive, input, ElementRef, inject, effect, Injector, afterNextRender } from '@angular/core';

/**
 * Animates a number from 0 → value on first render. Use on any
 * element whose text content is a number. The animation uses
 * requestAnimationFrame with an ease-out curve over `duration` ms.
 *
 * Usage:
 *   <div [countUp]="42">0</div>
 *   <div [countUp]="myCount()" [duration]="800">0</div>
 *
 * If `value` updates after the first render, the directive animates
 * from the current displayed value to the new one.
 */
@Directive({
  selector: '[countUp]',
  standalone: true,
})
export class CountUpDirective {
  countUp = input<number>(0);
  duration = input<number>(900);

  private el = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);
  private current = 0;
  private rafId = 0;

  constructor() {
    // Defer the effect until after first render so the initial 0 is
    // shown briefly before the animation kicks in. The effect runs in
    // the directive's injection context.
    afterNextRender(() => {
      effect(() => {
        const target = this.countUp();
        this.animateTo(target);
      }, { injector: this.injector });
    });
  }

  private animateTo(target: number): void {
    if (typeof window === 'undefined') {
      this.render(target);
      return;
    }
    cancelAnimationFrame(this.rafId);
    const start = this.current;
    const delta = target - start;
    const duration = this.duration();
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      this.current = start + delta * eased;
      this.render(this.current);
      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.current = target;
        this.render(target);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private render(value: number): void {
    const rounded = Math.round(value);
    this.el.nativeElement.textContent = String(rounded);
  }
}
