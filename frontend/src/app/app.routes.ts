import { Routes } from '@angular/router';
import { isManager, isSignedIn } from './core/guards';
import { Shell } from './core/layout/shell';

const notBuilt = () => import('./features/not-built/not-built-page').then((page) => page.NotBuiltPage);

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
      { path: 'holidays', title: 'Holidays · Opro HRMS', loadComponent: notBuilt },
      { path: 'profile', title: 'Profile · Opro HRMS', loadComponent: notBuilt },
      {
        path: 'team',
        canMatch: [isManager],
        children: [
          { path: '', title: 'Team · Opro HRMS', loadComponent: notBuilt },
          { path: 'approvals', title: 'Approvals · Opro HRMS', loadComponent: notBuilt },
          { path: 'attendance', title: 'Team attendance · Opro HRMS', loadComponent: notBuilt },
          { path: 'calendar', title: 'Team calendar · Opro HRMS', loadComponent: notBuilt },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
