import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * IndexedDB-backed offline queue for citizen issue submissions.
 *
 * The use case: a citizen is in the field, sees a pothole, opens the
 * app on a phone with no signal. They write the report, attach a
 * photo, and tap Submit. Instead of showing a network error and
 * losing the report, the queue persists the payload to IndexedDB
 * and shows a "Saved offline — will sync when you're back online"
 * toast. When `window.online` fires (or the SW re-registers and
 * posts a sync event), the queue replays every pending entry
 * against `POST /api/v1/issues` and clears them on success.
 *
 * Design notes:
 *   - We DO NOT use the service worker's Background Sync API for
 *     this. The SW version of Background Sync isn't supported on
 *     Safari or iOS, and we want the queue to drain even when the
 *     tab is backgrounded. The plain `window.online` event is
 *     enough for our needs and works everywhere.
 *   - Failures are retried with exponential backoff (1s, 2s, 4s,
 *     capped at 30s). After 5 consecutive failures, the entry is
 *     marked `dead` and the user is shown an error toast so they
 *     can manually retry or delete.
 *   - The queue is keyed by an auto-incrementing `id` for stable
 *     ordering. We don't use UUIDs because there's no sync
 *     scenario where two devices would have conflicting entries.
 */
export interface QueuedIssue {
  id?: number;
  /** Unix ms when the report was queued. */
  queuedAt: number;
  /** Unix ms of the last successful replay (undefined until then). */
  syncedAt?: number;
  /** The exact payload to POST to /api/v1/issues. */
  payload: {
    title: string;
    description: string;
    category: string;
    location: string;
    latitude?: number;
    longitude?: number;
    tags?: string[];
  };
  /** The File to upload (stored as a Blob in IndexedDB). */
  attachment?: { name: string; type: string; blob: Blob };
  /** Number of replay attempts so far (for backoff + dead-letter). */
  attempts: number;
  /** True after `attempts >= 5` consecutive failures. */
  dead: boolean;
  /** Last error message (for debugging / user-facing toast). */
  lastError?: string;
}

const DB_NAME = 'dd-offline';
const DB_VERSION = 2;
const STORE_NAME = 'issue-queue';
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private db: IDBDatabase | null = null;
  private _draining = false;

  /**
   * Signal of pending queue entries, updated whenever the queue
   * changes. Components (e.g. the install-prompt banner) can read
   * this to show a "3 reports waiting to sync" badge.
   */
  readonly pending = signal<QueuedIssue[]>([]);
  readonly hasPending = computed(() => this.pending().some((q) => !q.dead));
  readonly hasDeadLetters = computed(() => this.pending().some((q) => q.dead));

  /**
   * Wire up the service to window events and open the IndexedDB
   * connection. Called from APP_INITIALIZER so it runs once at
   * app boot. Safe to call multiple times — the underlying
   * `openDB()` returns the same connection.
   */
  async attach(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    this.db = await this.openDB();

    // Replay anything that was queued before a previous session
    // ended. If we're online, drain immediately. If not, we'll
    // drain on the next `online` event.
    await this.refresh();
    if (navigator.onLine) void this.drain();

    window.addEventListener('online', () => void this.drain());
    window.addEventListener('offline', () => { /* nothing to do — drain waits for online */ });
  }

  /**
   * Enqueue an issue for later submission. Returns the assigned
   * `id` so the UI can show a stable reference number. If we're
   * online, also kicks off an immediate drain attempt (so the user
   * doesn't have to wait for the next `online` event).
   */
  async enqueue(payload: QueuedIssue['payload'], attachment?: File): Promise<number> {
    if (!this.db) throw new Error('OfflineQueueService not attached');
    const entry: QueuedIssue = {
      queuedAt: Date.now(),
      payload,
      attempts: 0,
      dead: false,
      attachment: attachment
        ? { name: attachment.name, type: attachment.type, blob: attachment }
        : undefined,
    };
    const id = await this.put(entry);
    await this.refresh();

    // Register Background Sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('issue-sync');
      } catch (err) {
        console.warn('[OfflineQueue] Background sync registration failed:', err);
      }
    }

    if (navigator.onLine) void this.drain();
    return id;
  }

  async saveToken(token: string | null): Promise<void> {
    if (!this.db) {
      this.db = await this.openDB();
    }
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('db not open'));
      const tx = this.db.transaction('auth-store', 'readwrite');
      const store = tx.objectStore('auth-store');
      const req = store.put(token, 'accessToken');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Drop a single entry from the queue (e.g. user cancelled it). */
  async remove(id: number): Promise<void> {
    if (!this.db) return;
    await this.del(id);
    await this.refresh();
  }

  /**
   * Replay every pending entry against the live API. Safe to call
   * concurrently — a `_draining` flag prevents pile-up if the user
   * flaps the network. Per-entry retries use exponential backoff
     so a brief server hiccup doesn't burn 5 attempts in 5s.
     Failed-forever entries (5+ attempts) are marked `dead` and
     surfaced via the `hasDeadLetters` signal.
   */
  async drain(): Promise<void> {
    if (this._draining) return;
    if (!navigator.onLine) return;
    this._draining = true;
    try {
      const all = await this.all();
      for (const entry of all) {
        if (entry.dead) continue;
        if (entry.id == null) continue;
        const backoffMs = Math.min(
          BACKOFF_CAP_MS,
          BACKOFF_BASE_MS * Math.pow(2, entry.attempts),
        );
        if (entry.attempts > 0 && Date.now() - entry.queuedAt < backoffMs) {
          // Still in the cool-down window. The next drain
          // (triggered by an `online` event or a manual retry)
          // will pick it up.
          continue;
        }
        try {
          await this.replayOne(entry);
        } catch (err: any) {
          await this.recordFailure(entry, err);
        }
      }
      await this.refresh();
    } finally {
      this._draining = false;
    }
  }

  private async replayOne(entry: QueuedIssue): Promise<void> {
    // First: POST the issue. Then: upload the attachment if any.
    // The two steps are independent — if the issue succeeds but
    // the upload fails, we still mark the entry as synced (the
    // attachment is best-effort and the citizen can re-upload
    // from the issue detail page once online).
    const created: any = await firstValueFrom(
      this.http.post('/api/v1/issues', entry.payload),
    );
    if (entry.attachment && created?.data?.id) {
      try {
        const fd = new FormData();
        fd.append('file', entry.attachment.blob, entry.attachment.name);
        await firstValueFrom(this.http.post(`/api/v1/issues/${created.data.id}/attachments`, fd));
      } catch {
        // Swallow attachment errors. The issue is created; the
        // attachment upload can be retried from the issue page.
      }
    }
    if (entry.id != null) await this.del(entry.id);
  }

  private async recordFailure(entry: QueuedIssue, err: any): Promise<void> {
    const nextAttempts = entry.attempts + 1;
    const dead = nextAttempts >= MAX_ATTEMPTS;
    const updated: QueuedIssue = {
      ...entry,
      attempts: nextAttempts,
      dead,
      lastError: err?.message || err?.statusText || 'Unknown error',
    };
    if (entry.id != null) {
      // We can't re-PUT with the same key, so delete + add.
      await this.del(entry.id);
      delete updated.id;
      await this.put(updated);
    }
  }

  // --- IDB plumbing ---------------------------------------------------

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event: any) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('dead', 'dead', { unique: false });
        }
        if (!db.objectStoreNames.contains('auth-store')) {
          db.createObjectStore('auth-store');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private put(entry: QueuedIssue): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('db not open'));
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  private del(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private all(): Promise<QueuedIssue[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async refresh(): Promise<void> {
    const all = await this.all();
    this.pending.set(all);
  }
}
