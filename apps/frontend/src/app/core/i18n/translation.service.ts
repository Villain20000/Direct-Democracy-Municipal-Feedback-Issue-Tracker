import { Injectable, signal, computed } from '@angular/core';
import { en, TranslationDictionary } from './translations/en';
import { el } from './translations/el';

export type LanguageCode = 'en' | 'el';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;       // Native display name (e.g. "English", "Ελληνικά")
  flag: string;       // Emoji flag for the language switcher
}

const STORAGE_KEY = 'dd.lang';

const LANGUAGE_REGISTRY: Record<LanguageCode, { dictionary: TranslationDictionary; info: LanguageInfo }> = {
  en: { dictionary: en, info: { code: 'en', name: 'English', flag: '🇬🇧' } },
  el: { dictionary: el, info: { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' } },
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private _current = signal<LanguageCode>(this.detectInitialLanguage());

  constructor() {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this._current();
    }
  }

  current = this._current.asReadonly();

  /** Reactive list of supported languages (in registration order). */
  languages = computed<LanguageInfo[]>(() => Object.values(LANGUAGE_REGISTRY).map(l => l.info));

  /** Reactive info for the current language. */
  currentLanguage = computed<LanguageInfo>(() => LANGUAGE_REGISTRY[this._current()].info);

  /** Reactive flag emoji for the current language (handy for switchers). */
  currentFlag = computed<string>(() => this.currentLanguage().flag);

  setLanguage(code: LanguageCode): void {
    this._current.set(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
    }
  }

  toggleLanguage(): void {
    this.setLanguage(this._current() === 'en' ? 'el' : 'en');
  }

  /**
   * Translate a dot-notation key. Falls back to the key itself when missing.
   * Supports simple {paramName} interpolation when params is provided.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const value = this.lookup(key, LANGUAGE_REGISTRY[this._current()].dictionary);
    if (typeof value !== 'string') {
      // Return the key as a last-resort fallback so missing translations are obvious.
      return key;
    }
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, name) =>
        params[name] !== undefined ? String(params[name]) : `{${name}}`,
      );
    }
    return value;
  }

  /**
   * Look up a translation whose key matches an enum value (e.g. an IssueStatus).
   * Useful for components that switch on raw enum strings.
   */
  tEnum<K extends keyof TranslationDictionary>(group: K, enumValue: string): string {
    const groupDict = LANGUAGE_REGISTRY[this._current()].dictionary[group] as Record<string, string>;
    if (groupDict && typeof groupDict === 'object' && enumValue in groupDict) {
      return groupDict[enumValue];
    }
    return enumValue;
  }

  /** Translate an IssueStatus enum value (e.g. 'IN_PROGRESS' → 'Σε Εξέλιξη'). */
  tStatus(status: string | null | undefined): string {
    return status ? this.tEnum('status', status) : '';
  }

  /** Translate an IssueCategory enum value (e.g. 'INFRASTRUCTURE' → 'Υποδομές'). */
  tCategory(category: string | null | undefined): string {
    return category ? this.tEnum('categories', category) : '';
  }

  /** Translate a UserRole enum value (e.g. 'SUPER_ADMIN' → 'Διαχειριστής'). */
  tRole(role: string | null | undefined): string {
    return role ? this.tEnum('roles', role) : '';
  }

  /** Translate a poll/survey active flag. */
  tPollState(active: boolean | null | undefined): string {
    return this.tEnum('pollState', active ? 'active' : 'closed');
  }

  /** Translate a user active flag. */
  tUserStatus(active: boolean | null | undefined): string {
    return this.tEnum('userStatus', active ? 'active' : 'inactive');
  }

  /** Translate a ResolutionStatus enum value (e.g. 'VOTING' → 'Σε Ψηφοφορία'). */
  tResolutionStatus(status: string | null | undefined): string {
    return status ? this.tEnum('resolutionStatus', status) : '';
  }

  /** Translate an EventType enum value (e.g. 'TOWN_HALL' → 'Δημοτική Συγκέντρωση'). */
  tEventType(type: string | null | undefined): string {
    return type ? this.tEnum('eventType', type) : '';
  }

  /** Translate a NotificationType enum value. */
  tNotificationType(type: string | null | undefined): string {
    return type ? this.tEnum('notificationType', type) : '';
  }

  /** Translate a sentiment value (POSITIVE / NEUTRAL / NEGATIVE). */
  tSentiment(s: string | null | undefined): string {
    return s ? this.tEnum('sentiment', s) : '';
  }

  /** Translate a survey question type (TEXT / MULTIPLE_CHOICE / RATING / YES_NO). */
  tQuestionType(t: string | null | undefined): string {
    return t ? this.tEnum('questionType', t) : '';
  }

  private detectInitialLanguage(): LanguageCode {
    if (typeof window === 'undefined') return 'en';
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (stored && stored in LANGUAGE_REGISTRY) return stored;
    } catch {}
    const browser = (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase()) || '';
    if (browser.startsWith('el')) return 'el';
    return 'en';
  }

  private lookup(key: string, source: unknown): unknown {
    const parts = key.split('.');
    let cur: unknown = source;
    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return cur;
  }
}
