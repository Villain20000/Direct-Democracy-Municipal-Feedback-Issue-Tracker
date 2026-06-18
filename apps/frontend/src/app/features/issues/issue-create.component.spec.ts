import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA, computed } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { IssueCreateComponent } from './issue-create.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { IssueCategory } from '@dd/shared-types';

/**
 * Tests the real-time AI assist in IssueCreateComponent without rendering
 * the template. We construct the component, then poke its public methods
 * and assert on observable side-effects via the mocked ApiService.
 *
 * Focus:
 *   1. Debounce timing — only the *last* description change within the
 *      debounce window should fire AI calls.
 *   2. lastAutoChecked race guard — a slow (stale) response must not
 *      overwrite a newer one.
 *   3. ensureCandidates promise sharing — concurrent debounce ticks must
 *      share the same in-flight candidate fetch.
 *   4. userTouchedCategory — once the user has touched the category
 *      <select> (or applied a template), the AI must not auto-overwrite.
 */
describe('IssueCreateComponent — real-time AI assist', () => {
  let fixture: ComponentFixture<IssueCreateComponent>;
  let component: IssueCreateComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let authStub: Partial<AuthService>;

  // Helpers to wire controlled responses on the AI endpoints
  let categorizer$: Subject<any>;
  let suggester$: Subject<any>;
  let duplicates$: Subject<any>;
  let issuesList$: Subject<any>;

  beforeEach(() => {
    categorizer$ = new Subject<any>();
    suggester$ = new Subject<any>();
    duplicates$ = new Subject<any>();
    issuesList$ = new Subject<any>();

    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getIssueTemplates',
      'aiCategorize',
      'aiSuggestDepartment',
      'aiDuplicates',
      'getIssues',
      'createIssue',
    ]);
    apiSpy.getIssueTemplates.and.returnValue(of({ success: true, data: [] } as any));
    apiSpy.aiCategorize.and.returnValue(categorizer$);
    apiSpy.aiSuggestDepartment.and.returnValue(suggester$);
    apiSpy.aiDuplicates.and.returnValue(duplicates$);
    apiSpy.getIssues.and.returnValue(issuesList$);
    apiSpy.createIssue.and.returnValue(of({ success: true, data: { id: 'new-id' } } as any));

    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', [
      'success', 'error', 'warning', 'info',
    ]);
    authStub = { isAuthenticated: computed(() => true), logout: () => {}, hasRole: () => false };

    TestBed.configureTestingModule({
      imports: [FormsModule, RouterTestingModule, IssueCreateComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthService, useValue: authStub },
        { provide: TranslationService, useValue: new TranslationService() },
        { provide: OfflineQueueService, useValue: { enqueue: jasmine.createSpy('enqueue').and.returnValue(Promise.resolve(1)) } },
      ],
      schemas: [NO_ERRORS_SCHEMA], // ignore LayoutComponent, RouterLink, etc.
    });

    fixture = TestBed.createComponent(IssueCreateComponent);
    component = fixture.componentInstance;
    // Wire the debounce pipeline without rendering the full template.
    component.ngOnInit();
  });

  afterEach(() => {
    // Make sure any dangling subscriptions from the debounce pipeline are
    // torn down between tests.
    component.ngOnDestroy();
  });

  // -----------------------------------------------------------------
  // 1. Debounce timing
  // -----------------------------------------------------------------
  describe('debounce timing', () => {
    it('does NOT fire AI calls while the user is still typing', fakeAsync(() => {
      // Three rapid keystrokes — none individually long enough.
      component.onDescriptionChange('sho');
      tick(200);
      component.onDescriptionChange('short tex');
      tick(200);
      component.onDescriptionChange('short text now!');
      // Still inside the 800ms debounce window.
      tick(799);
      expect(apiSpy.aiCategorize).not.toHaveBeenCalled();
      expect(apiSpy.aiDuplicates).not.toHaveBeenCalled();

      // Now flush the debounce.
      tick(1);
      expect(apiSpy.aiCategorize).toHaveBeenCalledTimes(1);
      // The duplicate call requires `getIssues` to resolve first.
      flush();
    }));

    it('only fires AI calls for the LAST value after the debounce window', fakeAsync(() => {
      component.onDescriptionChange('a sentence that is long enough to pass the threshold');
      tick(400);
      component.onDescriptionChange('a sentence that is long enough but I keep typing more');
      tick(400);
      component.onDescriptionChange('a sentence that is long enough but I keep typing more words');
      // The 800ms debounce resets on every emission, so the first two are swallowed.
      tick(800);

      expect(apiSpy.aiCategorize).toHaveBeenCalledTimes(1);
      const callArg = apiSpy.aiCategorize.calls.mostRecent().args[0] as string;
      expect(callArg).toContain('I keep typing more words');
      flush();
    }));

    it('fires once per pause-and-resume cycle', fakeAsync(() => {
      component.onDescriptionChange('first chunk of text that is plenty long enough to trigger');
      tick(900);
      component.onDescriptionChange('second chunk of text that is also plenty long enough');
      tick(900);

      expect(apiSpy.aiCategorize).toHaveBeenCalledTimes(2);
      flush();
    }));
  });

  // -----------------------------------------------------------------
  // 2. userTouchedCategory flag
  // -----------------------------------------------------------------
  describe('userTouchedCategory flag', () => {
    function fireDescriptionAndResolveAutoAssist() {
      component.onDescriptionChange('a description that is definitely long enough to clear the threshold');
      tick(800);
      // Emit a high-confidence category response and let the pipeline process it.
      categorizer$.next({ success: true, data: { category: 'PUBLIC_SAFETY', confidence: 0.9 } });
      tick();
    }

    it('starts as false so the AI can suggest the initial category', fakeAsync(() => {
      expect((component as any).userTouchedCategory).toBe(false);
      fireDescriptionAndResolveAutoAssist();
      // With high confidence and the user not having touched the field,
      // the category SHOULD be auto-applied.
      expect(component.category).toBe(IssueCategory.PUBLIC_SAFETY);
    }));

    it('prevents auto-apply after the user has changed the category', fakeAsync(() => {
      component.onCategoryChange(IssueCategory.UTILITIES);
      expect((component as any).userTouchedCategory).toBe(true);
      fireDescriptionAndResolveAutoAssist();
      // Even with high confidence, the user\'s deliberate choice wins.
      expect(component.category).toBe(IssueCategory.UTILITIES);
    }));

    it('prevents auto-apply after the user has applied a template', fakeAsync(() => {
      // Seed a template so applyTemplate can find it.
      (component as any).templates = [
        { id: 'pothole', title: 'Pothole Report', description: '...', category: 'INFRASTRUCTURE' },
      ];
      const ev = { target: { value: 'pothole' } } as any;
      component.applyTemplate(ev);

      expect((component as any).userTouchedCategory).toBe(true);
      expect(component.category).toBe(IssueCategory.INFRASTRUCTURE);

      fireDescriptionAndResolveAutoAssist();
      // Even with a high-confidence PUBLIC_SAFETY suggestion, INFRASTRUCTURE wins.
      expect(component.category).toBe(IssueCategory.INFRASTRUCTURE);
    }));

    it('does NOT auto-apply when AI confidence is below the 0.55 threshold', fakeAsync(() => {
      const before = component.category;
      component.onDescriptionChange('a description that is definitely long enough to clear the threshold');
      tick(800);
      categorizer$.next({ success: true, data: { category: 'HEALTH', confidence: 0.3 } });
      tick();
      // Low confidence — the AI\'s suggestion is shown but NOT applied.
      expect(component.category).toBe(before);
    }));
  });

  // -----------------------------------------------------------------
  // 3. lastAutoChecked race-condition guard
  // -----------------------------------------------------------------
  describe('race-condition guard via lastAutoChecked', () => {
    it('ignores a stale categorization response that arrives after a newer typing cycle', fakeAsync(() => {
      const firstCycle$ = new Subject<any>();
      const secondCycle$ = new Subject<any>();
      apiSpy.aiCategorize.and.returnValues(firstCycle$, secondCycle$);

      // First typing cycle
      component.onDescriptionChange('first long enough text for the auto assist to kick in');
      tick(800);

      // Second typing cycle while the first response is still in flight
      component.onDescriptionChange('first long enough text for the auto assist to kick in v2');
      tick(800);

      // The OLD response now arrives. Because lastAutoChecked has moved on,
      // the result must be discarded.
      firstCycle$.next({ success: true, data: { category: 'PUBLIC_SAFETY', confidence: 0.99 } });
      tick();
      expect((component as any).aiSuggestion).toBeNull();

      // The NEW response arrives and IS applied.
      secondCycle$.next({ success: true, data: { category: 'SANITATION', confidence: 0.99 } });
      tick();
      expect((component as any).aiSuggestion?.category).toBe('SANITATION');
      expect(component.category).toBe(IssueCategory.SANITATION);
    }));

    it('silently degrades when the AI endpoint errors', fakeAsync(() => {
      component.onDescriptionChange('a description that is definitely long enough to clear the threshold');
      tick(800);
      categorizer$.error(new Error('boom'));
      tick();
      // No suggestion was set, no toast was fired (silent degradation).
      expect((component as any).aiSuggestion).toBeNull();
    }));
  });

  // -----------------------------------------------------------------
  // 4. ensureCandidates promise sharing
  // -----------------------------------------------------------------
  describe('ensureCandidates() promise sharing', () => {
    it('fetches the candidate list only once across multiple concurrent debounce ticks', fakeAsync(() => {
      // First, kick off a debounce cycle. ensureCandidates() will start an
      // in-flight request to getIssues. We resolve it AFTER several more
      // debounce cycles have fired.
      component.onDescriptionChange('first description long enough to pass the threshold');
      tick(800);
      // At this point apiSpy.getIssues has been called exactly once.
      expect(apiSpy.getIssues).toHaveBeenCalledTimes(1);

      // Now trigger a couple more debounce cycles BEFORE the first
      // getIssues response is resolved.
      component.onDescriptionChange('first description long enough to pass the threshold v2');
      tick(800);
      component.onDescriptionChange('first description long enough to pass the threshold v3');
      tick(800);

      // The shared in-flight promise should have prevented any additional
      // getIssues calls.
      expect(apiSpy.getIssues).toHaveBeenCalledTimes(1);

      // Now resolve the candidate list and flush the duplicate check.
      issuesList$.next({ success: true, data: [] });
      duplicates$.next({ success: true, data: { matches: [] } });
      flush();
    }));

    it('reuses a cached candidate list within the 60s window', fakeAsync(() => {
      // First cycle: prime the cache.
      component.onDescriptionChange('a description that is definitely long enough to clear the threshold');
      tick(800);
      issuesList$.next({ success: true, data: [{ id: 'x', title: 't', description: 'd', category: 'OTHER' }] });
      duplicates$.next({ success: true, data: { matches: [] } });
      flush();
      expect(apiSpy.getIssues).toHaveBeenCalledTimes(1);

      // Second cycle within the cache window: should NOT re-fetch.
      component.onDescriptionChange('a different description that is also long enough to clear it');
      tick(800);
      expect(apiSpy.getIssues).toHaveBeenCalledTimes(1);
      duplicates$.next({ success: true, data: { matches: [] } });
      flush();
    }));
  });

  // -----------------------------------------------------------------
  // 5. Short-input guard
  // -----------------------------------------------------------------
  describe('short-input guard', () => {
    it('clears duplicates and AI suggestions for inputs shorter than 15 chars', () => {
      // Pre-seed state so we can verify it gets cleared.
      (component as any).duplicates = [{ id: 'stale', title: 'stale', score: 0.9 }];
      (component as any).aiSuggestion = { category: 'OTHER', confidence: 0.5 };
      (component as any).aiDepartment = { department: 'X', confidence: 0.5 };

      component.onDescriptionChange('hi');
      expect((component as any).duplicates).toEqual([]);
      expect((component as any).aiSuggestion).toBeNull();
      expect((component as any).aiDepartment).toBeNull();
      // And it should NOT have pushed anything onto the debounce subject.
      expect(apiSpy.aiCategorize).not.toHaveBeenCalled();
    });
  });
});
