import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Session } from '../../core/session';
import { AttendanceDay, OvertimeClaim } from '../../models/attendance';
import { click, employee, fail, fill, NOW, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { AttendancePage } from './attendance-page';
import { CorrectionForm } from './correction-form';

const punch = (date: string, time: string, direction: 'in' | 'out') => ({ at: `${date}T${time}:00+05:00`, direction });
const day = (date: string, overrides: Partial<AttendanceDay> = {}): AttendanceDay => ({
  employeeId: 'OPR-0018', date, status: 'present', punches: [punch(date, '08:55', 'in'), punch(date, '17:10', 'out')], workedMinutes: 480, overtimeMinutes: 0, ...overrides,
});

const NOVEMBER = [
  day('2026-11-08', { overtimeMinutes: 70 }),
  day('2026-11-09', { status: 'late', punches: [punch('2026-11-09', '09:30', 'in'), punch('2026-11-09', '17:00', 'out')]}),
  day('2026-11-10', { status: 'absent', punches: [], workedMinutes: 0}),
  day('2026-11-11', { status: 'on-leave', punches: [], workedMinutes: 0}),
  day('2026-11-06', { status: 'weekend', punches: [], workedMinutes: 0}),
  day('2026-11-13'),
];

const OVERTIME: OvertimeClaim[] = [
  { id: 'OT-1', employeeId: 'OPR-0018', date: '2026-11-08', status: 'pending', minutes: 70 },
  { id: 'OT-2', employeeId: 'OPR-0018', date: '2026-11-05', status: 'rejected', minutes: 45 },
  { id: 'OT-3', employeeId: 'OPR-0018', date: '2026-10-20', status: 'approved', minutes: 60 },
];

describe('AttendancePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    TestBed.inject(Session).user.set(employee({ workLocation: 'Malé office' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(AttendancePage);
    await respond(http, { '/api/attendance?month=2026-11': NOVEMBER, '/api/attendance/corrections': [], '/api/attendance/overtime': OVERTIME });
    return fixture;
  };

  const metric = (root: HTMLElement, key: string) => text(root.querySelector(`[data-testid=metric-${key}]`) as HTMLElement);

  it('punches from the log while today is on screen, and shows the new punch', async () => {
    const fixture = TestBed.createComponent(AttendancePage);
    const today = day('2026-11-12', { status: 'not-in-yet', punches: [] });
    await respond(http, { '/api/attendance?month=2026-11': [...NOVEMBER, today], '/api/attendance/corrections': [] });
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'punch-button');
    click(root, 'punch-home');
    await settle();
    http.expectOne('/api/attendance/punch').flush({ ...today, workMode: 'home' });
    await settle();

    expect(http.match('/api/attendance?month=2026-11')).toHaveLength(1);
  });

  it('sums up the month so far and lists working days, newest first', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(metric(root, 'present')).toBe('2 / 3');
    expect(metric(root, 'hours')).toBe('16h 0m');
    expect(metric(root, 'on-time')).toBe('50%');
    // The declined day in October and the declined one this month don't count; only the 8th, still waiting, does.
    expect(metric(root, 'overtime')).toBe('1h 10m');
    expect(metric(root, 'overtime-line')).toBe('0m approved, 1h 10m waiting');
    expect(texts(root, 'attendance-row').map((row) => row.split(' ')[0])).toEqual(['Yesterday', 'Tuesday', 'Monday', 'Sunday']);
    expect(text(root)).toContain('NOVEMBER 2026 Attendance log');
  });

  it('switches month from the date chip', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    fill(root, 'month-picker', '2026-10');
    await respond(http, { '/api/attendance?month=2026-10': [] });

    expect(text(root)).toContain('OCTOBER 2026 Attendance log');
    expect(text(root)).toContain('No punches recorded yet.');
  });

  it('exports the month as a CSV file', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const root = (await render()).nativeElement as HTMLElement;

    click(root, 'export-report');

    expect(createUrl).toHaveBeenCalled();
    expect(clicked).toHaveBeenCalled();
  });

  it('opens the fix form, shows the success screen, and reloads fixes', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'open-fix');
    fixture.debugElement.query(By.directive(CorrectionForm)).componentInstance.raised.emit();
    TestBed.tick();
    expect(text(root.querySelector('[data-testid=success-state]') as HTMLElement)).toContain('Fix requested');
    expect(http.match('/api/attendance/corrections')).toHaveLength(1);

    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('explains when attendance or fixes fail to load', async () => {
    const fixture = TestBed.createComponent(AttendancePage);
    await fail(http, '/api/attendance?month=2026-11');
    await fail(http, '/api/attendance/corrections');

    expect(text(fixture.nativeElement)).toContain("This month's attendance didn't load");
    expect(text(fixture.nativeElement)).toContain("Your punch fixes didn't load");
  });
});
