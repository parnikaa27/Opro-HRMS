import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { employee, fail, NOW, respond, setupHttp, text, texts, TODAY } from '../../../testing/fixtures';
import { TeamTodayPage } from './team-today-page';

const today = (status: AttendanceDay['status'], punches: AttendanceDay['punches'] = []): AttendanceDay => ({
  employeeId: 'x', date: TODAY, status, punches, workedMinutes: 0, overtimeMinutes: 0,
});

const MEMBERS = [
  { ...employee({ id: 'B', fullName: 'Priya Nair' }), today: today('late', [{ at: `${TODAY}T09:30:00+05:00`, direction: 'in' }]) },
  { ...employee({ id: 'A', fullName: 'Ahmed Zahir' }), today: today('present', [{ at: `${TODAY}T08:50:00+05:00`, direction: 'in' }, { at: `${TODAY}T10:00:00+05:00`, direction: 'out' }]) },
  { ...employee({ id: 'C', fullName: 'Rahim Uddin', visa: { workPermitNumber: 'W', visaNumber: 'V', passportLast4: '1', visaIssuedOn: '2024-11-03', visaExpiry: '2026-11-02', passportExpiry: '2027-01-01' } }), today: today('on-leave') },
  { ...employee({ id: 'D', fullName: 'Zara Ali' }) },
];

describe('TeamTodayPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (members: object[] = MEMBERS, pending: { leave: object[]; fixes: object[] } = { leave: [{}, {}], fixes: [{}] }) => {
    const fixture = TestBed.createComponent(TeamTodayPage);
    await respond(http, { '/api/team': members, '/api/team/leave-requests?status=pending': pending.leave, '/api/team/corrections?status=pending': pending.fixes });
    return fixture.nativeElement as HTMLElement;
  };

  it('counts who is in, late, missing and away, and lists people by name', async () => {
    const root = await render();

    expect(text(root)).toContain('Thursday 12 November. 4 people report to you.');
    expect(['in', 'late', 'not-in', 'leave'].map((key) => text(root.querySelector(`[data-testid=today-${key}]`) as HTMLElement))).toEqual(['2', '1', '1', '1']);
    expect(texts(root, 'team-member')).toEqual([
      'AZ Ahmed Zahir Site Engineer Left at 10:00 On time',
      'PN Priya Nair Site Engineer In since 09:30 Late',
      'RU Rahim Uddin Site Engineer On leave',
      'ZA Zara Ali Site Engineer Not in yet',
    ]);
  });

  it('points at what is waiting and at visas that need action', async () => {
    const root = await render();

    expect(texts(root, 'waiting-banner')).toEqual(['2 leave requests and 1 punch fix waiting for you']);
    expect(texts(root, 'visa-warning')).toEqual([
      "Rahim Uddin's visa expired on 2 November 2026 See details",
      "Rahim Uddin's passport expires on 1 January 2027 See details",
    ]);
  });

  it('keeps quiet on days off and when nothing is waiting', async () => {
    const root = await render([{ ...employee({ fullName: 'Solo Person' }), today: today('weekend') }], { leave: [], fixes: [] });

    expect(text(root)).toContain('1 person reports to you.');
    expect(root.querySelector('[data-testid=day-off]')).not.toBeNull();
    expect(root.querySelector('[data-testid=waiting-banner]')).toBeNull();
    expect(root.querySelector('[data-testid=today-in]')).toBeNull();
  });

  it('shows a skeleton while loading and a message on failure', async () => {
    const fixture = TestBed.createComponent(TeamTodayPage);
    TestBed.tick();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=list-loading]')).not.toBeNull();

    await fail(http, '/api/team');
    expect(text(fixture.nativeElement)).toContain("Your team didn't load");
  });

  it('has an empty state for managers with nobody yet', async () => {
    expect(text(await render([], { leave: [], fixes: [] }))).toContain('Nobody reports to you yet');
  });
});
