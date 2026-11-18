import { AttendanceDay, AttendanceStatus } from '../../models/attendance';

const PERCENT = 100;
const ATTENDED: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete', 'not-in-yet'];
const LATE: readonly AttendanceStatus[] = ['late', 'half-day'];
const OFF: readonly AttendanceStatus[] = ['weekend', 'holiday', 'on-leave'];

export interface AttendanceSummary {
  workingDays: number;
  present: number;
  attendancePercent: number;
  workedMinutes: number;
  averageMinutes: number;
  onTimePercent: number;
  lateCount: number;
  // Past the shift on working days, before the HOD decides on it.
  overtimeMinutes: number;
  overtimeDays: number;
}

// The four numbers above the attendance log, for one person or a whole team.
export const summarise = (days: readonly AttendanceDay[]): AttendanceSummary => {
  const working = days.filter(({ status }) => !OFF.includes(status));
  const attended = working.filter(({ status, punches }) => ATTENDED.includes(status) && punches.length > 0);
  const lateCount = attended.filter(({ status }) => LATE.includes(status)).length;
  const workedMinutes = days.reduce((sum, { workedMinutes }) => sum + workedMinutes, 0);
  const overtime = days.filter(({ overtimeMinutes }) => overtimeMinutes > 0);
  const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * PERCENT) : 0);
  return {
    workingDays: working.length,
    present: attended.length,
    attendancePercent: share(attended.length, working.length),
    workedMinutes,
    averageMinutes: attended.length > 0 ? Math.round(workedMinutes / attended.length) : 0,
    onTimePercent: share(attended.length - lateCount, attended.length),
    lateCount,
    overtimeMinutes: overtime.reduce((sum, { overtimeMinutes }) => sum + overtimeMinutes, 0),
    overtimeDays: overtime.length,
  };
};
