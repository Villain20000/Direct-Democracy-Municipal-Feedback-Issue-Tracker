import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let service: TranslationService;
  let pipe: TranslatePipe;

  beforeEach(() => {
    // Clear any persisted language so each test starts on a deterministic state.
    try { localStorage.removeItem('dd.lang'); } catch {}

    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
    // The pipe is a real Angular @Pipe class — instantiate it via `new` so we
    // can call `transform()` directly without needing a component host.
    // Its constructor uses `inject(TranslationService)` from the active injector,
    // which is populated by TestBed.
    pipe = new TranslatePipe();
    // Re-bind the injected service in case TestBed's injector wasn't used.
    (pipe as unknown as { i18n: TranslationService }).i18n = service;
  });

  // -------------------------------------------------------------------
  // Basic lookup
  // -------------------------------------------------------------------
  describe('basic lookup', () => {
    it('returns the translated string for a known key (en)', () => {
      service.setLanguage('en');
      expect(pipe.transform('common.loading')).toBe('Loading...');
    });

    it('returns the translated string for a known key (el)', () => {
      service.setLanguage('el');
      expect(pipe.transform('common.loading')).toBe('Φόρτωση...');
    });

    it('returns the key as a fallback for an unknown key (en)', () => {
      service.setLanguage('en');
      expect(pipe.transform('does.not.exist')).toBe('does.not.exist');
    });

    it('returns the key as a fallback for an unknown key (el)', () => {
      service.setLanguage('el');
      expect(pipe.transform('does.not.exist')).toBe('does.not.exist');
    });

    it('handles a deeply-nested key', () => {
      service.setLanguage('en');
      expect(pipe.transform('auditLogs.exportCsv')).toBe('Export CSV');
      service.setLanguage('el');
      expect(pipe.transform('auditLogs.exportCsv')).toBe('Εξαγωγή CSV');
    });
  });

  // -------------------------------------------------------------------
  // {param} interpolation
  // -------------------------------------------------------------------
  describe('interpolation', () => {
    it('interpolates a single param (en)', () => {
      service.setLanguage('en');
      expect(pipe.transform('announcements.by', { name: 'Jane Doe' })).toBe('By Jane Doe');
    });

    it('interpolates a single param (el)', () => {
      service.setLanguage('el');
      expect(pipe.transform('announcements.by', { name: 'Ιωάννα Π.' })).toBe('Από Ιωάννα Π.');
    });

    it('interpolates multiple params', () => {
      service.setLanguage('en');
      expect(pipe.transform('forums.startedBy', { name: 'Test User' })).toBe(' · Started by Test User');
    });

    it('leaves unknown placeholders intact', () => {
      service.setLanguage('en');
      expect(pipe.transform('common.loading', { missing: 'x' })).toBe('Loading...');
    });
  });

  // -------------------------------------------------------------------
  // Reactivity — pipe is `pure: false`, so it should re-evaluate when the
  // underlying signal changes via setLanguage().
  // -------------------------------------------------------------------
  describe('reactivity', () => {
    it('re-evaluates the key after setLanguage("en") → setLanguage("el")', () => {
      service.setLanguage('en');
      expect(pipe.transform('common.yes')).toBe('Yes');
      service.setLanguage('el');
      expect(pipe.transform('common.yes')).toBe('Ναι');
    });

    it('re-evaluates the key after setLanguage("el") → setLanguage("en")', () => {
      service.setLanguage('el');
      expect(pipe.transform('common.no')).toBe('Όχι');
      service.setLanguage('en');
      expect(pipe.transform('common.no')).toBe('No');
    });

    it('reflects a missing key under both languages', () => {
      service.setLanguage('en');
      expect(pipe.transform('fake.key')).toBe('fake.key');
      service.setLanguage('el');
      expect(pipe.transform('fake.key')).toBe('fake.key');
    });
  });
});
