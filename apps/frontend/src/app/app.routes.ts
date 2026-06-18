import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

const admin = roleGuard('SUPER_ADMIN');
// Mirrors the backend's `authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER')`
// on /api/v1/admin/documents. Mayors, department heads, and council members
// are the people who actually upload legislation in practice — narrower than
// the global `admin` guard above.
const adminDocs = roleGuard('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER');
const mayor = roleGuard('MAYOR');
const dept = roleGuard('DEPARTMENT_HEAD');
const council = roleGuard('COUNCIL_MEMBER');
const staff = roleGuard('STAFF');
const ward = roleGuard('WARD_REP');
const citizen = roleGuard('CITIZEN');
const volunteer = roleGuard('VOLUNTEER');
const auditor = roleGuard('AUDITOR');
const media = roleGuard('MEDIA');
const auditorOrAdmin = roleGuard('AUDITOR', 'SUPER_ADMIN');

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password.component').then(m => m.ResetPasswordComponent) },
  { path: 'unauthorized', loadComponent: () => import('./features/auth/unauthorized.component').then(m => m.UnauthorizedComponent) },

  // Phase D2 — public transparency portal (no auth)
  { path: 'portal', loadComponent: () => import('./features/public/portal-page.component').then(m => m.PortalPageComponent) },
  // Phase B — public share link (no auth)
  { path: 'share/:token', loadComponent: () => import('./features/public/share-issue-page.component').then(m => m.ShareIssuePageComponent) },

  // Super Admin
  { path: 'admin', loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [authGuard, admin] },
  { path: 'admin/users', loadComponent: () => import('./features/shared/admin-users-page.component').then(m => m.AdminUsersPageComponent), canActivate: [authGuard, admin] },
  { path: 'admin/departments', loadComponent: () => import('./features/shared/admin-departments-page.component').then(m => m.AdminDepartmentsPageComponent), canActivate: [authGuard, admin] },
  { path: 'admin/wards', loadComponent: () => import('./features/shared/admin-wards-page.component').then(m => m.AdminWardsPageComponent), canActivate: [authGuard, admin] },
  { path: 'admin/documents', loadComponent: () => import('./features/admin/admin-documents-page.component').then(m => m.AdminDocumentsPageComponent), canActivate: [authGuard, adminDocs] },
  { path: 'admin/documents/browse', loadComponent: () => import('./features/admin/admin-documents-browse-page.component').then(m => m.AdminDocumentsBrowsePageComponent), canActivate: [authGuard, adminDocs] },
  { path: 'admin/settings', loadComponent: () => import('./features/shared/settings-page.component').then(m => m.SettingsPageComponent), canActivate: [authGuard, admin] },

  // Mayor
  { path: 'mayor', loadComponent: () => import('./features/mayor/mayor-dashboard.component').then(m => m.MayorDashboardComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/analytics', loadComponent: () => import('./features/shared/analytics-page.component').then(m => m.AnalyticsPageComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/resolutions', loadComponent: () => import('./features/shared/resolutions-page.component').then(m => m.ResolutionsPageComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/referendums', loadComponent: () => import('./features/shared/referendums-page.component').then(m => m.ReferendumsPageComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/polls', loadComponent: () => import('./features/shared/polls-page.component').then(m => m.PollsPageComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/calendar', loadComponent: () => import('./features/shared/events-page.component').then(m => m.EventsPageComponent), canActivate: [authGuard, mayor] },
  { path: 'mayor/announcements', loadComponent: () => import('./features/shared/announcements-page.component').then(m => m.AnnouncementsPageComponent), canActivate: [authGuard, mayor] },

  // Department Head
  { path: 'department', loadComponent: () => import('./features/department/department-dashboard.component').then(m => m.DepartmentDashboardComponent), canActivate: [authGuard, dept] },
  { path: 'department/issues', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, dept] },
  { path: 'department/staff', loadComponent: () => import('./features/shared/messages-page.component').then(m => m.MessagesPageComponent), canActivate: [authGuard, dept] },
  { path: 'department/budget', loadComponent: () => import('./features/shared/analytics-page.component').then(m => m.AnalyticsPageComponent), canActivate: [authGuard, dept] },
  { path: 'department/reports', loadComponent: () => import('./features/shared/audit-logs-page.component').then(m => m.AuditLogsPageComponent), canActivate: [authGuard, dept] },

  // Council
  { path: 'council', loadComponent: () => import('./features/council/council-dashboard.component').then(m => m.CouncilDashboardComponent), canActivate: [authGuard, council] },
  { path: 'council/resolutions', loadComponent: () => import('./features/shared/resolutions-page.component').then(m => m.ResolutionsPageComponent), canActivate: [authGuard, council] },
  { path: 'council/referendums', loadComponent: () => import('./features/shared/referendums-page.component').then(m => m.ReferendumsPageComponent), canActivate: [authGuard, council] },
  { path: 'council/constituents', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, council] },
  { path: 'council/forums', loadComponent: () => import('./features/shared/forums-page.component').then(m => m.ForumsPageComponent), canActivate: [authGuard, council] },
  { path: 'council/calendar', loadComponent: () => import('./features/shared/events-page.component').then(m => m.EventsPageComponent), canActivate: [authGuard, council] },

  // Staff
  { path: 'staff', loadComponent: () => import('./features/staff/staff-dashboard.component').then(m => m.StaffDashboardComponent), canActivate: [authGuard, staff] },
  { path: 'staff/tasks', loadComponent: () => import('./features/shared/staff-tasks-page.component').then(m => m.StaffTasksPageComponent), canActivate: [authGuard, staff] },
  { path: 'staff/completed', loadComponent: () => import('./features/shared/staff-tasks-page.component').then(m => m.StaffTasksPageComponent), canActivate: [authGuard, staff], data: { statusFilter: 'RESOLVED' } },
  { path: 'staff/notes', loadComponent: () => import('./features/shared/messages-page.component').then(m => m.MessagesPageComponent), canActivate: [authGuard, staff] },

  // Ward Rep
  { path: 'ward', loadComponent: () => import('./features/ward/ward-dashboard.component').then(m => m.WardDashboardComponent), canActivate: [authGuard, ward] },
  { path: 'ward/map', loadComponent: () => import('./features/shared/issues-map-page.component').then(m => m.IssuesMapPageComponent), canActivate: [authGuard, ward] },
  { path: 'ward/feedback', loadComponent: () => import('./features/shared/forums-page.component').then(m => m.ForumsPageComponent), canActivate: [authGuard, ward] },
  { path: 'ward/residents', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, ward] },
  { path: 'ward/events', loadComponent: () => import('./features/shared/events-page.component').then(m => m.EventsPageComponent), canActivate: [authGuard, ward] },

  // Citizen
  { path: 'citizen', loadComponent: () => import('./features/citizen/citizen-dashboard.component').then(m => m.CitizenDashboardComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/reports', loadComponent: () => import('./features/shared/issue-reports-page.component').then(m => m.IssueReportsPageComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/nearby', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/polls', loadComponent: () => import('./features/shared/polls-page.component').then(m => m.PollsPageComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/referendums', loadComponent: () => import('./features/shared/referendums-page.component').then(m => m.ReferendumsPageComponent), canActivate: [authGuard] },
  { path: 'citizen/surveys', loadComponent: () => import('./features/shared/surveys-page.component').then(m => m.SurveysPageComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/forums', loadComponent: () => import('./features/shared/forums-page.component').then(m => m.ForumsPageComponent), canActivate: [authGuard, citizen] },
  { path: 'citizen/events', loadComponent: () => import('./features/shared/events-page.component').then(m => m.EventsPageComponent), canActivate: [authGuard, citizen] },

  // Volunteer
  { path: 'volunteer', loadComponent: () => import('./features/volunteer/volunteer-dashboard.component').then(m => m.VolunteerDashboardComponent), canActivate: [authGuard, volunteer] },
  { path: 'volunteer/projects', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, volunteer] },
  { path: 'volunteer/events', loadComponent: () => import('./features/shared/events-page.component').then(m => m.EventsPageComponent), canActivate: [authGuard, volunteer] },
  { path: 'volunteer/surveys', loadComponent: () => import('./features/shared/surveys-page.component').then(m => m.SurveysPageComponent), canActivate: [authGuard, volunteer] },
  { path: 'volunteer/report', loadComponent: () => import('./features/issues/issue-create.component').then(m => m.IssueCreateComponent), canActivate: [authGuard, volunteer] },

  // Auditor
  { path: 'auditor', loadComponent: () => import('./features/auditor/auditor-dashboard.component').then(m => m.AuditorDashboardComponent), canActivate: [authGuard, auditor] },
  { path: 'auditor/logs', loadComponent: () => import('./features/shared/audit-logs-page.component').then(m => m.AuditLogsPageComponent), canActivate: [authGuard, auditorOrAdmin] },
  { path: 'auditor/anomalies', loadComponent: () => import('./features/shared/audit-logs-page.component').then(m => m.AuditLogsPageComponent), canActivate: [authGuard, auditorOrAdmin] },
  { path: 'auditor/reports', loadComponent: () => import('./features/shared/analytics-page.component').then(m => m.AnalyticsPageComponent), canActivate: [authGuard, auditor] },
  { path: 'auditor/compliance', loadComponent: () => import('./features/shared/audit-logs-page.component').then(m => m.AuditLogsPageComponent), canActivate: [authGuard, auditorOrAdmin] },

  // Media
  { path: 'media', loadComponent: () => import('./features/media/media-dashboard.component').then(m => m.MediaDashboardComponent), canActivate: [authGuard, media] },
  { path: 'media/trending', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard, media], data: { sortBy: 'upvotes' } },
  { path: 'media/stats', loadComponent: () => import('./features/shared/analytics-page.component').then(m => m.AnalyticsPageComponent), canActivate: [authGuard, media] },
  { path: 'media/reports', loadComponent: () => import('./features/shared/announcements-page.component').then(m => m.AnnouncementsPageComponent), canActivate: [authGuard, media] },
  { path: 'media/map', loadComponent: () => import('./features/shared/issues-map-page.component').then(m => m.IssuesMapPageComponent), canActivate: [authGuard, media] },

  // Shared views
  { path: 'issues', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard] },
  { path: 'issues/new', loadComponent: () => import('./features/issues/issue-create.component').then(m => m.IssueCreateComponent), canActivate: [authGuard] },
  { path: 'issues/:id', loadComponent: () => import('./features/issues/issue-detail.component').then(m => m.IssueDetailComponent), canActivate: [authGuard] },

  { path: '**', redirectTo: '/login' },
];