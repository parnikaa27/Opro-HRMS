import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AttendanceDay } from '../../models/attendance';
import { click, fail, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { AttendancePage } from './attendance-page';
import { CorrectionForm } from './correction-form';

const day = (date: string, overrides: Partial<AttendanceDay> = {}): AttendanceDay => ({
  employeeId: 'OPR-0018', date, status: 'present', punches: [], workedMinutes: 480, overtimeMinutes: 10, ...overrides,
});

const NOVEMBER = [
  day('2026-11-08'),
  day('2026-11-09', { status: 'late' }),
  day('2026-11-10', { status: 'absent', workedMinutes: 0, overtimeMinutes: 0 }),
  day('2026-11-11', { status: 'on-leave', workedMinutes: 0, overtimeMinutes: 0 }),
  day('2026-11-13', { status: 'present' }),
];

describe('AttendancePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async () => {
    const fixture = TestBed.createComponent(AttendancePage);
    await respond(http, { '/api/attendance?month=2026-11': NOVEMBER, '/api/attendance/corrections': [] });
    return fixture;
  };

  const stat = (root: HTMLElement, key: string) => text(root.querySelector(`[data-testid=stat-${key}]`) as HTMLElement);

  it('sums up the month so far and hides days that have not happened', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(stat(root, 'on-time')).toBe('1');
    expect(stat(root, 'late')).toBe('1');
    expect(stat(root, 'missed')).toBe('1');
    expect(stat(root, 'leave')).toBe('1');
    expect(stat(root, 'worked')).toBe('16h 0m');
    expect(stat(root, 'overtime')).toBe('20m');
    expect(root.querySelectorAll('[data-testid=attendance-day]')).toHaveLength(4);
  });

  it('moves back a month and can return, but not past the current month', async () => {
    const root = (await render()).nativeElement as HTMLElement;
    expect((root.querySelector('[data-testid=next-month]') as HTMLButtonElement).disabled).toBe(true);

    click(root, 'previous-month');
    await respond(http, { '/api/attendance?month=2026-10': [] });
    expect(text(root.querySelector('[data-testid=month-label]') as HTMLElement)).toBe('October 2026');
    expect(text(root)).toContain('Nothing recorded for this month');

    click(root, 'next-month');
    await respond(http, { '/api/attendance?month=2026-11': NOVEMBER });
    expect(text(root.querySelector('[data-testid=month-label]') as HTMLElement)).toBe('November 2026');
  });

  it('opens the fix form for a specific day, then closes and reloads once sent', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'fix-day');
    const form = fixture.debugElement.query(By.directive(CorrectionForm));
    expect((root.querySelector('[data-testid=fix-date]') as HTMLInputElement).value).toBe('2026-11-10');

    form.componentInstance.raised.emit();
    TestBed.tick();

    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
    expect(http.match('/api/attendance/corrections')).toHaveLength(1);
  });

  it('opens a blank fix for today from the header', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    click(root, 'open-fix');

    expect((root.querySelector('[data-testid=fix-date]') as HTMLInputElement).value).toBe('2026-11-12');
  });

  it('explains when attendance or fixes fail to load', async () => {
    const fixture = TestBed.createComponent(AttendancePage);
    await fail(http, '/api/attendance?month=2026-11');
    await fail(http, '/api/attendance/corrections');

    expect(text(fixture.nativeElement)).toContain("This month's attendance didn't load");
    expect(text(fixture.nativeElement)).toContain("These didn't load");
  });
});
