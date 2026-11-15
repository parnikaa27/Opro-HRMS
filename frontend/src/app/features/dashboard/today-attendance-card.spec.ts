import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { NOW, respond, setupHttp, text, TODAY } from '../../../testing/fixtures';
import { TodayAttendanceCard } from './today-attendance-card';

const at = (time: string) => `${TODAY}T${time}:00+05:00`;
const DEVICES = [{ id: 'D1', name: 'Front desk', location: 'Malé office', isOnline: true, lastSyncAt: '2026-11-12T05:27:00Z' }];

describe('TodayAttendanceCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (day: AttendanceDay | undefined, devices: object[] = DEVICES) => {
    const fixture = TestBed.createComponent(TodayAttendanceCard);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('workLocation', 'Malé office');
    await respond(http, { '/api/devices': devices });
    return fixture.nativeElement as HTMLElement;
  };

  const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
    employeeId: 'E', date: TODAY, status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
  });

  it('shows time in the office, when they came in, when the shift ends, and the device sync', async () => {
    const root = await render(day({ punches: [{ at: at('08:50'), direction: 'in', device: 'Front desk' }, { at: at('09:30'), direction: 'out' }, { at: at('09:40'), direction: 'in' }], expectedOut: at('16:50'), scheduledMinutes: 480 }));

    expect(text(root.querySelector('[data-testid=today-heading]') as HTMLElement)).toBe('You’re in the office');
    expect(text(root.querySelector('.circle-progress') as HTMLElement)).toBe('1h 40m of 8 hours');
    expect(text(root.querySelector('[data-testid=punch-in]') as HTMLElement)).toBe('08:50 AM');
    expect(text(root)).toContain('EXPECTED OUT 04:50 PM 6h 20m remaining');
    expect(text(root.querySelector('[data-testid=effective-hours]') as HTMLElement)).toBe('1h 30m');
    expect(text(root.querySelector('.synced') as HTMLElement)).toBe('Biometric synced · 3 min ago');
  });

  it('shows the punch out once they have left', async () => {
    const root = await render(day({ punches: [{ at: at('07:00'), direction: 'in' }, { at: at('10:00'), direction: 'out', device: 'Front desk' }] }));

    expect(text(root.querySelector('[data-testid=today-heading]') as HTMLElement)).toBe('You’ve finished for the day');
    expect(text(root)).toContain('PUNCH OUT 10:00 AM Front desk device');
  });

  it('notices when they are past the shift', async () => {
    const root = await render(day({ punches: [{ at: '2026-11-12T00:30:00+05:00', direction: 'in' }], expectedOut: '2026-11-12T08:30:00+05:00', scheduledMinutes: 480 }));

    expect(text(root)).toContain('past your shift');
  });

  it('explains days off, absences and days not started, and an offline device', async () => {
    expect(text(await render(day({ status: 'weekend' })))).toContain('Enjoy your weekend Friday and Saturday are off.');
    expect(text(await render(day({ status: 'absent' })))).toContain('No punches today');
    expect(text(await render(undefined, [{ ...DEVICES[0], isOnline: false }]))).toContain('You haven’t punched in yet Biometric device offline Not punched in yet');
    expect((await render(undefined, [])).querySelector('.synced')).toBeNull();
  });

  it('shows a placeholder while today loads, not "you haven’t punched in yet"', async () => {
    const fixture = TestBed.createComponent(TodayAttendanceCard);
    fixture.componentRef.setInput('workLocation', 'Malé office');
    fixture.componentRef.setInput('isLoading', true);
    await respond(http, { '/api/devices': DEVICES });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid=list-loading]')).not.toBeNull();
    expect(text(root)).not.toContain('punched in');
  });

});
