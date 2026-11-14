import { IconName } from '../../shared/ui/icon';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  isExact?: boolean;
  showsPendingCount?: boolean;
}

export const EMPLOYEE_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/', icon: 'dashboard', isExact: true },
  { label: 'Attendance', path: '/attendance', icon: 'fingerprint' },
  { label: 'Leave', path: '/leave', icon: 'palm' },
  { label: 'Calendar', path: '/calendar', icon: 'calendar' },
  { label: 'Documents', path: '/documents', icon: 'file' },
];

export const MANAGER_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/team', icon: 'dashboard', isExact: true },
  { label: 'People', path: '/team/people', icon: 'users' },
  { label: 'Attendance', path: '/team/attendance', icon: 'fingerprint' },
  { label: 'Leave', path: '/team/approvals', icon: 'userCheck', showsPendingCount: true },
  { label: 'Calendar', path: '/team/calendar', icon: 'calendar' },
];
