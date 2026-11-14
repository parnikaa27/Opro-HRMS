import { IconName } from '../../shared/ui/icon';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

export const MY_NAV: readonly NavItem[] = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Attendance', path: '/attendance', icon: 'clock' },
  { label: 'Leave', path: '/leave', icon: 'leave' },
  { label: 'Holidays', path: '/holidays', icon: 'calendar' },
  { label: 'Profile', path: '/profile', icon: 'user' },
];

export const TEAM_NAV: readonly NavItem[] = [
  { label: 'Today', path: '/team', icon: 'team' },
  { label: 'Approvals', path: '/team/approvals', icon: 'approvals' },
  { label: 'Attendance', path: '/team/attendance', icon: 'grid' },
  { label: 'Calendar', path: '/team/calendar', icon: 'calendar' },
];
