import { Component, input } from '@angular/core';

/**
 * Reusable skeleton loader. Renders a shimmering placeholder block
 * matching the shape of real content so dashboards don't jump when
 * data arrives. Variants: text, title, circle, block, row.
 *
 * Usage:
 *   <app-skeleton variant="title" />
 *   <app-skeleton variant="circle" />
 *   <app-skeleton variant="row" *ngFor="let _ of [1,2,3]" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<span class="skeleton" [class.skeleton-text]="variant() === 'text'"
    [class.skeleton-title]="variant() === 'title'"
    [class.skeleton-circle]="variant() === 'circle'"
    [class.skeleton-block]="variant() === 'block'"
    [class.skeleton-row]="variant() === 'row'"
    [style.width]="width()"></span>`,
})
export class SkeletonComponent {
  variant = input<'text' | 'title' | 'circle' | 'block' | 'row'>('text');
  width = input<string | null>(null);
}
