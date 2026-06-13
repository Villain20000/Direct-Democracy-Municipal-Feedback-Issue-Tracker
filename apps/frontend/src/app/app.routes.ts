import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'unauthorized', loadComponent: () => import('./features/auth/unauthorized.component').then(m => m.UnauthorizedComponent) },

  // Super Admin Dashboard
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard('SUPER_ADMIN')],
  },
  { path: 'admin/users', redirectTo: '/admin' },
  { path: 'admin/departments', redirectTo: '/admin' },
  { path: 'admin/wards', redirectTo: '/admin' },
  { path: 'admin/settings', redirectTo: '/admin' },

  // Mayor Dashboard
  {
    path: 'mayor',
    loadComponent: () => import('./features/mayor/mayor-dashboard.component').then(m => m.MayorDashboardComponent),
    canActivate: [authGuard, roleGuard('MAYOR')],
  },
  { path: 'mayor/analytics', redirectTo: '/mayor' },
  { path: 'mayor/resolutions', redirectTo: '/mayor' },
  { path: 'mayor/polls', redirectTo: '/mayor' },
  { path: 'mayor/calendar', redirectTo: '/mayor' },
  { path: 'mayor/announcements', redirectTo: '/mayor' },

  // Department Head Dashboard
  {
    path: 'department',
    loadComponent: () => import('./features/department/department-dashboard.component').then(m => m.DepartmentDashboardComponent),
    canActivate: [authGuard, roleGuard('DEPARTMENT_HEAD')],
  },
  { path: 'department/issues', redirectTo: '/department' },
  { path: 'department/staff', redirectTo: '/department' },
  { path: 'department/budget', redirectTo: '/department' },
  { path: 'department/reports', redirectTo: '/department' },

  // Council Member Dashboard
  {
    path: 'council',
    loadComponent: () => import('./features/council/council-dashboard.component').then(m => m.CouncilDashboardComponent),
    canActivate: [authGuard, roleGuard('COUNCIL_MEMBER')],
  },
  { path: 'council/resolutions', redirectTo: '/council' },
  { path: 'council/constituents', redirectTo: '/council' },
  { path: 'council/forums', redirectTo: '/council' },
  { path: 'council/calendar', redirectTo: '/council' },

  // Staff Dashboard
  {
    path: 'staff',
    loadComponent: () => import('./features/staff/staff-dashboard.component').then(m => m.StaffDashboardComponent),
    canActivate: [authGuard, roleGuard('STAFF')],
  },
  { path: 'staff/tasks', redirectTo: '/staff' },
  { path: 'staff/completed', redirectTo: '/staff' },
  { path: 'staff/notes', redirectTo: '/staff' },

  // Ward Rep Dashboard
  {
    path: 'ward',
    loadComponent: () => import('./features/ward/ward-dashboard.component').then(m => m.WardDashboardComponent),
    canActivate: [authGuard, roleGuard('WARD_REP')],
  },
  { path: 'ward/map', redirectTo: '/ward' },
  { path: 'ward/feedback', redirectTo: '/ward' },
  { path: 'ward/residents', redirectTo: '/ward' },
  { path: 'ward/events', redirectTo: '/ward' },

  // Citizen Dashboard
  {
    path: 'citizen',
    loadComponent: () => import('./features/citizen/citizen-dashboard.component').then(m => m.CitizenDashboardComponent),
    canActivate: [authGuard, roleGuard('CITIZEN')],
  },
  { path: 'citizen/reports', redirectTo: '/citizen' },
  { path: 'citizen/nearby', redirectTo: '/citizen' },
  { path: 'citizen/polls', redirectTo: '/citizen' },
  { path: 'citizen/forums', redirectTo: '/citizen' },
  { path: 'citizen/events', redirectTo: '/citizen' },

  // Volunteer Dashboard
  {
    path: 'volunteer',
    loadComponent: () => import('./features/volunteer/volunteer-dashboard.component').then(m => m.VolunteerDashboardComponent),
    canActivate: [authGuard, roleGuard('VOLUNTEER')],
  },
  { path: 'volunteer/projects', redirectTo: '/volunteer' },
  { path: 'volunteer/events', redirectTo: '/volunteer' },
  { path: 'volunteer/report', redirectTo: '/volunteer' },

  // Auditor Dashboard
  {
    path: 'auditor',
    loadComponent: () => import('./features/auditor/auditor-dashboard.component').then(m => m.AuditorDashboardComponent),
    canActivate: [authGuard, roleGuard('AUDITOR')],
  },
  { path: 'auditor/logs', redirectTo: '/auditor' },
  { path: 'auditor/anomalies', redirectTo: '/auditor' },
  { path: 'auditor/reports', redirectTo: '/auditor' },
  { path: 'auditor/compliance', redirectTo: '/auditor' },

  // Media Dashboard
  {
    path: 'media',
    loadComponent: () => import('./features/media/media-dashboard.component').then(m => m.MediaDashboardComponent),
    canActivate: [authGuard, roleGuard('MEDIA')],
  },
  { path: 'media/trending', redirectTo: '/media' },
  { path: 'media/stats', redirectTo: '/media' },
  { path: 'media/reports', redirectTo: '/media' },
  { path: 'media/map', redirectTo: '/media' },

  // Shared views
  { path: 'issues', loadComponent: () => import('./features/issues/issue-list.component').then(m => m.IssueListComponent), canActivate: [authGuard] },
  { path: 'issues/new', redirectTo: '/issues' },
  { path: 'issues/:id', loadComponent: () => import('./features/issues/issue-detail.component').then(m => m.IssueDetailComponent), canActivate: [authGuard] },

  { path: '**', redirectTo: '/login' },
];
