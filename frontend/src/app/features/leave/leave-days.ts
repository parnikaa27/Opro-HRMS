import { WEEKEND_DAYS } from '../../core/config';
import { datesBetween, weekdayOf } from '../../shared/utils/date-time';

const HALF_DAY = 0.5;

export interface LeaveRange {
  from: string;
  to: string;
  isHalfDay: boolean;
}

// A preview only. The backend owns the real count.
export const countLeaveDays = ({ from, to, isHalfDay }: LeaveRange, holidays: ReadonlySet<string>) => {
  if (!from || !to || to < from) {
    return 0;
  }
  const workingDays = datesBetween(from, to).filter((date) => !WEEKEND_DAYS.includes(weekdayOf(date)) && !holidays.has(date)).length;
  return isHalfDay && workingDays > 0 ? HALF_DAY : workingDays;
};
