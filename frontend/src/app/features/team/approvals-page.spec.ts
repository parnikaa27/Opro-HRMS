import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CorrectionRequest, HomeDay } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';
import { click, fail, fill, NOW, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { ApprovalsPage } from './approvals-page';

const leave = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR', employeeId: 'E', employeeName: 'Person', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10', ...overrides,
});
const fix = (overrides: Partial<CorrectionRequest>): CorrectionRequest => ({
  id: 'AC', employeeId: 'E', employeeName: 'Person', date: '2026-11-10', kind: 'missed-out', requestedTime: '17:20', reason: 'Device offline', status: 'pending', raisedOn: '2026-11-11', ...overrides,
});

const LEAVE = [
  leave({ id: 'LR-2', employeeId: 'P', employeeName: 'Priya Nair', appliedOn: '2026-11-11' }),
  leave({ id: 'LR-1', employeeId: 'M', employeeName: 'Mariyam Nisha', from: '2026-12-22', to: '2026-12-22', days: 1, appliedOn: '2026-11-12' }),
  leave({ id: 'LR-3', employeeId: 'A', employeeName: 'Ahmed Zahir', status: 'approved', from: '2026-12-23', to: '2026-12-23', days: 1, decidedOn: '2026-11-05', appliedOn: '2026-11-01' }),
  leave({ id: 'LR-4', employeeId: 'G', employeeName: 'Grace Mendoza', status: 'rejected', decidedOn: '2026-11-07', decisionNote: 'Audit week' }),
];
const FIXES = [fix({ id: 'AC-1', employeeName: 'Rahim Uddin' }), fix({ id: 'AC-2', status: 'approved' })];
const HOME_DAYS: HomeDay[] = [{ id: 'HW-1', employeeId: 'K', employeeName: 'Kasun Perera', date: '2026-11-12', status: 'pending' }];

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

  const render = async (leaveRequests: LeaveRequest[] = LEAVE, fixes: CorrectionRequest[] = FIXES, homeDays: HomeDay[] = HOME_DAYS) => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await respond(http, {
      '/api/team/leave-requests': leaveRequests,
      '/api/team/corrections': fixes,
      '/api/team/home-days?status=pending': homeDays,
      '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
    });
    return fixture.nativeElement as HTMLElement;
  };

  const row = (root: HTMLElement, name: string) =>
    [...root.querySelectorAll<HTMLElement>('[data-testid=leave-row]')].find((item) => text(item.querySelector('strong') as HTMLElement) === name) as HTMLElement;

  it('shows waiting leave oldest first with counts on the tabs and overlap warnings', async () => {
    const root = await render();

    expect([...root.querySelectorAll('[role=tab]')].map((tab) => text(tab))).toEqual(['Pending 2', 'Approved', 'Declined', 'Punch fixes 1', 'Home working 1']);
    expect(texts(root, 'leave-row').map((item) => item.split(' Decline')[0])).toEqual([
      'PN Priya Nair Annual leave · Submitted yesterday Also off then: Mariyam Nisha (pending), Ahmed Zahir DATES 20 Dec to 24 December 2026 DURATION 3 days REASON Trip',
      'MN Mariyam Nisha Annual leave · Submitted today Also off then: Priya Nair (pending) DATES 22 December 2026 DURATION 1 day REASON Trip',
    ]);
  });

  it('shows decided requests on their own tabs with the manager note', async () => {
    const root = await render();

    click(root, 'tab-approved');
    expect(texts(root, 'leave-row')).toEqual(['AZ Ahmed Zahir Annual leave · Submitted 11 days ago DATES 23 December 2026 DURATION 1 day REASON Trip Approved']);
    click(root, 'tab-rejected');
    expect(texts(root, 'leave-row')[0]).toContain('YOUR NOTE Audit week Declined');
  });

  it('approves in one click and reloads', async () => {
    const root = await render();

    click(row(root, 'Mariyam Nisha'), 'approve');
    const request = http.expectOne('/api/team/leave-requests/LR-1/decision');
    expect(request.request.body).toEqual({ decision: 'approved' });
    request.flush({});
    await settle();

    expect(http.match('/api/team/leave-requests')).toHaveLength(1);
  });

  it('asks for a reason before declining a punch fix', async () => {
    const root = await render();
    click(root, 'tab-fixes');
    expect(texts(root, 'pending-fix')[0]).toContain('Rahim Uddin Missed punch out · Submitted yesterday DATE Tue 10 Nov TIME 17:20 REASON Device offline');

    click(root, 'reject');
    expect(text(root.querySelector('dialog') as HTMLElement)).toContain('Decline Rahim’s request?');
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
    const root = await render([], [], []);

    expect(text(root)).toContain('Nothing waiting for you.');
    click(root, 'tab-fixes');
    expect(text(root)).toContain('No punch fixes waiting for you.');
    click(root, 'tab-home');
    expect(text(root)).toContain('Nobody is waiting for a home working decision.');
  });

  it('approves a day worked from home in one click', async () => {
    const root = await render();
    click(root, 'tab-home');
    expect(texts(root, 'pending-home-day')[0]).toContain('Kasun Perera Worked from home DATE Thu 12 Nov IF DECLINED The day counts as absent');

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

  it('tells a manager a certificate is attached, but only HR gets to open it', async () => {
    const sick = [leave({ id: 'LR-7', type: 'sick', hasCertificate: true })];
    const manager = await render(sick);
    expect(text(manager.querySelector('[data-testid=certificate]') as HTMLElement)).toBe('Medical certificate attached');

    const fixture = TestBed.createComponent(ApprovalsPage);
    fixture.componentRef.setInput('scope', 'hr');
    await respond(http, { '/api/hr/leave-requests': sick, '/api/hr/corrections': [], '/api/leave/types': [] });
    const hr = fixture.nativeElement as HTMLElement;
    expect(hr.querySelector('[data-testid=certificate] a')?.getAttribute('href')).toBe('/api/hr/leave-requests/LR-7/certificate');
  });

  it('explains when requests fail to load', async () => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await fail(http, '/api/team/leave-requests');

    expect(text(fixture.nativeElement)).toContain("Requests didn't load");
  });
});
