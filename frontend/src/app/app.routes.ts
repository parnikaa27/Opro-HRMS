import { Routes } from '@angular/router';
import { isHr, isManager, isSignedIn, isSuperAdmin } from './core/guards';
import { Shell } from './core/layout/shell';

const peoplePage = () => import('./features/team/people-page').then((page) => page.PeoplePage);
const dashboardPage = () => import('./features/insights/dashboard-page').then((page) => page.DashboardPage);
const reportsPage = () => import('./features/insights/reports-page').then((page) => page.ReportsPage);
const approvalsPage = () => import('./features/team/approvals-page').then((page) => page.ApprovalsPage);
const attendancePage = () => import('./features/team/team-attendance-page').then((page) => page.TeamAttendancePage);
const memberPage = () => import('./features/team/team-member-page').then((page) => page.TeamMemberPage);
const employeePage = () => import('./features/hr/hr-employee-page').then((page) => page.HrEmployeePage);
const calendarPage = () => import('./features/calendar/calendar-page').then((page) => page.CalendarPage);
const teamPerformancePage = () => import('./features/performance/team-performance-page').then((page) => page.TeamPerformancePage);

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
      { path: 'performance', title: 'Performance · Opro HRMS', loadComponent: () => import('./features/performance/my-performance-page').then((page) => page.MyPerformancePage) },
      { path: 'profile', title: 'Profile · Opro HRMS', loadComponent: () => import('./features/profile/profile-page').then((page) => page.ProfilePage) },
      {
        path: 'hr',
        canMatch: [isHr],
        children: [
          { path: '', title: 'HR · Opro HRMS', loadComponent: () => import('./features/hr/hr-overview-page').then((page) => page.HrOverviewPage) },
          { path: 'dashboard', title: 'Dashboard · Opro HRMS', loadComponent: dashboardPage, data: { scope: 'hr' } },
          { path: 'reports', title: 'Reports · Opro HRMS', loadComponent: reportsPage },
          { path: 'people', title: 'People · Opro HRMS', loadComponent: peoplePage, data: { scope: 'hr' } },
          { path: 'people/new', title: 'Add a person · Opro HRMS', loadComponent: employeePage },
          { path: 'people/:employeeId/edit', title: 'Edit details · Opro HRMS', loadComponent: employeePage },
          { path: 'people/:employeeId', title: 'Person · Opro HRMS', loadComponent: () => import('./features/hr/hr-person-page').then((page) => page.HrPersonPage) },
          { path: 'calendar', title: 'Holiday calendar · Opro HRMS', loadComponent: () => import('./features/hr/hr-calendar-page').then((page) => page.HrCalendarPage) },
          { path: 'visas', title: 'Visas · Opro HRMS', loadComponent: () => import('./features/hr/hr-visas-page').then((page) => page.HrVisasPage) },
          { path: 'inbox', title: 'Inbox · Opro HRMS', loadComponent: () => import('./features/hr/hr-inbox-page').then((page) => page.HrInboxPage) },
          { path: 'announcements', title: 'Announcements · Opro HRMS', loadComponent: () => import('./features/hr/hr-announcements-page').then((page) => page.HrAnnouncementsPage) },
          { path: 'performance', title: 'Performance · Opro HRMS', loadComponent: () => import('./features/performance/hr-performance-page').then((page) => page.HrPerformancePage) },
          { path: 'policy', title: 'Policies · Opro HRMS', loadComponent: () => import('./features/hr/hr-policy-page').then((page) => page.HrPolicyPage) },
        ],
      },
      {
        path: 'team',
        canMatch: [isManager],
        children: [
          { path: '', title: 'Team · Opro HRMS', loadComponent: () => import('./features/team/team-overview-page').then((page) => page.TeamOverviewPage) },
          { path: 'people', title: 'People · Opro HRMS', loadComponent: peoplePage, data: { scope: 'team' } },
          { path: 'approvals', title: 'Approvals · Opro HRMS', loadComponent: approvalsPage, data: { scope: 'team' } },
          { path: 'attendance', title: 'Team attendance · Opro HRMS', loadComponent: attendancePage, data: { scope: 'team' } },
          { path: 'calendar', title: 'Team calendar · Opro HRMS', loadComponent: calendarPage, data: { showsTeamLeave: true, scope: 'team' } },
          { path: 'performance', title: 'Team performance · Opro HRMS', loadComponent: teamPerformancePage, data: { scope: 'team' } },
          { path: ':employeeId', title: 'Team member · Opro HRMS', loadComponent: memberPage, data: { scope: 'team' } },
        ],
      },
      {
        path: 'company',
        canMatch: [isSuperAdmin],
        children: [
          { path: '', title: 'Everyone · Opro HRMS', loadComponent: peoplePage, data: { scope: 'company' } },
          { path: 'dashboard', title: 'Dashboard · Opro HRMS', loadComponent: dashboardPage, data: { scope: 'company' } },
          { path: 'reports', title: 'Reports · Opro HRMS', loadComponent: reportsPage },
          { path: 'attendance', title: 'Company attendance · Opro HRMS', loadComponent: attendancePage, data: { scope: 'company' } },
          { path: 'leave', title: 'All leave · Opro HRMS', loadComponent: approvalsPage, data: { scope: 'company' } },
          { path: 'calendar', title: 'Who’s away · Opro HRMS', loadComponent: calendarPage, data: { showsTeamLeave: true, scope: 'company' } },
          { path: 'performance', title: 'Performance · Opro HRMS', loadComponent: teamPerformancePage, data: { scope: 'company' } },
          { path: ':employeeId', title: 'Person · Opro HRMS', loadComponent: memberPage, data: { scope: 'company' } },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
