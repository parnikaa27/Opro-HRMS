import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { AttendanceDay } from '../../models/attendance';
import { employee, fail, NOW, respond, setupHttp, text, texts, TODAY } from '../../../testing/fixtures';
import { DashboardPage } from './dashboard-page';

const day = (date: string, status: AttendanceDay['status'], punches: AttendanceDay['punches'] = []): AttendanceDay => ({
  employeeId: 'OPR-0018', date, status, punches, workedMinutes: punches.length ? 480 : 0, overtimeMinutes: 0,
});
const punch = (date: string, time: string, direction: 'in' | 'out') => ({ at: `${date}T${time}:00+05:00`, direction, device: 'Front desk' });

describe('DashboardPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    TestBed.inject(Session).user.set(employee());
  });

  afterEach(() => vi.useRealTimers());

  const render = async (november: AttendanceDay[], october: AttendanceDay[] = []) => {
    const fixture = TestBed.createComponent(DashboardPage);
    await respond(http, { '/api/attendance?month=2026-11': november, '/api/attendance?month=2026-10': october });
    return fixture.nativeElement as HTMLElement;
  };

  it('greets by first name with the date and a line that fits the day', async () => {
    const root = await render([day(TODAY, 'late', [punch(TODAY, '09:30', 'in')])]);

    expect(text(root.querySelector('[data-testid=page-heading]') as HTMLElement)).toBe('Overview');
    expect(text(root.querySelector('.welcome p') as HTMLElement)).toBe('Thursday, 12 November');
    expect(text(root.querySelector('[data-testid=welcome-line]') as HTMLElement)).toBe('You came in a little late today. Here’s everything you need for the day.');
  });

  it('lists the last four days, skipping weekends and reaching back into last month', async () => {
    const root = await render(
      [
        day('2026-11-01', 'present', [punch('2026-11-01', '08:50', 'in'), punch('2026-11-01', '17:10', 'out')]),
        day('2026-11-06', 'weekend'),
        day('2026-11-11', 'holiday'),
        day(TODAY, 'present', [punch(TODAY, '08:56', 'in')]),
        day('2026-11-13', 'present'),
      ],
      [day('2026-10-29', 'absent')],
    );

    expect(texts(root, 'attendance-row')).toEqual([
      'Today 12 Nov, Thu 08:56 AM — 01h 34m In office',
      'Yesterday 11 Nov, Wed — — — Holiday',
      'Sunday 1 Nov, Sun 08:50 AM 05:10 PM 08h 00m Present',
      'Thursday 29 Oct, Thu — — — Absent',
    ]);
  });

  it('falls back to a plain line when today has no record', async () => {
    const root = await render([]);

    expect(text(root.querySelector('[data-testid=welcome-line]') as HTMLElement)).toBe('Here’s everything you need for the day.');
  });

  it('says so when attendance fails to load, rather than claiming no punches', async () => {
    const fixture = TestBed.createComponent(DashboardPage);
    await fail(http, '/api/attendance?month=2026-11');
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=today-card]') as HTMLElement)).toContain("Today Today's punches didn't load Refresh the page to try again.");
    expect(text(root.querySelector('.recent-section') as HTMLElement)).toContain("Your recent attendance didn't load.");
    expect(text(root)).not.toContain('No punches recorded yet');
  });

});
