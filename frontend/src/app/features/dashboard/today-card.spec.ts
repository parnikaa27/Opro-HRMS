import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { fail, NOW, respond, setupHttp, text, TODAY } from '../../../testing/fixtures';
import { TodayCard } from './today-card';

const URL = '/api/attendance?month=2026-11';
const at = (time: string) => `${TODAY}T${time}:00+05:00`;
const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
  employeeId: 'OPR-0018', date: TODAY, status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
});

describe('TodayCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (days: AttendanceDay[]) => {
    const fixture = TestBed.createComponent(TodayCard);
    await respond(http, { [URL]: days });
    return fixture.nativeElement as HTMLElement;
  };

  it('counts time live while the employee is still in', async () => {
    const element = await render([day({ punches: [{ at: at('08:50'), direction: 'in' }] })]);

    expect(text(element.querySelector('[data-testid=today-worked]') as HTMLElement)).toBe('1h 40m');
    expect(text(element)).toContain('since 08:50');
    expect(text(element.querySelector('[data-testid=today-status]') as HTMLElement)).toBe('On time');
    expect(element.querySelectorAll('[role=img] > div')).toHaveLength(1);
  });

  it('shows the last punch out once they have left', async () => {
    const element = await render([day({ status: 'late', punches: [{ at: at('09:20'), direction: 'in' }, { at: at('10:00'), direction: 'out' }] })]);

    expect(text(element.querySelector('[data-testid=today-worked]') as HTMLElement)).toBe('40m');
    expect(text(element)).toContain('last out at 10:00');
  });

  it('sums up the month', async () => {
    const element = await render([
      day({ date: '2026-11-01', status: 'present' }),
      day({ date: '2026-11-02', status: 'late' }),
      day({ date: '2026-11-03', status: 'incomplete' }),
      day({ status: 'weekend' }),
    ]);

    expect(text(element.querySelector('[data-testid=month-summary]') as HTMLElement)).toBe('This month: 1 on time, 1 late, 1 missed');
    expect(text(element)).toContain("It's the weekend");
  });

  it('handles a day with no record yet', async () => {
    expect(text(await render([]))).toContain('No punches yet');
  });

  it('shows an error when attendance fails to load', async () => {
    const fixture = TestBed.createComponent(TodayCard);
    await fail(http, URL);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=card-error]')).not.toBeNull();
  });
});
