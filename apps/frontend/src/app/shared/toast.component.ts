import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'"
          [class.info]="toast.type === 'info'" [class.warning]="toast.type === 'warning'">
          <div class="toast-icon">{{ icon(toast.type) }}</div>
          <div class="toast-body">
            @if (toast.title) { <div class="toast-title">{{ toast.title }}</div> }
            <div class="toast-message">{{ toast.message }}</div>
          </div>
          <button class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss">
            <span>×</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 380px;
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 280px;
      max-width: 380px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      box-shadow: var(--shadow-lg);
      border-left: 4px solid var(--primary);
      animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-size: 13px;
      line-height: 1.4;
    }

    .toast-item.success {
      border-left-color: #16A34A;
      background: linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 60%);
    }
    .toast-item.error {
      border-left-color: #DC2626;
      background: linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 60%);
    }
    .toast-item.info {
      border-left-color: #2563EB;
      background: linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 60%);
    }
    .toast-item.warning {
      border-left-color: #D97706;
      background: linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 60%);
    }

    .toast-icon {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    .success .toast-icon { background: #16A34A; }
    .error .toast-icon { background: #DC2626; }
    .info .toast-icon { background: #2563EB; }
    .warning .toast-icon { background: #D97706; }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .toast-message {
      color: var(--text-secondary);
      word-wrap: break-word;
    }

    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      font-size: 20px;
      line-height: 1;
      padding: 0 4px;
      flex-shrink: 0;
      transition: color 0.2s;
    }

    .toast-close:hover {
      color: var(--text-primary);
    }

    @keyframes slideInRight {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @media (max-width: 600px) {
      .toast-container {
        top: auto;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: none;
      }
      .toast-item {
        min-width: 0;
      }
    }
  `],
})
export class ToastContainerComponent {
  toastService = inject(ToastService);

  icon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '!';
      case 'info':
      default: return 'i';
    }
  }
}
