import { countLeaveDays } from './leave-days';

const HOLIDAYS = new Set(['2026-12-01']);

describe('countLeaveDays', () => {
  it('skips Fridays, Saturdays and public holidays', () => {
    // Thu 26, Sun 29, Mon 30 and Wed 2 count. Fri, Sat and the 1 December holiday don't.
    expect(countLeaveDays({ from: '2026-11-26', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(4);
  });

  it('counts a half day as half', () => {
    expect(countLeaveDays({ from: '2026-12-03', to: '2026-12-03', isHalfDay: true }, HOLIDAYS)).toBe(0.5);
  });

  it('gives nothing for a half day on a weekend', () => {
    expect(countLeaveDays({ from: '2026-12-04', to: '2026-12-04', isHalfDay: true }, HOLIDAYS)).toBe(0);
  });

  it('gives nothing for missing or backwards dates', () => {
    expect(countLeaveDays({ from: '', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(0);
    expect(countLeaveDays({ from: '2026-12-03', to: '2026-12-02', isHalfDay: false }, HOLIDAYS)).toBe(0);
  });
});
