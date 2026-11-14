import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { text } from '../../../testing/fixtures';
import { AttendanceDays, FixRequest } from './attendance-days';

const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
  employeeId: 'OPR-0018', date: '2026-11-12', status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
});

describe('AttendanceDays', () => {
  const render = async (days: AttendanceDay[]) => {
    const fixture = TestBed.createComponent(AttendanceDays);
    fixture.componentRef.setInput('days', days);
    const fixes: FixRequest[] = [];
    fixture.componentInstance.fix.subscribe((request) => fixes.push(request));
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, fixes };
  };

  it('shows punches and hours for work days, and only the status for quiet days', async () => {
    const { root } = await render([
      day({ punches: [{ at: '2026-11-12T08:55:00+05:00', direction: 'in' }, { at: '2026-11-12T17:05:00+05:00', direction: 'out' }], workedMinutes: 490 }),
      day({ date: '2026-11-13', status: 'weekend' }),
    ]);

    const rows = [...root.querySelectorAll('[data-testid=attendance-day]')].map((row) => text(row));
    expect(rows).toEqual(['Thu 12 Nov On time 08:55 in, 17:05 out 8h 10m', 'Fri 13 Nov Weekend']);
  });

  it('offers a fix for missed punches and absences with the right kind', async () => {
    const { root, fixes } = await render([
      day({ date: '2026-11-10', status: 'absent' }),
      day({ date: '2026-11-11', status: 'incomplete', punches: [{ at: '2026-11-11T09:00:00+05:00', direction: 'in' }] }),
    ]);

    root.querySelectorAll<HTMLButtonElement>('[data-testid=fix-day]').forEach((button) => button.click());

    expect(text(root)).toContain('No punches');
    expect(fixes).toEqual([
      { date: '2026-11-10', kind: 'missed-in' },
      { date: '2026-11-11', kind: 'missed-out' },
    ]);
  });

  it('says when a month has nothing', async () => {
    expect(text((await render([])).root)).toContain('Nothing recorded for this month');
  });
});
