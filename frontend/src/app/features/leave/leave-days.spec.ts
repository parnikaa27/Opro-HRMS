import { countLeaveDays, leaveYearOf, returnDate, shortCode } from './leave-days';

const HOLIDAYS = new Set(['2026-12-01']);

describe('countLeaveDays', () => {
  it('skips Fridays and public holidays, and counts Saturdays', () => {
    // Thu 26, Sat 28, Sun 29, Mon 30 and Wed 2 count. Friday 27 and the 1 December holiday don't.
    expect(countLeaveDays({ from: '2026-11-26', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(5);
  });

  it('counts a half day as half', () => {
    expect(countLeaveDays({ from: '2026-12-03', to: '2026-12-03', isHalfDay: true }, HOLIDAYS)).toBe(0.5);
  });

  it('gives nothing for a half day on a Friday', () => {
    expect(countLeaveDays({ from: '2026-12-04', to: '2026-12-04', isHalfDay: true }, HOLIDAYS)).toBe(0);
  });

  it('gives nothing for missing or backwards dates', () => {
    expect(countLeaveDays({ from: '', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(0);
    expect(countLeaveDays({ from: '2026-12-03', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(0);
  });
});

describe('leaveYearOf', () => {
  it('runs from the joining anniversary to the day before the next', () => {
    expect(leaveYearOf('2023-12-20', '2026-11-12')).toEqual({ start: '2025-12-20', end: '2026-12-19' });
    expect(leaveYearOf('2023-12-20', '2026-12-20')).toEqual({ start: '2026-12-20', end: '2027-12-19' });
  });

  it('starts on 28 February for someone who joined on 29 February, except in leap years', () => {
    expect(leaveYearOf('2024-02-29', '2026-06-01')).toEqual({ start: '2026-02-28', end: '2027-02-27' });
    expect(leaveYearOf('2024-02-29', '2028-03-01')).toEqual({ start: '2028-02-29', end: '2029-02-27' });
  });
});

describe('returnDate and shortCode', () => {
  it('skips Fridays and holidays to the first working day', () => {
    expect(returnDate('2026-12-03', new Set(['2026-12-05']))).toBe('2026-12-06');
  });

  it('shortens a type to its initials', () => {
    expect([shortCode('Annual leave'), shortCode('Compensatory off')]).toEqual(['AL', 'CO']);
  });
});
