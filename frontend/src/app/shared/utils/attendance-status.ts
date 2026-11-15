import { AttendanceDay, AttendanceStatus } from '../../models/attendance';
import { Tone } from '../ui/status-pill';

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  present: { label: 'Present', tone: 'ok' },
  late: { label: 'Late', tone: 'late' },
  'half-day': { label: 'Half day', tone: 'late' },
  absent: { label: 'Absent', tone: 'danger' },
  incomplete: { label: 'Missing punch', tone: 'danger' },
  'not-in-yet': { label: 'Not in yet', tone: 'neutral' },
  'on-leave': { label: 'On leave', tone: 'leave' },
  holiday: { label: 'Holiday', tone: 'sea' },
  weekend: { label: 'Day off', tone: 'neutral' },
};

// Someone's pill for today, saying "from home" or "at a resort" when that's where they are. A declined home day is just absent.
export const statusToday = (day: AttendanceDay | undefined) => {
  const status = ATTENDANCE_STATUS[day?.status ?? 'not-in-yet'];
  if (day?.workMode === 'resort') {
    return { ...status, label: `${status.label} · at a resort` };
  }
  return day?.workMode === 'home' && day.homeStatus !== 'rejected' ? { ...status, label: `${status.label} · from home` } : status;
};
