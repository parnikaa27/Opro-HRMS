import { WEEKEND_DAYS } from '../../core/config';
import { addDays, datesBetween, weekdayOf, yearOf } from '../../shared/utils/date-time';

const HALF_DAY = 0.5;
const LEAP_DAY = '02-29';
const DAY_BEFORE_LEAP_DAY = '02-28';
const MONTH_DAY_START = 5;
// Longer than any run of Fridays and holidays.
const LOOK_AHEAD_DAYS = 31;

export interface LeaveRange {
  from: string;
  to: string;
  isHalfDay: boolean;
}

const isWorkingDay = (date: string, holidays: ReadonlySet<string>) => !WEEKEND_DAYS.includes(weekdayOf(date)) && !holidays.has(date);

// A preview only. The backend owns the real count.
export const countLeaveDays = ({ from, to, isHalfDay }: LeaveRange, holidays: ReadonlySet<string>) => {
  if (!from || !to || to < from) {
    return 0;
  }
  const workingDays = datesBetween(from, to).filter((date) => isWorkingDay(date, holidays)).length;
  return isHalfDay && workingDays > 0 ? HALF_DAY : workingDays;
};

// The first working day after the leave, the paper form's "I shall return to work on".
export const returnDate = (to: string, holidays: ReadonlySet<string>) =>
  datesBetween(addDays(to, 1), addDays(to, LOOK_AHEAD_DAYS)).find((date) => isWorkingDay(date, holidays)) ?? addDays(to, 1);

// Each day of the leave as the paper form marks it: the type's code, PH for a public holiday, OFF for Friday.
export const dayCodes = (from: string, to: string, code: string, holidays: ReadonlySet<string>) =>
  datesBetween(from, to).map((date) => ({
    date,
    code: holidays.has(date) ? 'PH' : WEEKEND_DAYS.includes(weekdayOf(date)) ? 'OFF' : code,
  }));

// "Annual leave" is AL, "Compensatory off" CO.
export const shortCode = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join('');

const anniversary = (joinedOn: string, year: number) => {
  const monthDay = joinedOn.slice(MONTH_DAY_START);
  const isLeapYear = addDays(`${year}-${DAY_BEFORE_LEAP_DAY}`, 1).endsWith(LEAP_DAY);
  return `${year}-${monthDay === LEAP_DAY && !isLeapYear ? DAY_BEFORE_LEAP_DAY : monthDay}`;
};

// The leave year a day falls in: from the joining anniversary to the day before the next. The server works it out the same way.
export const leaveYearOf = (joinedOn: string, day: string) => {
  const year = anniversary(joinedOn, yearOf(day)) <= day ? yearOf(day) : yearOf(day) - 1;
  return { start: anniversary(joinedOn, year), end: addDays(anniversary(joinedOn, year + 1), -1) };
};
