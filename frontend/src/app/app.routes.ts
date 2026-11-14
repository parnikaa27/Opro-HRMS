import { Routes } from '@angular/router';
import { isManager, isSignedIn } from './core/guards';
import { Shell } from './core/layout/shell';

const calendarPage = () => import('./features/calendar/calendar-page').then((page) => page.CalendarPage);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Opro HRMS',
    loadComponent: () => import('./features/login/login-page').then((page) => page.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canMatch: [isSignedIn],
    children: [
      { path: '', title: 'Home · Opro HRMS', loadComponent: () => import('./features/dashboard/dashboard-page').then((page) => page.DashboardPage) },
      { path: 'attendance', title: 'Attendance · Opro HRMS', loadComponent: () => import('./features/attendance/attendance-page').then((page) => page.AttendancePage) },
      { path: 'leave', title: 'Leave · Opro HRMS', loadComponent: () => import('./features/leave/leave-page').then((page) => page.LeavePage) },
      { path: 'calendar', title: 'Calendar · Opro HRMS', loadComponent: calendarPage },
      { path: 'holidays', redirectTo: 'calendar' },
      { path: 'documents', title: 'Documents · Opro HRMS', loadComponent: () => import('./features/documents/documents-page').then((page) => page.DocumentsPage) },
      { path: 'profile', title: 'Profile · Opro HRMS', loadComponent: () => import('./features/profile/profile-page').then((page) => page.ProfilePage) },
      {
        path: 'team',
        canMatch: [isManager],
        children: [
          { path: '', title: 'Team · Opro HRMS', loadComponent: () => import('./features/team/team-overview-page').then((page) => page.TeamOverviewPage) },
          { path: 'people', title: 'People · Opro HRMS', loadComponent: () => import('./features/team/people-page').then((page) => page.PeoplePage) },
          { path: 'approvals', title: 'Approvals · Opro HRMS', loadComponent: () => import('./features/team/approvals-page').then((page) => page.ApprovalsPage) },
          { path: 'attendance', title: 'Team attendance · Opro HRMS', loadComponent: () => import('./features/team/team-attendance-page').then((page) => page.TeamAttendancePage) },
          { path: 'calendar', title: 'Team calendar · Opro HRMS', loadComponent: calendarPage, data: { showsTeamLeave: true } },
          { path: ':employeeId', title: 'Team member · Opro HRMS', loadComponent: () => import('./features/team/team-member-page').then((page) => page.TeamMemberPage) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
