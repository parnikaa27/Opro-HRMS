import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { NOW, setupHttp, text, TODAY } from '../../../testing/fixtures';
import { TodayAttendanceCard } from './today-attendance-card';

const at = (time: string) => `${TODAY}T${time}:00+05:00`;

describe('TodayAttendanceCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = (day: AttendanceDay | undefined) => {
    const fixture = TestBed.createComponent(TodayAttendanceCard);
    fixture.componentRef.setInput('day', day);
    TestBed.tick();
    return fixture.nativeElement as HTMLElement;
  };

  const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
    employeeId: 'E', date: TODAY, status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
  });

  it('shows time in the office, where they punched, and when the shift ends', () => {
    const root = render(day({ workMode: 'office', punches: [{ at: at('08:50'), direction: 'in', device: 'Malé office' }, { at: at('09:30'), direction: 'out' }, { at: at('09:40'), direction: 'in' }], expectedOut: at('16:50'), scheduledMinutes: 480 }));

    expect(text(root.querySelector('[data-testid=today-heading]') as HTMLElement)).toBe('You’re in the office');
    expect(text(root.querySelector('.circle-progress') as HTMLElement)).toBe('1h 40m of 8 hours');
    expect(text(root)).toContain('Punch in 08:50 AM Malé office');
    expect(text(root)).toContain('Expected out 04:50 PM 6h 20m remaining');
    expect(text(root.querySelector('[data-testid=effective-hours]') as HTMLElement)).toBe('1h 30m');
    expect(text(root.querySelector('[data-testid=punch-button]') as HTMLElement)).toBe('Punch out');
  });

  it('shows the punch out once they have left, and a punch added by hand', () => {
    const root = render(day({ punches: [{ at: at('07:00'), direction: 'in' }, { at: at('10:00'), direction: 'out', device: 'Malé office' }] }));

    expect(text(root.querySelector('[data-testid=today-heading]') as HTMLElement)).toBe('You’ve finished for the day');
    expect(text(root)).toContain('Punch in 07:00 AM Added by hand Punch out 10:00 AM Malé office');
    expect(text(root.querySelector('[data-testid=punch-button]') as HTMLElement)).toBe('Punch in');
  });

  it('says they are working from home and waiting for the manager', () => {
    const root = render(day({ workMode: 'home', homeStatus: 'pending', punches: [{ at: at('08:55'), direction: 'in', device: 'Home' }] }));

    expect(text(root.querySelector('[data-testid=today-heading]') as HTMLElement)).toBe('You’re working from home');
    expect(text(root.querySelector('[data-testid=home-note]') as HTMLElement)).toBe('Working from home. Waiting for your manager to approve the day.');
  });

  it('keeps the punches of a declined home day and says why it counts as absent', () => {
    const root = render(day({ status: 'absent', workMode: 'home', homeStatus: 'rejected', punches: [{ at: at('08:55'), direction: 'in', device: 'Home' }] }));

    expect(text(root)).not.toContain('No punches today');
    expect(text(root.querySelector('[data-testid=home-note]') as HTMLElement)).toBe('Your manager didn’t approve working from home today, so it counts as absent.');
  });

  it('notices when they are past the shift', () => {
    const root = render(day({ punches: [{ at: '2026-11-12T00:30:00+05:00', direction: 'in' }], expectedOut: '2026-11-12T08:30:00+05:00', scheduledMinutes: 480 }));

    expect(text(root)).toContain('past your shift');
  });

  it('explains days off, absences and days not started', () => {
    expect(text(render(day({ status: 'weekend' })))).toContain('Enjoy your Friday Friday is the day off. See you on Saturday.');
    expect(text(render(day({ status: 'absent' })))).toContain('No punches today If you forgot to punch, ask for a punch fix.');
    expect(text(render(day({ status: 'not-in-yet' })))).toContain('You haven’t punched in yet Punch in Not punched in yet');
    expect(render(undefined).querySelector('[data-testid=punch-button]')).toBeNull();
  });

  it('shows a placeholder while today loads, not "you haven’t punched in yet"', () => {
    const fixture = TestBed.createComponent(TodayAttendanceCard);
    fixture.componentRef.setInput('isLoading', true);
    TestBed.tick();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid=list-loading]')).not.toBeNull();
    expect(text(root)).not.toContain('punched in');
  });
});
