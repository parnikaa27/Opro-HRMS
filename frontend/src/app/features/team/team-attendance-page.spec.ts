import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { click, fail, fill, NOW, respond, setupHttp, text, texts, TODAY } from '../../../testing/fixtures';
import { TeamAttendancePage } from './team-attendance-page';

const day = (employeeId: string, employeeName: string, date: string, status: AttendanceDay['status'], workedMinutes = 0): AttendanceDay => ({
  employeeId, employeeName, date, status, punches: workedMinutes ? [{ at: `${date}T09:00:00+05:00`, direction: 'in' }] : [], workedMinutes, overtimeMinutes: 0,
});

const NOVEMBER = [
  day('R', 'Rahim Uddin', '2026-11-10', 'absent'),
  day('R', 'Rahim Uddin', TODAY, 'late', 300),
  day('A', 'Ahmed Zahir', TODAY, 'present', 480),
  day('A', 'Ahmed Zahir', '2026-11-20', 'present', 480),
];

describe('TeamAttendancePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(TeamAttendancePage);
    await respond(http, { '/api/team/attendance?month=2026-11': NOVEMBER, '/api/devices': [] });
    return fixture.nativeElement as HTMLElement;
  };

  it('sums up the team and gives one row per person with today’s status', async () => {
    const root = await render();

    expect(text(root.querySelector('[data-testid=metric-present]') as HTMLElement)).toBe('2 / 3');
    expect(texts(root, 'team-attendance-row')).toEqual([
      'AZ Ahmed Zahir 1 / 1 0 0 08h 00m Present',
      'RU Rahim Uddin 1 / 2 1 1 05h 00m Late',
    ]);
    expect(root.querySelector('[data-testid=team-attendance-row] a')?.getAttribute('href')).toBe('/team/A');
  });

  it('shows on time rates instead of today for past months', async () => {
    const root = await render();

    fill(root, 'month-picker', '2026-10');
    await respond(http, { '/api/team/attendance?month=2026-10': [day('A', 'Ahmed Zahir', '2026-10-05', 'late', 480)] });

    expect(texts(root, 'team-attendance-row')).toEqual(['AZ Ahmed Zahir 1 / 1 1 0 08h 00m 0%']);
  });

  it('exports the table and says when a month is empty', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'export-report');
    expect(clicked).toHaveBeenCalled();

    fill(root, 'month-picker', '2026-09');
    await respond(http, { '/api/team/attendance?month=2026-09': [] });
    expect(text(root)).toContain('Nothing recorded for this month.');
  });

  it('explains when attendance fails to load', async () => {
    const fixture = TestBed.createComponent(TeamAttendancePage);
    await fail(http, '/api/team/attendance?month=2026-11');

    expect(text(fixture.nativeElement)).toContain("Team attendance didn't load");
  });
});
