import { Component, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaveRequest } from '../../models/leave';
import { click, NOW, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { LeaveRequests } from './leave-requests';

const request = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR-1', employeeId: 'OPR-0018', type: 'annual', from: '2026-12-20', to: '2026-12-31', days: 8, reason: 'Home', status: 'pending', appliedOn: '2026-11-11', ...overrides,
});

@Component({
  imports: [LeaveRequests],
  template: `<app-leave-requests [requests]="requests()" [types]="types" [isReadOnly]="isReadOnly()" (changed)="changes.set(changes() + 1)" />`,
})
class Host {
  readonly requests = signal<LeaveRequest[]>([]);
  readonly isReadOnly = signal(false);
  types = [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }];
  readonly changes = signal(0);
}

describe('LeaveRequests', () => {
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

  const render = async (requests: LeaveRequest[], isReadOnly = false) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.requests.set(requests);
    fixture.componentInstance.isReadOnly.set(isReadOnly);
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  };

  it('lists newest first with dates, length, status and the manager note', async () => {
    const { root } = await render([
      request({ id: 'LR-1', from: '2026-10-12', to: '2026-10-12', days: 1, status: 'rejected', decisionNote: 'Audit week', type: 'unknown' }),
      request({ id: 'LR-2', from: '2026-12-03', to: '2026-12-03', halfDay: 'second', days: 0.5, status: 'cancelled' }),
    ]);

    expect(texts(root, 'leave-request')).toEqual([
      'Annual leave 3 December 2026 afternoon only Cancelled',
      'unknown 12 October 2026 · “Audit week” 1 day Declined',
    ]);
  });

  it('only lets people cancel pending requests or approved ones still ahead', async () => {
    const { root } = await render([
      request({ id: 'LR-1', status: 'pending' }),
      request({ id: 'LR-2', status: 'approved', from: '2026-12-01' }),
      request({ id: 'LR-3', status: 'approved', from: '2026-11-01' }),
      request({ id: 'LR-4', status: 'rejected' }),
    ]);

    expect(root.querySelectorAll('[data-testid=cancel-request]')).toHaveLength(2);
  });

  it('hides cancelling in read only mode', async () => {
    const { root } = await render([request({})], true);

    expect(root.querySelector('[data-testid=cancel-request]')).toBeNull();
  });

  it('asks before cancelling, can back out, and cancels on yes', async () => {
    const { root, host } = await render([request({})]);

    click(root, 'cancel-request');
    ([...root.querySelectorAll('button')].find((button) => text(button) === 'Keep it') as HTMLButtonElement).click();
    TestBed.tick();
    expect(root.querySelector('[data-testid=confirm-cancel]')).toBeNull();

    click(root, 'cancel-request');
    click(root, 'confirm-cancel');
    http.expectOne('/api/leave/requests/LR-1/cancel').flush({});
    await settle();

    expect(host.changes()).toBe(1);
  });

  it('says so when cancelling fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, host } = await render([request({})]);

    click(root, 'cancel-request');
    click(root, 'confirm-cancel');
    http.expectOne('/api/leave/requests/LR-1/cancel').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(host.changes()).toBe(0);
  });

  it('has a helpful empty state', async () => {
    const { root } = await render([]);

    expect(text(root)).toContain('No requests yet');
  });
});
