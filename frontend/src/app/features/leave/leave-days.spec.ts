import { countLeaveDays } from './leave-days';

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
