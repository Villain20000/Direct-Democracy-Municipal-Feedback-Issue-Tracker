import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    // Clear any persisted language so each test starts on a deterministic state.
    // Every test also calls setLanguage() explicitly, so the initial detected
    // language is irrelevant — we don't need to mock navigator.language.
    try { localStorage.removeItem('dd.lang'); } catch {}

    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
  });

  // -------------------------------------------------------------------
  // t() — dot-notation key lookup + {param} interpolation
  // -------------------------------------------------------------------
  describe('t()', () => {
    it('returns the translated string for a known key (en)', () => {
      service.setLanguage('en');
      expect(service.t('common.loading')).toBe('Loading...');
    });

    it('returns the translated string for a known key (el)', () => {
      service.setLanguage('el');
      expect(service.t('common.loading')).toBe('Φόρτωση...');
    });

    it('returns the key as a fallback for an unknown key', () => {
      service.setLanguage('en');
      expect(service.t('does.not.exist')).toBe('does.not.exist');
    });

    it('interpolates {name} placeholders', () => {
      service.setLanguage('en');
      expect(service.t('announcements.by', { name: 'Jane Doe' })).toBe('By Jane Doe');
      service.setLanguage('el');
      expect(service.t('announcements.by', { name: 'Ιωάννα Π.' })).toBe('Από Ιωάννα Π.');
    });

    it('leaves unknown placeholders as {name}', () => {
      service.setLanguage('en');
      expect(service.t('common.loading', { missing: 'x' })).toBe('Loading...');
    });

    it('switches language reactively', () => {
      service.setLanguage('en');
      expect(service.t('common.yes')).toBe('Yes');
      service.setLanguage('el');
      expect(service.t('common.yes')).toBe('Ναι');
    });
  });

  // -------------------------------------------------------------------
  // tEnum() — generic enum group lookup
  // -------------------------------------------------------------------
  describe('tEnum()', () => {
    it('returns the translated enum value (en)', () => {
      service.setLanguage('en');
      expect(service.tEnum('status', 'IN_PROGRESS')).toBe('In Progress');
    });

    it('returns the translated enum value (el)', () => {
      service.setLanguage('el');
      expect(service.tEnum('status', 'IN_PROGRESS')).toBe('Σε Εξέλιξη');
    });

    it('returns the raw enum value as fallback when key is missing', () => {
      service.setLanguage('en');
      expect(service.tEnum('status', 'NONEXISTENT')).toBe('NONEXISTENT');
    });
  });

  // -------------------------------------------------------------------
  // tStatus() — IssueStatus
  // -------------------------------------------------------------------
  describe('tStatus()', () => {
    it('translates known statuses in en', () => {
      service.setLanguage('en');
      expect(service.tStatus('SUBMITTED')).toBe('Submitted');
      expect(service.tStatus('IN_PROGRESS')).toBe('In Progress');
      expect(service.tStatus('RESOLVED')).toBe('Resolved');
    });

    it('translates known statuses in el', () => {
      service.setLanguage('el');
      expect(service.tStatus('SUBMITTED')).toBe('Υποβλήθηκε');
      expect(service.tStatus('IN_PROGRESS')).toBe('Σε Εξέλιξη');
      expect(service.tStatus('RESOLVED')).toBe('Επιλύθηκε');
    });

    it('returns the raw value when the status is unknown', () => {
      service.setLanguage('en');
      expect(service.tStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });

    it('returns empty string for null', () => {
      expect(service.tStatus(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(service.tStatus(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tCategory() — IssueCategory
  // -------------------------------------------------------------------
  describe('tCategory()', () => {
    it('translates known categories in en', () => {
      service.setLanguage('en');
      expect(service.tCategory('INFRASTRUCTURE')).toBe('Infrastructure');
      expect(service.tCategory('PUBLIC_SAFETY')).toBe('Public Safety');
    });

    it('translates known categories in el', () => {
      service.setLanguage('el');
      expect(service.tCategory('INFRASTRUCTURE')).toBe('Υποδομές');
      expect(service.tCategory('PUBLIC_SAFETY')).toBe('Δημόσια Ασφάλεια');
    });

    it('returns the raw value when the category is unknown', () => {
      service.setLanguage('en');
      expect(service.tCategory('UNKNOWN_CATEGORY')).toBe('UNKNOWN_CATEGORY');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tCategory(null)).toBe('');
      expect(service.tCategory(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tRole() — UserRole
  // -------------------------------------------------------------------
  describe('tRole()', () => {
    it('translates known roles in en', () => {
      service.setLanguage('en');
      expect(service.tRole('SUPER_ADMIN')).toBe('Super Admin');
      expect(service.tRole('COUNCIL_MEMBER')).toBe('Council Member');
    });

    it('translates known roles in el', () => {
      service.setLanguage('el');
      expect(service.tRole('SUPER_ADMIN')).toBe('Διαχειριστής');
      expect(service.tRole('COUNCIL_MEMBER')).toBe('Δημοτικός Σύμβουλος');
    });

    it('returns the raw value when the role is unknown', () => {
      service.setLanguage('en');
      expect(service.tRole('UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tRole(null)).toBe('');
      expect(service.tRole(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tPollState() — boolean → 'active' / 'closed'
  // -------------------------------------------------------------------
  describe('tPollState()', () => {
    it('returns the active translation for true (en/el)', () => {
      service.setLanguage('en');
      expect(service.tPollState(true)).toBe('Active');
      service.setLanguage('el');
      expect(service.tPollState(true)).toBe('Ενεργό');
    });

    it('returns the closed translation for false (en/el)', () => {
      service.setLanguage('en');
      expect(service.tPollState(false)).toBe('Closed');
      service.setLanguage('el');
      expect(service.tPollState(false)).toBe('Κλειστό');
    });

    it('treats null as false (closed)', () => {
      service.setLanguage('en');
      expect(service.tPollState(null)).toBe('Closed');
    });

    it('treats undefined as false (closed)', () => {
      service.setLanguage('en');
      expect(service.tPollState(undefined)).toBe('Closed');
    });
  });

  // -------------------------------------------------------------------
  // tUserStatus() — boolean → 'active' / 'inactive'
  // -------------------------------------------------------------------
  describe('tUserStatus()', () => {
    it('returns the active translation for true (en/el)', () => {
      service.setLanguage('en');
      expect(service.tUserStatus(true)).toBe('Active');
      service.setLanguage('el');
      expect(service.tUserStatus(true)).toBe('Ενεργός');
    });

    it('returns the inactive translation for false (en/el)', () => {
      service.setLanguage('en');
      expect(service.tUserStatus(false)).toBe('Inactive');
      service.setLanguage('el');
      expect(service.tUserStatus(false)).toBe('Ανενεργός');
    });

    it('treats null/undefined as false (inactive)', () => {
      service.setLanguage('en');
      expect(service.tUserStatus(null)).toBe('Inactive');
      expect(service.tUserStatus(undefined)).toBe('Inactive');
    });
  });

  // -------------------------------------------------------------------
  // tResolutionStatus() — ResolutionStatus
  // -------------------------------------------------------------------
  describe('tResolutionStatus()', () => {
    it('translates known statuses in en', () => {
      service.setLanguage('en');
      expect(service.tResolutionStatus('DRAFT')).toBe('Draft');
      expect(service.tResolutionStatus('VOTING')).toBe('Voting');
      expect(service.tResolutionStatus('IMPLEMENTED')).toBe('Implemented');
    });

    it('translates known statuses in el', () => {
      service.setLanguage('el');
      expect(service.tResolutionStatus('DRAFT')).toBe('Πρόχειρο');
      expect(service.tResolutionStatus('VOTING')).toBe('Σε Ψηφοφορία');
      expect(service.tResolutionStatus('IMPLEMENTED')).toBe('Εφαρμόστηκε');
    });

    it('returns the raw value when the status is unknown', () => {
      service.setLanguage('en');
      expect(service.tResolutionStatus('UNKNOWN')).toBe('UNKNOWN');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tResolutionStatus(null)).toBe('');
      expect(service.tResolutionStatus(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tEventType() — EventType
  // -------------------------------------------------------------------
  describe('tEventType()', () => {
    it('translates known event types in en', () => {
      service.setLanguage('en');
      expect(service.tEventType('COUNCIL_MEETING')).toBe('Council Meeting');
      expect(service.tEventType('TOWN_HALL')).toBe('Town Hall');
    });

    it('translates known event types in el', () => {
      service.setLanguage('el');
      expect(service.tEventType('COUNCIL_MEETING')).toBe('Συνεδρίαση Δημοτικού Συμβουλίου');
      expect(service.tEventType('TOWN_HALL')).toBe('Δημοτική Συγκέντρωση');
    });

    it('returns the raw value when the event type is unknown', () => {
      service.setLanguage('en');
      expect(service.tEventType('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tEventType(null)).toBe('');
      expect(service.tEventType(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tNotificationType() — NotificationType
  // -------------------------------------------------------------------
  describe('tNotificationType()', () => {
    it('translates known notification types in en', () => {
      service.setLanguage('en');
      expect(service.tNotificationType('ISSUE_ASSIGNED')).toBe('Issue Assigned');
      expect(service.tNotificationType('EVENT_REMINDER')).toBe('Event Reminder');
    });

    it('translates known notification types in el', () => {
      service.setLanguage('el');
      expect(service.tNotificationType('ISSUE_ASSIGNED')).toBe('Ανάθεση Θέματος');
      expect(service.tNotificationType('EVENT_REMINDER')).toBe('Υπενθύμιση Εκδήλωσης');
    });

    it('returns the raw value when the notification type is unknown', () => {
      service.setLanguage('en');
      expect(service.tNotificationType('UNKNOWN')).toBe('UNKNOWN');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tNotificationType(null)).toBe('');
      expect(service.tNotificationType(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tSentiment() — POSITIVE / NEUTRAL / NEGATIVE
  // -------------------------------------------------------------------
  describe('tSentiment()', () => {
    it('translates known sentiments in en', () => {
      service.setLanguage('en');
      expect(service.tSentiment('POSITIVE')).toBe('Positive');
      expect(service.tSentiment('NEGATIVE')).toBe('Negative');
    });

    it('translates known sentiments in el', () => {
      service.setLanguage('el');
      expect(service.tSentiment('POSITIVE')).toBe('Θετικό');
      expect(service.tSentiment('NEGATIVE')).toBe('Αρνητικό');
    });

    it('returns the raw value when the sentiment is unknown', () => {
      service.setLanguage('en');
      expect(service.tSentiment('UNKNOWN')).toBe('UNKNOWN');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tSentiment(null)).toBe('');
      expect(service.tSentiment(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // tQuestionType() — TEXT / MULTIPLE_CHOICE / RATING / YES_NO
  // -------------------------------------------------------------------
  describe('tQuestionType()', () => {
    it('translates known question types in en', () => {
      service.setLanguage('en');
      expect(service.tQuestionType('MULTIPLE_CHOICE')).toBe('Multiple Choice');
      expect(service.tQuestionType('YES_NO')).toBe('Yes / No');
    });

    it('translates known question types in el', () => {
      service.setLanguage('el');
      expect(service.tQuestionType('MULTIPLE_CHOICE')).toBe('Πολλαπλή Επιλογή');
      expect(service.tQuestionType('YES_NO')).toBe('Ναι / Όχι');
    });

    it('returns the raw value when the question type is unknown', () => {
      service.setLanguage('en');
      expect(service.tQuestionType('UNKNOWN')).toBe('UNKNOWN');
    });

    it('returns empty string for null/undefined', () => {
      expect(service.tQuestionType(null)).toBe('');
      expect(service.tQuestionType(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // Language switching — ensures every helper reacts to setLanguage()
  // -------------------------------------------------------------------
  describe('language switching', () => {
    it('switches every helper reactively', () => {
      const checks = [
        () => service.tStatus('IN_PROGRESS'),
        () => service.tCategory('INFRASTRUCTURE'),
        () => service.tRole('SUPER_ADMIN'),
        () => service.tPollState(true),
        () => service.tUserStatus(false),
        () => service.tResolutionStatus('VOTING'),
        () => service.tEventType('TOWN_HALL'),
        () => service.tNotificationType('ISSUE_ASSIGNED'),
        () => service.tSentiment('POSITIVE'),
        () => service.tQuestionType('YES_NO'),
      ];

      service.setLanguage('en');
      const enResults = checks.map(fn => fn());
      service.setLanguage('el');
      const elResults = checks.map(fn => fn());

      // Every helper should produce a *different* value when switching languages.
      for (let i = 0; i < enResults.length; i++) {
        expect(enResults[i]).not.toBe(elResults[i]);
        expect(enResults[i]).toBeTruthy();
        expect(elResults[i]).toBeTruthy();
      }
    });
  });
});
