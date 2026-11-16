import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { AttendanceDay } from '../../models/attendance';
import { click, employee, fill, manager, NOW, respond, setupHttp, settle, text, texts, TODAY } from '../../../testing/fixtures';
import { TeamOverviewPage } from './team-overview-page';

const today = (status: AttendanceDay['status'], first?: string): AttendanceDay => ({
  employeeId: 'x', date: TODAY, status, punches: first ? [{ at: `${TODAY}T${first}:00+05:00`, direction: 'in' }] : [], workedMinutes: 0,
});
const record = (employeeId: string, date: string, status: AttendanceDay['status']): AttendanceDay => ({
  employeeId, date, status, punches: status === 'present' || status === 'late' ? [{ at: `${date}T09:00:00+05:00`, direction: 'in' }] : [], workedMinutes: 0,
});

const VISA = { workPermitNumber: 'W', visaNumber: 'V', passportLast4: '1', visaIssuedOn: '2024-11-03', visaExpiry: '2026-11-02', passportExpiry: '2026-12-01' };
const MEMBERS = [
  { ...employee({ id: 'B', fullName: 'Priya Nair' }), today: today('late', '09:30') },
  { ...employee({ id: 'A', fullName: 'Karan Mehta' }), today: today('present', '08:50') },
  { ...employee({ id: 'C', fullName: 'Rohit Verma', visa: VISA }), today: today('on-leave') },
];
const PENDING = [
  { id: 'LR-2', employeeId: 'B', employeeName: 'Priya Nair', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Home', status: 'pending', appliedOn: '2026-11-11' },
  { id: 'LR-1', employeeId: 'A', employeeName: 'Karan Mehta', type: 'annual', from: '2026-12-01', to: '2026-12-01', days: 1, reason: 'Wedding', status: 'pending', appliedOn: '2026-11-09' },
];

describe('TeamOverviewPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    TestBed.inject(Session).user.set(manager());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async (members: object[] = MEMBERS, pending: object[] = PENDING) => {
    const fixture = TestBed.createComponent(TeamOverviewPage);
    await respond(http, {
      '/api/team': members,
      '/api/team/leave-requests?status=pending': pending,
      '/api/team/corrections?status=pending': [{ id: 'AC-1' }],
      '/api/team/attendance?month=2026-11': [record('A', '2026-11-11', 'holiday'), record('A', TODAY, 'present'), record('B', TODAY, 'late'), record('C', TODAY, 'on-leave')],
      '/api/team/attendance?month=2026-10': [record('A', '2026-10-01', 'present'), record('A', '2026-10-02', 'absent')],
      '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
    });
    return fixture.nativeElement as HTMLElement;
  };

  const stat = (root: HTMLElement, key: string) => text(root.querySelector(`[data-testid=stat-${key}]`) as HTMLElement);

  it('greets the manager and sums up the team', async () => {
    const root = await render();

    expect(text(root.querySelector('[data-testid=greeting]') as HTMLElement)).toBe('Good morning, Vikram.');
    expect(text(root.querySelector('[data-testid=welcome-line]') as HTMLElement)).toBe('Your team is looking good today. 2 of 3 people are checked in.');
    expect([stat(root, 'members'), stat(root, 'pending'), stat(root, 'attendance'), stat(root, 'away')]).toEqual(['3', '3', '100%', '1']);
    expect(text(root)).toContain('+50 pts on last month');
  });

  it('lists the oldest waiting leave, the team today, and visas that need action', async () => {
    const root = await render();

    expect(texts(root, 'pending-leave').map((item) => item.split(' 1 December')[0].split(' 20 Dec')[0])).toEqual(['KM Karan Mehta Annual leave · Wedding', 'PN Priya Nair Annual leave · Home']);
    expect(texts(root, 'team-member')).toEqual([
      'KM Karan Mehta Site Engineer Present 08:50 AM',
      'PN Priya Nair Site Engineer Late 09:30 AM',
      'RV Rohit Verma Site Engineer On leave All day',
    ]);
    expect(texts(root, 'visa-alert')).toEqual(['RV Rohit Verma Visa expired 02 Nov 2026 Expired', 'RV Rohit Verma Passport expires 01 Dec 2026 19 days']);
  });

  it('charts every working day of the month, with future days faint', async () => {
    const root = await render();
    const bars = [...root.querySelectorAll<HTMLElement>('.chart-area i')];

    expect(bars).toHaveLength(26);
    expect(bars.filter((bar) => bar.classList.contains('today'))).toHaveLength(1);
    expect(bars.filter((bar) => bar.classList.contains('future')).length).toBeGreaterThan(10);
    expect([...root.querySelectorAll('.chart-labels span')].map((label) => text(label))).toEqual(['1 Nov', '10 Nov', '19 Nov', '30 Nov']);
  });

  it('approves in one click and declines with a reason', async () => {
    const root = await render();

    click(root, 'approve');
    http.expectOne('/api/team/leave-requests/LR-1/decision').flush({});
    await settle();

    click(root, 'reject');
    fill(root, 'decision-note', 'Wedding season, sorry');
    click(root, 'confirm-reject');
    expect(http.expectOne('/api/team/leave-requests/LR-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Wedding season, sorry' });
  });

  it('says when a decision fails to save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'approve');
    http.expectOne('/api/team/leave-requests/LR-1/decision').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('.request-list [role=alert]')).not.toBeNull();
  });

  it('exports the daily numbers', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'export-report');

    expect(clicked).toHaveBeenCalled();
  });

  it('keeps calm on a day off and when nothing is waiting', async () => {
    const root = await render([{ ...employee({ fullName: 'Solo' }), today: today('weekend') }], []);

    expect(text(root.querySelector('[data-testid=welcome-line]') as HTMLElement)).toBe('Nobody’s expected in today. Here’s what’s waiting for you.');
    expect(text(root)).toContain('Nothing waiting for you.');
    expect(text(root)).toContain('No visas or passports need attention.');
  });
});
