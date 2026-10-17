import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, computed } from '@angular/core';
import { of } from 'rxjs';
import { MediaDashboardComponent } from './media-dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';

/**
 * P2-19 — Media press-center coverage: meeting-minutes archive mapping,
 * historical comparison series, and budget-transparency totals.
 * The template is not rendered (no detectChanges); we assert on the
 * component state wired by ngOnInit through a mocked ApiService.
 */
describe('MediaDashboardComponent (P2-19 media parity)', () => {
  let fixture: ComponentFixture<MediaDashboardComponent>;
  let component: MediaDashboardComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const trends = [
    { weekStart: '2026-09-01', created: 4, resolved: 1 },
    { weekStart: '2026-09-08', created: 6, resolved: 3 },
  ];
  const budget = [
    { departmentId: 'd1', name: 'Public Works', code: 'PW', fiscalYear: 2026, budget: 100, planned: 100, spent: 40, remaining: 60, pctUsed: 40 },
    { departmentId: 'd2', name: 'Sanitation', code: 'SAN', fiscalYear: 2026, budget: 200, planned: 200, spent: 50, remaining: 150, pctUsed: 25 },
  ];

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getIssueStats',
      'getIssueTrends',
      'getAnnouncements',
      'getIssues',
      'aiTrends',
      'getBudgetOverview',
      'getPortalMeetings',
    ]);
    apiSpy.getIssueStats.and.returnValue(of({
      success: true,
      data: { totalIssues: 10, resolvedIssues: 4, totalUsers: 16, issuesByCategory: { INFRASTRUCTURE: 3 } },
    } as any));
    apiSpy.getIssueTrends.and.returnValue(of({ success: true, data: trends } as any));
    apiSpy.getAnnouncements.and.returnValue(of({ data: [] } as any));
    apiSpy.getIssues.and.returnValue(of({ data: [] } as any));
    apiSpy.getBudgetOverview.and.returnValue(of({ success: true, data: budget } as any));
    apiSpy.getPortalMeetings.and.returnValue(of({ success: true, data: [] } as any));

    TestBed.configureTestingModule({
      imports: [MediaDashboardComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        {
          provide: AuthService,
          useValue: { user: computed(() => ({ id: 'media-1' })), isAuthenticated: computed(() => true), logout: () => {}, hasRole: () => false },
        },
        { provide: TranslationService, useValue: new TranslationService() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(MediaDashboardComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  it('creates the press-center dashboard', () => {
    expect(component).toBeTruthy();
  });

  it('maps portal meetings into the minutes archive', () => {
    apiSpy.getPortalMeetings.and.returnValue(of({
      success: true,
      data: [{
        id: 'm1', title: 'Council Session #42', startTime: '2026-09-20T18:00:00Z',
        creator: { firstName: 'Sarah', lastName: 'Mitchell' }, _count: { rsvps: 12 },
      }],
    } as any));
    component.loadMeetingMinutes();
    expect(component.minutesLoading).toBeFalse();
    expect(component.meetingMinutes).toEqual([{
      id: 'm1', title: 'Council Session #42', date: '2026-09-20T18:00:00Z',
      attendees: 12, organizer: 'Sarah Mitchell',
    }]);
  });

  it('leaves the minutes archive empty when there are no past meetings', () => {
    expect(component.meetingMinutes).toEqual([]);
    expect(component.minutesLoading).toBeFalse();
  });

  it('maps issue trends into the historical comparison series', () => {
    expect(component.comparisonLabels).toEqual(['09-01', '09-08']);
    expect(component.comparisonCreated).toEqual([4, 6]);
    expect(component.comparisonResolved).toEqual([1, 3]);
  });

  it('totals the budget-transparency overview', () => {
    expect(component.budgetOverview.length).toBe(2);
    expect(component.budgetTotal).toBe(300);
    expect(component.budgetSpent).toBe(90);
  });

  it('derives hero KPIs from issue stats', () => {
    expect(component.totalIssues).toBe(10);
    expect(component.resolutionRate).toBe(40);
    expect(component.publicStats.length).toBe(1);
  });
});
