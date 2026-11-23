import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApprovalsWaiting } from '../../models/company';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { ApprovalsToDecide } from './approvals-to-decide';

const HOD = { hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-11' };
const WAITING: ApprovalsWaiting = {
  leave: [{ id: 'LR-1', employeeId: 'P', employeeName: 'Priya Nair', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10', ...HOD }],
  corrections: [{ id: 'AC-1', employeeId: 'R', employeeName: 'Rohit Verma', date: '2026-11-10', kind: 'missed-out', category: 'forgot', requestedTime: '17:20', status: 'pending', raisedOn: '2026-11-11', ...HOD }],
  homeDays: [{ id: 'HW-1', employeeId: 'A', employeeName: 'Arjun Reddy', date: '2026-11-08', status: 'pending', ...HOD }],
  compOffs: [{ id: 'CO-1', employeeId: 'R', employeeName: 'Rohit Verma', date: '2026-11-06', status: 'pending', days: 0.5, workedMinutes: 130, ...HOD }],
  overtime: [{ id: 'OT-1', employeeId: 'A', employeeName: 'Arjun Reddy', date: '2026-11-09', status: 'pending', minutes: 80 }],
};

describe('ApprovalsToDecide', () => {
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

  const render = async (waiting: ApprovalsWaiting = WAITING) => {
    const fixture = TestBed.createComponent(ApprovalsToDecide);
    await respond(http, { '/api/hr/approvals': waiting, '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }] });
    return fixture.nativeElement as HTMLElement;
  };

  it('lists every kind in one list, oldest first, with who approved it at the HOD step', async () => {
    const root = await render();

    expect(texts(root, 'waiting-approval').map((row) => row.split(' Decline')[0])).toEqual([
      'RV Rohit Verma Comp off · approved by Vikram Singh Details Fri 6 Nov, earns half a day',
      'AR Arjun Reddy Worked from home · approved by Vikram Singh Details Sun 8 Nov',
      'AR Arjun Reddy Overtime · approved by their HOD Details Mon 9 Nov, 1h 20m',
      'RV Rohit Verma Punch fix · approved by Vikram Singh Details Tue 10 Nov, punch out at 17:20',
      'PN Priya Nair Annual leave · approved by Vikram Singh Details 20 Dec to 24 December 2026, 3 days',
    ]);
  });

  it('approves in one click and reloads', async () => {
    const root = await render();

    click(root, 'approve');
    const request = http.expectOne('/api/hr/approvals/comp-offs/CO-1/decision');
    expect(request.request.body).toEqual({ decision: 'approved' });
    request.flush(null);
    await settle();

    expect(http.match('/api/hr/approvals')).toHaveLength(1);
  });

  it('asks why before declining', async () => {
    const root = await render();

    click(root, 'reject');
    fill(root, 'decision-note', 'Two people are already off');
    click(root, 'confirm-reject');

    expect(http.expectOne('/api/hr/approvals/comp-offs/CO-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Two people are already off' });
  });

  it('says when nothing waits, and when the list fails to load', async () => {
    const empty = await render({ leave: [], corrections: [], homeDays: [], compOffs: [], overtime: [] });
    expect(text(empty)).toContain('Nothing waiting for HR.');

    const fixture = TestBed.createComponent(ApprovalsToDecide);
    await fail(http, '/api/hr/approvals');
    expect(text(fixture.nativeElement)).toContain("Approvals didn't load.");
  });
});
