import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();

  private nextId = 0;

  show(type: ToastType, message: string, options: { title?: string; duration?: number } = {}) {
    const toast: Toast = {
      id: `t${++this.nextId}`,
      type,
      message,
      title: options.title,
      duration: options.duration ?? (type === 'error' ? 6000 : 4000),
    };
    this._toasts.update((list) => [...list, toast]);
    if (toast.duration > 0) {
      setTimeout(() => this.dismiss(toast.id), toast.duration);
    }
    return toast.id;
  }

  success(message: string, title?: string) { return this.show('success', message, { title }); }
  error(message: string, title?: string) { return this.show('error', message, { title }); }
  info(message: string, title?: string) { return this.show('info', message, { title }); }
  warning(message: string, title?: string) { return this.show('warning', message, { title }); }

  dismiss(id: string) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this._toasts.set([]);
  }
}
