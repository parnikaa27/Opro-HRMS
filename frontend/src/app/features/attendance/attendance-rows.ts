import { AttendanceDay, WorkMode } from '../../models/attendance';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { addDays, formatClock, formatHours, formatShortDate, formatWeekday, minutesWorkedSoFar } from '../../shared/utils/date-time';
import { AttendanceRow } from './attendance-table';

const EMPTY = '—';
const WEEKDAY_LETTERS = 3;

const dayName = (date: string, today: string) =>
  date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : formatWeekday(date);

const WORKING_NOW: Record<WorkMode, string> = { office: 'In office', resort: 'At a resort', home: 'Working from home' };

const HOME_NOTE: Record<NonNullable<AttendanceDay['homeStatus']>, string> = {
  pending: 'From home, waiting for approval',
  approved: 'From home',
  rejected: 'From home, not approved',
};

// One table row per day, the way the design words it: "Today", "08:56 AM", "06h 14m", "In office".
export const toAttendanceRow = (day: AttendanceDay, today: string, now = new Date()): AttendanceRow => {
  const first = day.punches[0];
  const last = day.punches.at(-1);
  // A declined home day counts as absent, so it never shows as someone at work.
  const isDeclined = day.homeStatus === 'rejected';
  const isWorkingNow = day.date === today && last?.direction === 'in' && !isDeclined;
  const isHome = day.workMode === 'home';
  return {
    date: day.date,
    day: dayName(day.date, today),
    dateLabel: `${formatShortDate(day.date)}, ${formatWeekday(day.date).slice(0, WEEKDAY_LETTERS)}`,
    punchIn: first ? formatClock(first.at) : EMPTY,
    punchOut: last?.direction === 'out' ? formatClock(last.at) : EMPTY,
    hours: day.punches.length === 0 ? EMPTY : formatHours(day.date === today && !isDeclined ? minutesWorkedSoFar(day.punches, now) : day.workedMinutes),
    status: isWorkingNow ? { label: WORKING_NOW[day.workMode ?? 'office'], tone: 'ok' } : ATTENDANCE_STATUS[day.status],
    isEdited: day.isCorrected ?? false,
    homeNote: isHome && day.homeStatus ? HOME_NOTE[day.homeStatus] : undefined,
  };
};
