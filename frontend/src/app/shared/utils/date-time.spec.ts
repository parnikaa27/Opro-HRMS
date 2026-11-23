import { NOW } from '../../../testing/fixtures';
import {
  addDays,
  formatBannerDate,
  formatClock,
  formatCompactDate,
  formatHours,
  addMonths,
  datesBetween,
  daysUntil,
  dayOfMonth,
  formatDayShort,
  formatMonth,
  formatDuration,
  formatFullDate,
  formatShortDate,
  maldivesToday,
  minutesWorkedSoFar,
  monthOf,
  weekdayOf,
  yearOf,
} from './date-time';

describe('date and time helpers', () => {
  it('reads today in Maldives time, not the machine time zone', () => {
    const lateEveningUtc = new Date('2026-11-12T20:00:00Z');

    expect(maldivesToday(lateEveningUtc)).toBe('2026-11-13');
  });

  it('formats times and dates the way people read them', () => {
    expect(formatShortDate('2026-11-12')).toBe('12 Nov');
    expect(formatClock('2026-11-12T13:05:00+05:00')).toBe('01:05 PM');
    expect(formatBannerDate('2026-11-12')).toBe('Thursday, 12 November');
    expect(formatCompactDate('2026-03-31')).toBe('31 Mar 2026');
    expect(formatHours(65)).toBe('01h 05m');
    expect(formatFullDate('2027-01-10')).toBe('10 January 2027');
  });

  it('counts whole days between dates, negative when in the past', () => {
    expect(daysUntil('2026-12-20', '2026-11-12')).toBe(38);
    expect(daysUntil('2026-11-02', '2026-11-12')).toBe(-10);
  });

  it('formats durations with and without hours', () => {
    expect(formatDuration(348)).toBe('5h 48m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('adds completed punch pairs and the running stretch since the last in', () => {
    const punches = [
      { at: '2026-11-12T08:00:00+05:00', direction: 'in' as const },
      { at: '2026-11-12T09:00:00+05:00', direction: 'out' as const },
      { at: '2026-11-12T10:00:00+05:00', direction: 'in' as const },
    ];

    expect(minutesWorkedSoFar(punches, NOW)).toBe(90);
    expect(minutesWorkedSoFar([])).toBe(0);
  });
});

describe('calendar helpers', () => {
  it('moves across months and years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('lists every date in a range, or none when it runs backwards', () => {
    expect(datesBetween('2026-11-30', '2026-12-02')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(datesBetween('2026-12-02', '2026-11-30')).toEqual([]);
  });

  it('names months, days and weekdays', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatDayShort('2026-11-12')).toBe('Thu 12 Nov');
    expect(weekdayOf('2026-11-13')).toBe(5);
    expect(dayOfMonth('2026-11-03')).toBe(3);
    expect(yearOf('2026-11-12')).toBe(2026);
    expect(monthOf('2026-11-12')).toBe('2026-11');
  });
});
