import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { click, fail, NOW, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { TeamAttendancePage } from './team-attendance-page';

const day = (employeeId: string, employeeName: string, date: string, status: AttendanceDay['status']): AttendanceDay => ({
  employeeId, employeeName, date, status, punches: [], workedMinutes: 0, overtimeMinutes: 0,
});

describe('TeamAttendancePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  it('shows one row per person up to today, with late and missed counts', async () => {
    const fixture = TestBed.createComponent(TeamAttendancePage);
    await respond(http, {
      '/api/team/attendance?month=2026-11': [
        day('R', 'Rahim Uddin', '2026-11-10', 'absent'),
        day('R', 'Rahim Uddin', '2026-11-11', 'late'),
        day('A', 'Ahmed Zahir', '2026-11-11', 'present'),
      ],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('thead th')).toHaveLength(12 + 3);
    expect(texts(root, 'team-attendance-row').map((row) => row.replace(/ Thu.*?:| Wed.*?:| Tue.*?:/g, ''))).toEqual([
      'Ahmed Zahir On time 0 0',
      'Rahim Uddin Absent Late 1 1',
    ]);
    expect(root.querySelector('[title="Tue 10 Nov: Absent"]')?.className).toContain('bg-danger');
  });

  it('can look at a full past month', async () => {
    const fixture = TestBed.createComponent(TeamAttendancePage);
    await respond(http, { '/api/team/attendance?month=2026-11': [] });
    const root = fixture.nativeElement as HTMLElement;
    expect(text(root)).toContain('Nothing recorded for this month');

    click(root, 'previous-month');
    await respond(http, { '/api/team/attendance?month=2026-10': [day('A', 'Ahmed Zahir', '2026-10-01', 'present')] });

    expect(root.querySelectorAll('thead th')).toHaveLength(31 + 3);
  });

  it('explains when attendance fails to load', async () => {
    const fixture = TestBed.createComponent(TeamAttendancePage);
    await fail(http, '/api/team/attendance?month=2026-11');

    expect(text(fixture.nativeElement)).toContain("Team attendance didn't load");
  });
});
