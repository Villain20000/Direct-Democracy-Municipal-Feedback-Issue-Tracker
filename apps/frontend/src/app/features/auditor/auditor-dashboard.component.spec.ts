import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, computed } from '@angular/core';
import { of } from 'rxjs';
import { AuditorDashboardComponent } from './auditor-dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';

/**
 * P2-20 — Auditor oversight coverage: log/anomaly mapping, resolution
 * timeline series, ER-graph shape, and the budget-trail hook.
 * The template is not rendered (no detectChanges); we assert on the
 * component state wired by ngOnInit through a mocked ApiService.
 */
describe('AuditorDashboardComponent (P2-20 auditor parity)', () => {
  let fixture: ComponentFixture<AuditorDashboardComponent>;
  let component: AuditorDashboardComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const budget = [
    { departmentId: 'd1', name: 'Public Works', code: 'PW', fiscalYear: 2026, budget: 100, planned: 100, spent: 40, remaining: 60, pctUsed: 40 },
    { departmentId: 'd2', name: 'Sanitation', code: 'SAN', fiscalYear: 2026, budget: 200, planned: 200, spent: 50, remaining: 150, pctUsed: 25 },
  ];

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAuditLogs',
      'getAuditAnomalies',
      'getDepartmentResolutionRates',
      'getIssueStats',
      'getIssueTrends',
      'getBudgetOverview',
      'exportIssuesCsv',
      'exportAuditCsv',
      'exportExpensesCsv',
    ]);
    apiSpy.getAuditLogs.and.returnValue(of({
      data: [{
        id: 'log-1', createdAt: '2026-09-01T10:00:00Z', action: 'CREATE',
        entity: 'Issue', entityId: 'abcdef1234567890', userId: 'u1',
        user: { firstName: 'Tom', lastName: 'Wilson' }, newValues: { title: 'Pothole' },
      }],
      total: 1,
    } as any));
    apiSpy.getAuditAnomalies.and.returnValue(of({
      success: true,
      data: { summary: 'One spike', items: [{ title: 'Spike', severity: 'high', desc: 'd', date: '2026-09-01T00:00:00Z' }] },
    } as any));
    apiSpy.getDepartmentResolutionRates.and.returnValue(of({
      success: true, data: [{ department: 'Public Works', pct: 80 }],
    } as any));
    apiSpy.getIssueStats.and.returnValue(of({
      success: true, data: { totalIssues: 10, resolvedIssues: 4 },
    } as any));
    apiSpy.getIssueTrends.and.returnValue(of({
      success: true,
      data: [{ weekStart: '2026-09-01', created: 4, resolved: 1 }],
    } as any));
    apiSpy.getBudgetOverview.and.returnValue(of({ success: true, data: budget } as any));

    TestBed.configureTestingModule({
      imports: [AuditorDashboardComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        {
          provide: AuthService,
          useValue: { user: computed(() => ({ id: 'aud-1' })), isAuthenticated: computed(() => true), logout: () => {}, hasRole: () => false },
        },
        { provide: TranslationService, useValue: new TranslationService() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(AuditorDashboardComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  it('creates the audit center', () => {
    expect(component).toBeTruthy();
  });

  it('maps audit logs and the total count', () => {
    expect(component.auditTotal).toBe(1);
    expect(component.auditLogs.length).toBe(1);
    expect(component.auditLogs[0].user).toBe('Tom Wilson');
    expect(component.auditLogs[0].actionBadge).toBe('badge-green');
  });

  it('maps anomaly summary and items', () => {
    expect(component.anomalySummary).toBe('One spike');
    expect(component.anomalies.length).toBe(1);
    expect(component.anomalies[0].title).toBe('Spike');
  });

  it('maps issue trends into the resolution timeline series', () => {
    expect(component.timelineLabels).toEqual(['09-01']);
    expect(component.timelineCreated).toEqual([4]);
    expect(component.timelineResolved).toEqual([1]);
  });

  it('exposes a schema-driven ER graph (8 entities, 8 relations)', () => {
    const labels = component.erNodes.map((n) => n.label);
    for (const entity of ['User', 'Department', 'Ward', 'Issue', 'Comment', 'AuditLog', 'BudgetLine', 'Expense']) {
      expect(labels).toContain(entity);
    }
    expect(component.erNodes.length).toBe(8);
    expect(component.erEdges.length).toBe(8);
  });

  it('totals the budget expenditure audit trail', () => {
    expect(apiSpy.getBudgetOverview).toHaveBeenCalled();
    expect(component.budgetTrail.length).toBe(2);
    expect(component.budgetTrailAllocated).toBe(300);
    expect(component.budgetTrailSpent).toBe(90);
  });

  it('routes the expenses export through the expenses CSV endpoint', () => {
    apiSpy.exportExpensesCsv.and.returnValue(of(new Blob(['a,b']) as any));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');
    component.exportReport('expenses');
    expect(apiSpy.exportExpensesCsv).toHaveBeenCalled();
  });
});
