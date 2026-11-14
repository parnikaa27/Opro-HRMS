import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CorrectionRequest } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';
import { click, fail, fill, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { ApprovalsPage } from './approvals-page';

const leave = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR', employeeId: 'E', employeeName: 'Person', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10', ...overrides,
});
const fix = (overrides: Partial<CorrectionRequest>): CorrectionRequest => ({
  id: 'AC', employeeId: 'E', employeeName: 'Person', date: '2026-11-10', kind: 'missed-out', requestedTime: '17:20', reason: 'Device offline', status: 'pending', raisedOn: '2026-11-11', ...overrides,
});

const LEAVE = [
  leave({ id: 'LR-2', employeeId: 'P', employeeName: 'Priya Nair', appliedOn: '2026-11-11' }),
  leave({ id: 'LR-1', employeeId: 'M', employeeName: 'Mariyam Nisha', from: '2026-12-22', to: '2026-12-22', days: 1, appliedOn: '2026-11-09' }),
  leave({ id: 'LR-3', employeeId: 'A', employeeName: 'Ahmed Zahir', status: 'approved', from: '2026-12-23', to: '2026-12-23', days: 1, decidedOn: '2026-11-05' }),
  leave({ id: 'LR-4', employeeId: 'G', employeeName: 'Grace Mendoza', status: 'rejected', from: '2026-12-21', to: '2026-12-21', days: 1, decidedOn: '2026-11-07' }),
];
const FIXES = [fix({ id: 'AC-1', employeeName: 'Rahim Uddin' }), fix({ id: 'AC-2', status: 'approved', kind: 'missed-in', decidedOn: '2026-11-06', employeeName: 'Kasun Perera', date: '2026-11-05' })];
const TYPES = [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }];

describe('ApprovalsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async (leaveRequests: LeaveRequest[] = LEAVE, fixes: CorrectionRequest[] = FIXES) => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await respond(http, { '/api/team/leave-requests': leaveRequests, '/api/team/corrections': fixes, '/api/leave/types': TYPES });
    return fixture.nativeElement as HTMLElement;
  };

  // Match on the name line only, since overlap notes mention other people too.
  const card = (root: HTMLElement, name: string) =>
    [...root.querySelectorAll<HTMLElement>('[data-testid=pending-leave]')].find((item) => text(item.querySelector('p') as HTMLElement) === name) as HTMLElement;

  it('lists waiting leave oldest first and warns about overlaps', async () => {
    const root = await render();

    expect(texts(root, 'pending-leave').map((item) => item.split(' Approve')[0])).toEqual([
      'MN Mariyam Nisha Annual leave, 22 December 2026, 1 day Asked 9 Nov Trip Also off then: Priya Nair (waiting)',
      'PN Priya Nair Annual leave, 20 Dec to 24 December 2026, 3 days Asked 11 Nov Trip Also off then: Mariyam Nisha (waiting), Ahmed Zahir',
    ]);
    expect(texts(root, 'pending-fix')[0]).toContain('Missed punch out on Tue 10 Nov. Says it was 17:20.');
  });

  it('shows recent decisions newest first', async () => {
    const root = await render();

    expect(texts(root, 'decided')).toEqual([
      'Grace Mendoza, annual leave, 21 December 2026 Not approved',
      'Kasun Perera, punch in fix for 5 Nov Approved',
      'Ahmed Zahir, annual leave, 23 December 2026 Approved',
    ]);
  });

  it('approves leave and reloads the list', async () => {
    const root = await render();

    click(card(root, 'Mariyam Nisha'), 'approve');
    const request = http.expectOne('/api/team/leave-requests/LR-1/decision');
    expect(request.request.body).toEqual({ decision: 'approved' });
    request.flush({});
    await settle();

    expect(http.match('/api/team/leave-requests')).toHaveLength(1);
  });

  it('rejects a punch fix with the reason', async () => {
    const root = await render();
    const fixCard = root.querySelector('[data-testid=pending-fix]') as HTMLElement;

    click(fixCard, 'reject');
    fill(fixCard, 'decision-note', 'The log shows you left at 16:30');
    click(fixCard, 'confirm-reject');

    const request = http.expectOne('/api/team/corrections/AC-1/decision');
    expect(request.request.body).toEqual({ decision: 'rejected', note: 'The log shows you left at 16:30' });
    request.flush({});
    await settle();
    expect(http.match('/api/team/corrections')).toHaveLength(1);
  });

  it('keeps the request and says so when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(card(root, 'Priya Nair'), 'approve');
    http.expectOne('/api/team/leave-requests/LR-2/decision').flush('', { status: 409, statusText: 'Conflict' });
    await settle();

    expect(card(root, 'Priya Nair').querySelector('[role=alert]')).not.toBeNull();
  });

  it('says when nothing is waiting', async () => {
    const root = await render([], []);

    expect(text(root)).toContain('No leave waiting for you.');
    expect(text(root)).toContain('No punch fixes waiting for you.');
    expect(root.querySelector('[data-testid=decided]')).toBeNull();
  });

  it('explains when either list fails to load', async () => {
    const fixture = TestBed.createComponent(ApprovalsPage);
    await fail(http, '/api/team/leave-requests');
    await fail(http, '/api/team/corrections');

    expect(text(fixture.nativeElement)).toContain("Leave requests didn't load");
    expect(text(fixture.nativeElement)).toContain("Punch fixes didn't load");
  });
});
