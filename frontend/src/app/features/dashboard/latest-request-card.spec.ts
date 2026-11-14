import { TestBed } from '@angular/core/testing';
import { LeaveRequest } from '../../models/leave';
import { respond, setupHttp, text } from '../../../testing/fixtures';
import { LatestRequestCard } from './latest-request-card';

const request = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR', employeeId: 'E', type: 'annual', from: '2026-10-06', to: '2026-10-08', days: 3, reason: 'Trip', status: 'approved', appliedOn: '2026-09-28', ...overrides,
});

describe('LatestRequestCard', () => {
  const render = async (requests: LeaveRequest[]) => {
    const http = setupHttp();
    const fixture = TestBed.createComponent(LatestRequestCard);
    await respond(http, { '/api/leave/requests': requests, '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }] });
    return text(fixture.nativeElement);
  };

  it('shows the most recently touched request with who decided it', async () => {
    const shown = await render([
      request({ id: 'LR-1', decidedOn: '2026-09-29', decidedByName: 'Ibrahim Rasheed' }),
      request({ id: 'LR-2', status: 'cancelled', appliedOn: '2026-11-01' }),
    ]);

    expect(shown).toBe('LATEST REQUEST Leave approval Annual leave approved 6 Oct to 8 October 2026 · 3 days Approved by Ibrahim Rasheed Approved');
  });

  it('words a declined request', async () => {
    expect(await render([request({ status: 'rejected', decidedOn: '2026-11-01' })])).toContain('Annual leave not approved 6 Oct to 8 October 2026 · 3 days Declined by your manager Declined');
  });

  it('words a waiting request', async () => {
    expect(await render([request({ status: 'pending', appliedOn: '2026-11-10' })])).toContain('Annual leave waiting 6 Oct to 8 October 2026 · 3 days Asked on 10 Nov Waiting');
  });

  it('invites a first request when there are none', async () => {
    expect(await render([])).toContain('No leave requests yet. Request leave');
  });
});
