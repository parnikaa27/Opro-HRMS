import { MALDIVES_TIME_ZONE } from '../../core/config';
import { Punch } from '../../models/attendance';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
const YEAR_LENGTH = 4;
const MONTH_LENGTH = 7;
const DATE_LENGTH = 10;

// Times come from the device in Maldives time. Date only strings ("2026-11-12") are read as UTC so they never shift a day.
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: MALDIVES_TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MALDIVES_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MALDIVES_TIME_ZONE, hour: 'numeric', hourCycle: 'h23' });
const longDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const fullDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const weekdayDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

const dateOnly = (date: string) => new Date(`${date}T00:00:00Z`);

export const maldivesToday = (now = new Date()) => dayFormat.format(now);
export const maldivesHour = (now = new Date()) => Number(hourFormat.format(now));
export const yearOf = (date: string) => Number(date.slice(0, YEAR_LENGTH));
export const monthOf = (date: string) => date.slice(0, MONTH_LENGTH);
export const weekdayOf = (date: string) => dateOnly(date).getUTCDay();

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatLongDate = (date: string) => longDateFormat.format(dateOnly(date));
export const formatShortDate = (date: string) => shortDateFormat.format(dateOnly(date));
export const formatFullDate = (date: string) => fullDateFormat.format(dateOnly(date));
export const formatDayShort = (date: string) => weekdayDateFormat.format(dateOnly(date));
export const formatMonth = (month: string) => monthFormat.format(dateOnly(`${month}-01`));

export const daysUntil = (date: string, today: string) =>
  Math.round((dateOnly(date).getTime() - dateOnly(today).getTime()) / MS_PER_DAY);

export const addDays = (date: string, days: number) =>
  new Date(dateOnly(date).getTime() + days * MS_PER_DAY).toISOString().slice(0, DATE_LENGTH);

export const addMonths = (month: string, months: number) => {
  const first = dateOnly(`${month}-01`);
  first.setUTCMonth(first.getUTCMonth() + months);
  return monthOf(first.toISOString());
};

export const datesBetween = (from: string, to: string) =>
  Array.from({ length: Math.max(0, daysUntil(to, from) + 1) }, (_, index) => addDays(from, index));

export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
};

export const minuteOfDay = (iso: string) => {
  const [hours, minutes] = formatTime(iso).split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

const minutesBetween = (from: string, to: Date) => Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / MS_PER_MINUTE));

// Completed in and out pairs, plus the running stretch when the last punch is an "in".
export const minutesWorkedSoFar = (punches: Punch[], now = new Date()) =>
  punches.reduce(
    (total, punch, index) =>
      punch.direction === 'in' ? total + minutesBetween(punch.at, new Date(punches[index + 1]?.at ?? now)) : total,
    0,
  );
