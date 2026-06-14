import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslationService } from './translation.service';

/**
 * Tiny host component that uses every i18n helper in its template. Each binding
 * reads directly from the service so we can verify the template re-renders
 * when `setLanguage()` is called — i.e. the helpers' reliance on the
 * `current` signal is truly reactive end-to-end.
 */
@Component({
  standalone: true,
  template: `
    <span data-testid="t">{{ i18n.t('common.yes') }}</span>
    <span data-testid="tStatus">{{ i18n.tStatus(status()) }}</span>
    <span data-testid="tCategory">{{ i18n.tCategory(category()) }}</span>
    <span data-testid="tRole">{{ i18n.tRole(role()) }}</span>
    <span data-testid="tPollState">{{ i18n.tPollState(active()) }}</span>
    <span data-testid="tUserStatus">{{ i18n.tUserStatus(userActive()) }}</span>
    <span data-testid="tResolutionStatus">{{ i18n.tResolutionStatus(resolution()) }}</span>
    <span data-testid="tEventType">{{ i18n.tEventType(eventType()) }}</span>
    <span data-testid="tNotificationType">{{ i18n.tNotificationType(notification()) }}</span>
    <span data-testid="tSentiment">{{ i18n.tSentiment(sentiment()) }}</span>
    <span data-testid="tQuestionType">{{ i18n.tQuestionType(question()) }}</span>
    <span data-testid="currentLang">{{ i18n.currentLanguage().code }}</span>
  `,
})
class I18nHostComponent {
  i18n = TestBed.inject(TranslationService);
  status = signal<string>('IN_PROGRESS');
  category = signal<string>('INFRASTRUCTURE');
  role = signal<string>('SUPER_ADMIN');
  active = signal<boolean>(true);
  userActive = signal<boolean>(false);
  resolution = signal<string>('VOTING');
  eventType = signal<string>('TOWN_HALL');
  notification = signal<string>('ISSUE_ASSIGNED');
  sentiment = signal<string>('POSITIVE');
  question = signal<string>('YES_NO');
}

describe('i18n integration (TestBed host component)', () => {
  let fixture: ComponentFixture<I18nHostComponent>;
  let service: TranslationService;

  beforeEach(() => {
    try { localStorage.removeItem('dd.lang'); } catch {}

    TestBed.configureTestingModule({
      imports: [I18nHostComponent],
    });
    service = TestBed.inject(TranslationService);
    fixture = TestBed.createComponent(I18nHostComponent);
    fixture.detectChanges();
  });

  /** Reads the textContent of an element with [data-testid="..."]. */
  function textOf(testId: string): string {
    const el = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    return (el?.textContent ?? '').trim();
  }

  // -------------------------------------------------------------------
  // Initial render — English
  // -------------------------------------------------------------------
  describe('initial render (en)', () => {
    beforeEach(() => {
      service.setLanguage('en');
      fixture.detectChanges();
    });

    it('renders every helper in English', () => {
      expect(textOf('t')).toBe('Yes');
      expect(textOf('tStatus')).toBe('In Progress');
      expect(textOf('tCategory')).toBe('Infrastructure');
      expect(textOf('tRole')).toBe('Super Admin');
      expect(textOf('tPollState')).toBe('Active');
      expect(textOf('tUserStatus')).toBe('Inactive');
      expect(textOf('tResolutionStatus')).toBe('Voting');
      expect(textOf('tEventType')).toBe('Town Hall');
      expect(textOf('tNotificationType')).toBe('Issue Assigned');
      expect(textOf('tSentiment')).toBe('Positive');
      expect(textOf('tQuestionType')).toBe('Yes / No');
      expect(textOf('currentLang')).toBe('en');
    });
  });

  // -------------------------------------------------------------------
  // Live re-render — switch to Greek and assert the DOM updates
  // -------------------------------------------------------------------
  describe('live re-render after setLanguage("el")', () => {
    beforeEach(() => {
      service.setLanguage('en');
      fixture.detectChanges();
      // Sanity check: starts in English.
      expect(textOf('t')).toBe('Yes');

      service.setLanguage('el');
      fixture.detectChanges();
    });

    it('updates every helper in the template', () => {
      expect(textOf('t')).toBe('Ναι');
      expect(textOf('tStatus')).toBe('Σε Εξέλιξη');
      expect(textOf('tCategory')).toBe('Υποδομές');
      expect(textOf('tRole')).toBe('Διαχειριστής');
      expect(textOf('tPollState')).toBe('Ενεργό');
      expect(textOf('tUserStatus')).toBe('Ανενεργός');
      expect(textOf('tResolutionStatus')).toBe('Σε Ψηφοφορία');
      expect(textOf('tEventType')).toBe('Δημοτική Συγκέντρωση');
      expect(textOf('tNotificationType')).toBe('Ανάθεση Θέματος');
      expect(textOf('tSentiment')).toBe('Θετικό');
      expect(textOf('tQuestionType')).toBe('Ναι / Όχι');
      expect(textOf('currentLang')).toBe('el');
    });
  });

  // -------------------------------------------------------------------
  // Toggle back to English — proves switching works in both directions
  // -------------------------------------------------------------------
  describe('toggle back to en after el', () => {
    it('returns to the English render after setLanguage("en")', () => {
      service.setLanguage('el');
      fixture.detectChanges();
      expect(textOf('t')).toBe('Ναι');

      service.setLanguage('en');
      fixture.detectChanges();
      expect(textOf('t')).toBe('Yes');
      expect(textOf('tStatus')).toBe('In Progress');
      expect(textOf('currentLang')).toBe('en');
    });
  });

  // -------------------------------------------------------------------
  // Underlying signals are also reactive
  // -------------------------------------------------------------------
  describe('underlying component signals are also reactive', () => {
    it('re-renders tStatus when the status signal changes', () => {
      const host = fixture.componentInstance;
      service.setLanguage('en');
      fixture.detectChanges();
      expect(textOf('tStatus')).toBe('In Progress');

      host.status.set('RESOLVED');
      fixture.detectChanges();
      expect(textOf('tStatus')).toBe('Resolved');

      service.setLanguage('el');
      fixture.detectChanges();
      expect(textOf('tStatus')).toBe('Επιλύθηκε');
    });

    it('re-renders tPollState when the active flag flips', () => {
      const host = fixture.componentInstance;
      service.setLanguage('en');
      fixture.detectChanges();
      expect(textOf('tPollState')).toBe('Active');

      host.active.set(false);
      fixture.detectChanges();
      expect(textOf('tPollState')).toBe('Closed');

      service.setLanguage('el');
      fixture.detectChanges();
      expect(textOf('tPollState')).toBe('Κλειστό');
    });
  });
});
