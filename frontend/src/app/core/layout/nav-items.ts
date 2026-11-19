import { IconName } from '../../shared/ui/icon';

export type BadgeKey = 'approvals' | 'inbox';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  isExact?: boolean;
  badge?: BadgeKey;
}

export const EMPLOYEE_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/', icon: 'dashboard', isExact: true },
  { label: 'Attendance', path: '/attendance', icon: 'fingerprint' },
  { label: 'Leave', path: '/leave', icon: 'palm' },
  { label: 'Calendar', path: '/calendar', icon: 'calendar' },
  { label: 'Documents', path: '/documents', icon: 'file' },
  { label: 'Performance', path: '/performance', icon: 'target' },
];

export const MANAGER_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/team', icon: 'dashboard', isExact: true },
  { label: 'People', path: '/team/people', icon: 'users' },
  { label: 'Attendance', path: '/team/attendance', icon: 'fingerprint' },
  { label: 'Leave', path: '/team/approvals', icon: 'userCheck', badge: 'approvals' },
  { label: 'Calendar', path: '/team/calendar', icon: 'calendar' },
  { label: 'Performance', path: '/team/performance', icon: 'target' },
];

export const COMPANY_NAV: readonly NavItem[] = [
  { label: 'People', path: '/company', icon: 'users', isExact: true },
  { label: 'Dashboard', path: '/company/dashboard', icon: 'chart' },
  { label: 'Attendance', path: '/company/attendance', icon: 'fingerprint' },
  { label: 'Leave', path: '/company/leave', icon: 'userCheck', badge: 'approvals' },
  { label: 'Calendar', path: '/company/calendar', icon: 'calendar' },
  { label: 'Reports', path: '/company/reports', icon: 'download' },
];

export const HR_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/hr', icon: 'dashboard', isExact: true },
  { label: 'Dashboard', path: '/hr/dashboard', icon: 'chart' },
  { label: 'People', path: '/hr/people', icon: 'users' },
  { label: 'Calendar', path: '/hr/calendar', icon: 'calendar' },
  { label: 'Visas', path: '/hr/visas', icon: 'globe' },
  { label: 'Inbox', path: '/hr/inbox', icon: 'mail', badge: 'inbox' },
  { label: 'Announcements', path: '/hr/announcements', icon: 'sparkles' },
  { label: 'Performance', path: '/hr/performance', icon: 'target' },
  { label: 'Policies', path: '/hr/policy', icon: 'file' },
  { label: 'Reports', path: '/hr/reports', icon: 'download' },
];
