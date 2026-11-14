import { AttendanceStatus } from '../../models/attendance';
import { Tone } from '../ui/status-pill';

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  present: { label: 'On time', tone: 'ok' },
  late: { label: 'Late', tone: 'late' },
  'half-day': { label: 'Half day', tone: 'late' },
  absent: { label: 'Absent', tone: 'danger' },
  incomplete: { label: 'Missing punch', tone: 'danger' },
  'not-in-yet': { label: 'Not in yet', tone: 'neutral' },
  'on-leave': { label: 'On leave', tone: 'leave' },
  holiday: { label: 'Holiday', tone: 'sea' },
  weekend: { label: 'Weekend', tone: 'neutral' },
};
