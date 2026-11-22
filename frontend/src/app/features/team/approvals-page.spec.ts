import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CompOffClaim, CorrectionRequest, HomeDay, OvertimeClaim } from '../../models/attendance';
import { Resignation } from '../../models/exit';
import { LeaveRequest } from '../../models/leave';
import { click, fail, fill, NOW, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { ApprovalsPage } from './approvals-page';

const leave = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR', employeeId: 'E', employeeName: 'Person', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10', ...overrides,
});
const fix = (overrides: Partial<CorrectionRequest>): CorrectionRequest => ({
  id: 'AC', employeeId: 'E', employeeName: 'Person', date: '2026-11-10', kind: 'missed-out', category: 'forgot', requestedTime: '17:20', reason: 'Device offline', status: 'pending', raisedOn: '2026-11-11', ...overrides,
});

const LEAVE = [
  leave({ id: 'LR-2', employeeId: 'P', employeeName: 'Priya Nair', appliedOn: '2026-11-11' }),
  leave({ id: 'LR-1', employeeId: 'M', employeeName: 'Sneha Kulkarni', from: '2026-12-22', to: '2026-12-22', days: 1, appliedOn: '2026-11-12' }),
  leave({ id: 'LR-3', employeeId: 'A', employeeName: 'Karan Mehta', status: 'approved', from: '2026-12-23', to: '2026-12-23', days: 1, decidedOn: '2026-11-05', appliedOn: '2026-11-01' }),
  leave({ id: 'LR-4', employeeId: 'G', employeeName: 'Kavya Menon', status: 'rejected', decidedOn: '2026-11-07', decisionNote: 'Audit week' }),
];
const FIXES = [fix({ id: 'AC-1', employeeName: 'Rohit Verma' }), fix({ id: 'AC-2', status: 'approved' })];
const HOME_DAYS: HomeDay[] = [{ id: 'HW-1', employeeId: 'K', employeeName: 'Arjun Reddy', date: '2026-11-12', status: 'pending' }];
const COMP_OFFS: CompOffClaim[] = [{ id: 'CO-1', employeeId: 'R', employeeName: 'Rohit Verma', date: '2026-11-06', status: 'pending', days: 0.5, workedMinutes: 130 }];
const OVERTIME: OvertimeClaim[] = [
  { id: 'OT-2', employeeId: 'R', employeeName: 'Rohit Verma', date: '2026-11-10', status: 'pending', minutes: 0 },
  { id: 'OT-1', employeeId: 'A', employeeName: 'Arjun Reddy', date: '2026-11-09', status: 'pending', minutes: 80 },
];

// Arjun waits for Vikram; Priya's already went on to HR, so it isn't Vikram's to decide.
const RESIGNATIONS: Resignation[] = [
  { id: 'RS-1', employeeId: 'OPR-0018', employeeName: 'Arjun Reddy', submittedOn: '2026-11-10', reason: 'Moving back home', releaseOn: '2026-12-31', status: 'pending', checklist: [] },
  {
    id: 'RS-2', employeeId: 'OPR-0015', employeeName: 'Priya Nair', submittedOn: '2026-11-09', reason: 'New job', releaseOn: '2026-12-15', status: 'pending',
    hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-10', checklist: [],
  },
];

describe('ApprovalsPage', () => {
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

  const render = async (leaveRequests: LeaveRequest[] = LEAVE, fixes: CorrectionRequest[] = FIXES, homeDays: HomeDay[] = HOME_DAYS, compOffs: CompOffClaim[] = COMP_OFFS, overtime: OvertimeClaim[] = OVERTIME) => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await respond(http, {
      '/api/team/leave-requests': leaveRequests,
      '/api/team/corrections': fixes,
      '/api/team/home-days?status=pending': homeDays,
      '/api/team/comp-offs?status=pending': compOffs,
      '/api/team/overtime?status=pending': overtime,
      '/api/team/resignations?status=pending': RESIGNATIONS,
      '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
    });
    return fixture.nativeElement as HTMLElement;
  };

  const row = (root: HTMLElement, name: string) =>
    [...root.querySelectorAll<HTMLElement>('[data-testid=leave-row]')].find((item) => text(item.querySelector('strong') as HTMLElement) === name) as HTMLElement;

  it('shows waiting leave oldest first with counts on the tabs and overlap warnings', async () => {
    const root = await render();

    expect([...root.querySelectorAll('[role=tab]')].map((tab) => text(tab))).toEqual(['Pending 2', 'Approved', 'Declined', 'Punch fixes 1', 'Home working 1', 'Comp off 1', 'Overtime 2', 'Resignations 1']);
    expect(texts(root, 'leave-row').map((item) => item.split(' Decline')[0])).toEqual([
      'PN Priya Nair Annual leave · Submitted yesterday Also off then: Sneha Kulkarni (pending), Karan Mehta DATES 20 Dec to 24 December 2026 DURATION 3 days REASON Trip',
      'SK Sneha Kulkarni Annual leave · Submitted today Also off then: Priya Nair (pending) DATES 22 December 2026 DURATION 1 day REASON Trip',
    ]);
  });

  it('shows decided requests on their own tabs with the manager note', async () => {
    const root = await render();

    click(root, 'tab-approved');
    expect(texts(root, 'leave-row')).toEqual(['KM Karan Mehta Annual leave · Submitted 11 days ago DATES 23 December 2026 DURATION 1 day REASON Trip Approved']);
    click(root, 'tab-rejected');
    expect(texts(root, 'leave-row')[0]).toContain('YOUR NOTE Audit week Declined');
  });

  it('approves in one click and reloads', async () => {
    const root = await render();

    click(row(root, 'Sneha Kulkarni'), 'approve');
    const request = http.expectOne('/api/team/leave-requests/LR-1/decision');
    expect(request.request.body).toEqual({ decision: 'approved' });
    request.flush({});
    await settle();

    expect(http.match('/api/team/leave-requests')).toHaveLength(1);
  });

  it('asks for a reason before declining a punch fix', async () => {
    const root = await render();
    click(root, 'tab-fixes');
    expect(texts(root, 'pending-fix')[0]).toContain('Rohit Verma Forgot to punch · punch out · Submitted yesterday DATE Tue 10 Nov TIME 17:20 REASON Device offline');

    click(root, 'reject');
    expect(text(root.querySelector('dialog') as HTMLElement)).toContain('Decline Rohit’s request?');
    click(root, 'confirm-reject');
    expect(text(root.querySelector('.field-error') as HTMLElement)).toBe('Give a short reason so they know what to do next.');

    fill(root, 'decision-note', ' The log shows 16:30 ');
    click(root, 'confirm-reject');
    const request = http.expectOne('/api/team/corrections/AC-1/decision');
    expect(request.request.body).toEqual({ decision: 'rejected', note: 'The log shows 16:30' });
    request.flush({});
    await settle();
    expect(http.match('/api/team/corrections')).toHaveLength(1);
  });

  it('approves a punch fix, declines leave, and can back out of declining', async () => {
    const root = await render();

    click(row(root, 'Priya Nair'), 'reject');
    ([...root.querySelectorAll('dialog button')].find((button) => text(button) === 'Cancel') as HTMLButtonElement).click();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);

    click(row(root, 'Priya Nair'), 'reject');
    fill(root, 'decision-note', 'Busy week');
    click(root, 'confirm-reject');
    http.expectOne('/api/team/leave-requests/LR-2/decision').flush({});
    await settle();

    click(root, 'tab-fixes');
    click(root, 'approve');
    http.expectOne('/api/team/corrections/AC-1/decision').flush({});
    await settle();
  });

  it('keeps the request and says so when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(row(root, 'Priya Nair'), 'approve');
    http.expectOne('/api/team/leave-requests/LR-2/decision').flush('', { status: 409, statusText: 'Conflict' });
    await settle();

    expect(row(root, 'Priya Nair').querySelector('[role=alert]')).not.toBeNull();
  });

  it('says when each tab is empty', async () => {
    const root = await render([], [], [], [], []);

    expect(text(root)).toContain('Nothing waiting for you.');
    click(root, 'tab-fixes');
    expect(text(root)).toContain('No punch fixes waiting for you.');
    click(root, 'tab-home');
    expect(text(root)).toContain('Nobody is waiting for a home working decision.');
    click(root, 'tab-comp-off');
    expect(text(root)).toContain('Nobody worked a day off that needs compensatory off.');
    click(root, 'tab-overtime');
    expect(text(root)).toContain('Nobody stayed past the shift long enough to count.');
  });

  it('gives compensatory off for a day off worked, or declines it with a reason', async () => {
    const root = await render();
    click(root, 'tab-comp-off');
    expect(texts(root, 'pending-comp-off')[0]).toContain('Rohit Verma Worked on a day off DATE Fri 6 Nov WORKED 2h 10m EARNS Half a day');

    click(root, 'approve');
    const approval = http.expectOne('/api/team/comp-offs/CO-1/decision');
    expect(approval.request.body).toEqual({ decision: 'approved' });
    approval.flush({});
    await settle();

    click(root, 'reject');
    fill(root, 'decision-note', 'Nobody asked you to come in');
    click(root, 'confirm-reject');
    expect(http.expectOne('/api/team/comp-offs/CO-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Nobody asked you to come in' });
  });

  it('shows what waits for HR without asking the HOD again, and leaves it out of the counts', async () => {
    const root = await render(
      [...LEAVE, leave({ id: 'LR-5', employeeId: 'V', employeeName: 'Karan Mehta', hodApprovedOn: '2026-11-11' })],
      [...FIXES, fix({ id: 'AC-3', hodApprovedOn: '2026-11-11' })],
    );

    expect(text(root.querySelector('[data-testid=tab-pending]') as HTMLElement)).toBe('Pending 2');
    expect(text(root.querySelector('[data-testid=tab-fixes]') as HTMLElement)).toBe('Punch fixes 1');
    const waiting = row(root, 'Karan Mehta');
    expect(text(waiting)).toContain('Waiting for HR');
    expect(waiting.querySelector('[data-testid=approve]')).toBeNull();
  });

  it('approves overtime oldest first, and only while the punches still show it', async () => {
    const root = await render();
    click(root, 'tab-overtime');
    expect(texts(root, 'pending-overtime')).toEqual([
      expect.stringContaining('Arjun Reddy Stayed past the shift DATE Mon 9 Nov OVERTIME 1h 20m'),
      expect.stringContaining('Rohit Verma Stayed past the shift DATE Tue 10 Nov OVERTIME Under 30 minutes now'),
    ]);
    const approve = [...root.querySelectorAll<HTMLButtonElement>('[data-testid=approve]')];
    expect(approve.map(({ disabled }) => disabled)).toEqual([false, true]);

    approve[0].click();
    const approval = http.expectOne('/api/team/overtime/OT-1/decision');
    expect(approval.request.body).toEqual({ decision: 'approved' });
    approval.flush({});
    await settle();
    expect(http.match('/api/team/overtime?status=pending')).toHaveLength(1);
  });

  it('asks why before declining overtime', async () => {
    const root = await render();
    click(root, 'tab-overtime');

    click(root, 'reject');
    expect((root.querySelector('[data-testid=decision-note]') as HTMLTextAreaElement).placeholder).toBe('The delivery was moved to the next day, so staying late wasn’t needed.');
    fill(root, 'decision-note', 'Not needed that day');
    click(root, 'confirm-reject');

    expect(http.expectOne('/api/team/overtime/OT-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Not needed that day' });
  });

  it('approves a day worked from home in one click', async () => {
    const root = await render();
    click(root, 'tab-home');
    expect(texts(root, 'pending-home-day')[0]).toContain('Arjun Reddy Worked from home DATE Thu 12 Nov IF DECLINED The day counts as absent');

    click(root, 'approve');
    const request = http.expectOne('/api/team/home-days/HW-1/decision');
    expect(request.request.body).toEqual({ decision: 'approved' });
    request.flush({});
    await settle();
    expect(http.match('/api/team/home-days?status=pending')).toHaveLength(1);
  });

  it('asks why before declining a day worked from home', async () => {
    const root = await render();
    click(root, 'tab-home');

    click(root, 'reject');
    expect((root.querySelector('[data-testid=decision-note]') as HTMLTextAreaElement).placeholder).toBe('We had the site visit today, so I needed you in the office.');
    fill(root, 'decision-note', 'Site visit today');
    click(root, 'confirm-reject');

    const request = http.expectOne('/api/team/home-days/HW-1/decision');
    expect(request.request.body).toEqual({ decision: 'rejected', note: 'Site visit today' });
    request.flush({});
    await settle();
  });

  it('tells a manager a certificate is attached, without a way to open it', async () => {
    const root = await render([leave({ id: 'LR-7', type: 'sick', hasCertificate: true })]);

    expect(text(root.querySelector('[data-testid=certificate]') as HTMLElement)).toBe('Medical certificate attached');
    expect(root.querySelector('[data-testid=certificate] a')).toBeNull();
  });

  it('lets a super admin step in on anyone’s request across Opro', async () => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    fixture.componentRef.setInput('scope', 'company');
    await respond(http, {
      '/api/company/leave-requests': LEAVE,
      '/api/company/corrections': FIXES,
      '/api/company/home-days?status=pending': HOME_DAYS,
      '/api/company/comp-offs?status=pending': COMP_OFFS,
      '/api/company/overtime?status=pending': [],
      '/api/leave/types': [],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(text(root.querySelector('.page-title') as HTMLElement)).toContain('Step in when an HOD is away.');

    click(row(root, 'Priya Nair'), 'approve');
    expect(http.expectOne('/api/company/leave-requests/LR-2/decision').request.body).toEqual({ decision: 'approved' });
    http.expectNone('/api/team/leave-requests');
  });

  it('explains when requests fail to load', async () => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await fail(http, '/api/team/leave-requests');

    expect(text(fixture.nativeElement)).toContain("Requests didn't load");
  });

  it('approves a resignation, which passes it to HR, and declines one with a reason', async () => {
    const root = await render();
    click(root, 'tab-resignations');
    expect(texts(root, 'pending-resignation')).toEqual(['AR Arjun Reddy Resigned · Submitted 2 days ago LAST DAY ASKED FOR 31 December 2026 REASON Moving back home Decline Approve']);

    click(root, 'approve');
    const approval = http.expectOne('/api/team/resignations/RS-1/decision');
    expect(approval.request.body).toEqual({ decision: 'approved' });
    approval.flush({});
    await settle();
    http.expectOne('/api/team/resignations?status=pending').flush(RESIGNATIONS);
    await settle();

    click(root, 'reject');
    fill(root, 'decision-note', 'Let us talk about a later date');
    click(root, 'confirm-reject');
    expect(http.expectOne('/api/team/resignations/RS-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Let us talk about a later date' });
  });

  it('tells the HOD when sick leave long enough to need a certificate has none', async () => {
    const sick: LeaveRequest = {
      id: 'LR-9', employeeId: 'OPR-0018', employeeName: 'Arjun Reddy', type: 'sick', from: '2026-11-15', to: '2026-11-18', days: 3, reason: 'Flu', status: 'pending', appliedOn: '2026-11-12',
    };
    const fixture = TestBed.createComponent(ApprovalsPage);
    await respond(http, {
      '/api/team/leave-requests': [sick],
      '/api/team/corrections': [],
      '/api/team/home-days?status=pending': [],
      '/api/team/comp-offs?status=pending': [],
      '/api/team/overtime?status=pending': [],
      '/api/team/resignations?status=pending': [],
      '/api/leave/types': [{ code: 'sick', name: 'Sick leave', allowsHalfDay: true, documentRequiredAfterDays: 2 }],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=certificate-missing]') as HTMLElement)).toBe('Medical certificate missing');
    expect(root.querySelector('[data-testid=approve]')).not.toBeNull();
  });
});
